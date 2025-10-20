from datetime import datetime, timedelta, timezone
from typing import Optional
import jwt
from jwt.exceptions import PyJWTError, ExpiredSignatureError, InvalidTokenError
from passlib.context import CryptContext
from .config import settings
import logging
import traceback

logger = logging.getLogger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(subject: str, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create JWT access token using PyJWT (same robustezza as python-jose)
    Supports both expiring and non-expiring tokens
    """
    # When ACCESS_TOKEN_EXPIRE_MINUTES == 0, issue a token without exp claim
    if expires_delta is None:
        minutes = settings.access_token_expire_minutes
        if minutes and minutes > 0:
            expires_delta = timedelta(minutes=minutes)
        else:
            expires_delta = None
    
    # Build payload with subject
    to_encode: dict[str, object] = {"sub": subject}
    
    if expires_delta is not None:
        expire = datetime.now(timezone.utc) + expires_delta
        # PyJWT accepts datetime objects directly (more robust than timestamp)
        to_encode["exp"] = expire
    
    # Create token with same security as python-jose
    return jwt.encode(
        payload=to_encode, 
        key=settings.jwt_secret, 
        algorithm=settings.jwt_algorithm
    )

def decode_token(token: str) -> Optional[dict]:
    """
    Decode JWT token using PyJWT with same security options as python-jose
    Returns None on any error (invalid signature, expired, malformed, etc.)
    """
    try:
        # Decode with same security options as python-jose version
        # verify_signature=True (default), verify_exp=True (default)
        # options parameter controls verification behavior
        decoded = jwt.decode(
            jwt=token,
            key=settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            # Same verification options as jose version
            options={
                "verify_signature": True,  # Always verify signature
                "verify_exp": True,        # Verify expiration if present
                "require_exp": False,      # Don't require exp claim (allow session tokens)
                "verify_aud": False,       # Don't require audience
                "verify_iss": False,       # Don't require issuer
            }
        )
        return decoded
    except ExpiredSignatureError:
        # Token is expired
        logger.debug('JWT decode failed: expired token')
        return None
    except InvalidTokenError:
        # Token is invalid (malformed, wrong signature, etc.)
        logger.debug('JWT decode failed: invalid token')
        return None
    except PyJWTError:
        # Any other JWT error
        logger.debug('JWT decode failed: PyJWTError')
        return None
    except Exception:
        # Catch-all for any unexpected errors
        logger.debug('JWT decode unexpected error: %s', traceback.format_exc())
        return None
