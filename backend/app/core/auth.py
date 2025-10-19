from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
from datetime import datetime, timedelta, timezone

from ..core.config import settings
from ..models.rbac import User
from ..db.session import SessionLocal, get_db

security = HTTPBearer(auto_error=False)

class AuthService:
    """Service for handling authentication and JWT tokens"""
    
    @staticmethod
    def create_access_token(user_id: int, expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token using PyJWT"""
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(hours=settings.access_token_expire_hours)
        
        to_encode = {
            "sub": str(user_id),
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "access"
        }
        
        return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    
    @staticmethod
    def create_refresh_token(user_id: int) -> str:
        """Create JWT refresh token using PyJWT"""
        expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
        
        to_encode = {
            "sub": str(user_id),
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "refresh"
        }
        
        return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    
    @staticmethod
    def verify_token(token: str, token_type: str = "access") -> Optional[int]:
        """Verify JWT token and return user ID - using PyJWT"""
        try:
            payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
            user_id = payload.get("sub")
            token_type_check = payload.get("type", "access")
            
            if user_id is None or token_type_check != token_type:
                return None
                
            return int(user_id)
        except ExpiredSignatureError:
            return None
        except InvalidTokenError:
            return None
    
    @staticmethod
    def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
        """Get user by ID with roles and permissions"""
        from sqlalchemy.orm import joinedload
        
        return db.query(User).options(
            joinedload(User.roles).joinedload("permissions")
        ).filter(
            User.id == user_id,
            User.is_active == True
        ).first()
    
    @staticmethod
    def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
        """Authenticate user with username/email and password"""
        from sqlalchemy import or_
        from ..core.security import verify_password
        from sqlalchemy.orm import joinedload
        
        user = db.query(User).options(
            joinedload(User.roles).joinedload("permissions")
        ).filter(
            or_(User.username == username, User.email == username),
            User.is_active == True
        ).first()
        
        if not user or not verify_password(password, user.hashed_password):
            return None
            
        # Update last login
        user.last_login = datetime.utcnow()
        db.commit()
        
        return user


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Dependency to get current authenticated user"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = AuthService.verify_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = AuthService.get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user


async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Dependency to get current user if authenticated, None otherwise"""
    if not credentials:
        return None
    
    user_id = AuthService.verify_token(credentials.credentials)
    if user_id is None:
        return None
    
    return AuthService.get_user_by_id(db, user_id)


# Dependency for routes that require authentication
RequireAuth = Depends(get_current_user)