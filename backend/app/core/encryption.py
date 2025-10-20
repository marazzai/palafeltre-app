from typing import Optional
import hashlib
import base64
from cryptography.fernet import Fernet, InvalidToken
from .config import settings


def _derive_fernet_key(secret: str) -> bytes:
    """Derive a 32-byte URL-safe base64-encoded key from an application secret."""
    h = hashlib.sha256()
    h.update(secret.encode('utf-8'))
    key = base64.urlsafe_b64encode(h.digest())
    return key


def encrypt_value(plain: str) -> str:
    """Encrypt a short secret value and return a prefixed token.

    Returns a string starting with 'enc:' to allow easy detection.
    """
    if plain is None or plain == '':
        return ''
    key = _derive_fernet_key(settings.secret_key or settings.jwt_secret)
    f = Fernet(key)
    token = f.encrypt(plain.encode('utf-8'))
    return 'enc:' + token.decode('utf-8')


def decrypt_value(value: Optional[str]) -> str:
    """Decrypt a value produced by encrypt_value or return the original if not encrypted."""
    if not value:
        return ''
    if not value.startswith('enc:'):
        # treat as legacy plaintext
        return value
    token = value[len('enc:'):]
    key = _derive_fernet_key(settings.secret_key or settings.jwt_secret)
    f = Fernet(key)
    try:
        plain = f.decrypt(token.encode('utf-8'))
        return plain.decode('utf-8')
    except InvalidToken:
        raise
