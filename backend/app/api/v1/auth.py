from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional

from ...core.auth import AuthService, get_current_user, get_current_user_optional
from ...core.permissions import require_permission, Permissions
from ...models.rbac import User
from .endpoints import get_db
from ...core.security import hash_password

router = APIRouter(prefix="/auth", tags=["authentication"])

# Pydantic models
class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict

class RefreshRequest(BaseModel):
    refresh_token: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class UserProfile(BaseModel):
    id: int
    username: Optional[str]
    email: str
    full_name: Optional[str]
    is_active: bool
    roles: list

@router.post("/login", response_model=LoginResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login with username/email and password"""
    user = AuthService.authenticate_user(db, form_data.username, form_data.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = AuthService.create_access_token(user.id)
    refresh_token = AuthService.create_refresh_token(user.id)
    
    user_data = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "roles": [
            {
                "name": role.name,
                "permissions": [
                    {"code": perm.code, "description": perm.description}
                    for perm in role.permissions
                ]
            }
            for role in user.roles
        ]
    }
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": user_data
    }

@router.post("/refresh", response_model=LoginResponse)
async def refresh_token(
    request: RefreshRequest,
    db: Session = Depends(get_db)
):
    """Refresh access token using refresh token"""
    user_id = AuthService.verify_token(request.refresh_token, "refresh")
    
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    user = AuthService.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    access_token = AuthService.create_access_token(user.id)
    new_refresh_token = AuthService.create_refresh_token(user.id)
    
    user_data = {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "roles": [
            {
                "name": role.name,
                "permissions": [
                    {"code": perm.code, "description": perm.description}
                    for perm in role.permissions
                ]
            }
            for role in user.roles
        ]
    }
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "user": user_data
    }

@router.get("/me", response_model=UserProfile)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "is_active": current_user.is_active,
        "roles": [
            {
                "name": role.name,
                "permissions": [
                    {"code": perm.code, "description": perm.description}
                    for perm in role.permissions
                ]
            }
            for role in current_user.roles
        ]
    }

@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change user password"""
    from ...core.security import verify_password
    
    # Verify current password
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Hash new password
    current_user.hashed_password = hash_password(request.new_password)
    current_user.must_change_password = False
    db.commit()
    
    return {"message": "Password changed successfully"}

@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Logout (token blacklisting would go here in production)"""
    return {"message": "Logged out successfully"}

@router.get("/check-auth")
async def check_auth(current_user: Optional[User] = Depends(get_current_user_optional)):
    """Check if user is authenticated"""
    if current_user:
        return {
            "authenticated": True,
            "user": {
                "id": current_user.id,
                "username": current_user.username,
                "email": current_user.email,
                "full_name": current_user.full_name
            }
        }
    else:
        return {"authenticated": False}