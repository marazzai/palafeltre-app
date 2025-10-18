from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    # When ACCESS_TOKEN_EXPIRE_MINUTES == 0, issue a token without exp claim
    if expires_delta is None:
        minutes = settings.access_token_expire_minutes
        if minutes and minutes > 0:
            expires_delta = timedelta(minutes=minutes)
        else:
            expires_delta = None
    to_encode = {"sub": subject}
    if expires_delta is not None:
        expire = datetime.now(timezone.utc) + expires_delta
        # jose accepts numeric exp (seconds since epoch)
        to_encode["exp"] = int(expire.timestamp())
    return jwt.encode(to_encode, settings.jwt_secret, algorithm=settings.jwt_algorithm)

def decode_token(token: str) -> Optional[dict]:
    try:
        # Options: don't require exp if not present (session-only mode)
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"verify_signature": True, "verify_exp": True, "require_exp": False},
        )
    except JWTError:
        return None
