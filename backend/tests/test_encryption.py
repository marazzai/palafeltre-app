import os
import pytest

os.environ.setdefault('DATABASE_URL', 'sqlite:///./test.db')

from app.core.encryption import encrypt_value, decrypt_value


def test_encrypt_decrypt_roundtrip():
    secret = 'my-very-secret'
    token = encrypt_value(secret)
    assert token.startswith('enc:')
    plain = decrypt_value(token)
    assert plain == secret

