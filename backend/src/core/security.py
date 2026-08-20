import hmac
import hashlib
import base64
import json
import time
import secrets
from typing import Optional, Dict, Any

# Security configuration
SECRET_KEY = "crypto-strategy-lab-secret-super-secure-key-2026"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_SECONDS = 60 * 60 * 24  # 24 hours

def get_password_hash(password: str) -> str:
    """
    Hash a password using PBKDF2-HMAC-SHA256 with a unique random salt (32 bytes).
    Format stored: pbkdf2_sha256$iterations$salt_hex$hash_hex
    """
    salt = secrets.token_hex(16)
    iterations = 100_000
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        iterations
    )
    return f"pbkdf2_sha256${iterations}${salt}${key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against the stored hash.
    """
    try:
        parts = hashed_password.split('$')
        if len(parts) != 4 or parts[0] != 'pbkdf2_sha256':
            return False
        iterations = int(parts[1])
        salt = parts[2]
        expected_hash = parts[3]
        
        calculated_key = hashlib.pbkdf2_hmac(
            'sha256',
            plain_password.encode('utf-8'),
            salt.encode('utf-8'),
            iterations
        )
        return hmac.compare_digest(calculated_key.hex(), expected_hash)
    except Exception:
        return False

def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def _base64url_decode(data_str: str) -> bytes:
    padding = '=' * (4 - (len(data_str) % 4)) if len(data_str) % 4 != 0 else ''
    return base64.urlsafe_b64decode((data_str + padding).encode('utf-8'))

def create_access_token(data: Dict[str, Any], expires_delta: Optional[int] = None) -> str:
    """
    Create a standard RFC 7519 JSON Web Token (JWT) signed with HS256 HMAC-SHA256.
    """
    to_encode = data.copy()
    now = int(time.time())
    expire = now + (expires_delta if expires_delta is not None else ACCESS_TOKEN_EXPIRE_SECONDS)
    to_encode.update({"iat": now, "exp": expire})
    
    header = {"alg": "HS256", "typ": "JWT"}
    
    header_b64 = _base64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    payload_b64 = _base64url_encode(json.dumps(to_encode, separators=(',', ':')).encode('utf-8'))
    
    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    signature = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    signature_b64 = _base64url_encode(signature)
    
    return f"{header_b64}.{payload_b64}.{signature_b64}"

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and verify a JWT token. Returns payload dict or None if invalid/expired.
    """
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        
        header_b64, payload_b64, signature_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
        
        expected_sig = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
        actual_sig = _base64url_decode(signature_b64)
        
        if not hmac.compare_digest(expected_sig, actual_sig):
            return None
        
        payload_bytes = _base64url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode('utf-8'))
        
        # Check expiration
        if "exp" in payload and payload["exp"] < int(time.time()):
            return None
        
        return payload
    except Exception:
        return None
