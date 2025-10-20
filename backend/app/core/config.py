from typing import List
import os
from pathlib import Path
import hashlib


def _parse_csv(value: str | None, default: List[str]) -> List[str]:
    if not value:
        return default
    return [v.strip() for v in value.split(',') if v.strip()]


class Settings:
    def __init__(self) -> None:
        # Database
        self.database_url: str = os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg2://palafeltre:palafeltre@db:5432/palafeltre",
        )
        
        # Storage paths
        self.storage_path: str = os.getenv("STORAGE_PATH", "/app/storage")
        self.documents_path: Path = Path(self.storage_path) / "documents"
        self.logs_path: Path = Path(self.storage_path) / "logs"
        
        # CORS configuration
        self._cors_origins: List[str] = _parse_csv(
            os.getenv("CORS_ORIGINS"), ["http://localhost:8080", "http://localhost:3000", "http://localhost:5173"]
        )
        # Regex fallback to allow local network hosts (use env to override in production)
        self.cors_origin_regex: str = os.getenv(
            "CORS_ORIGIN_REGEX",
            r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?|https?://192\.168\.[0-9]+\.[0-9]+(:\d+)?",
        )
        
        # JWT/Auth configuration
        self.jwt_secret: str = os.getenv("JWT_SECRET", "change-me-in-prod")
        self.jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
        # 0 = no expiry claim in tokens (session-only on frontend)
        self.access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "0"))
        # New auth settings for the enhanced system
        self.access_token_expire_hours: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "24"))
        self.refresh_token_expire_days: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))
        
        # Security settings
        self.secret_key: str = self.jwt_secret  # Alias for consistency
        self.algorithm: str = self.jwt_algorithm  # Alias for consistency
        
        # Admin bootstrap configuration
        self.admin_username: str = os.getenv("ADMIN_USERNAME", "admin")
        self.admin_email: str = os.getenv("ADMIN_EMAIL", "admin@example.com")
        # Default to a reasonable password; can be overridden via env in production
        self.admin_password: str = os.getenv("ADMIN_PASSWORD", "adminadmin")
        # If true, on startup we will force-reset the admin password to ADMIN_PASSWORD
        self.force_reset_admin_password: bool = (os.getenv("FORCE_RESET_ADMIN_PASSWORD", "false").lower() in ("1","true","yes","on"))
        
        # OBS WebSocket settings
        self.obs_host: str = os.getenv("OBS_HOST", "localhost")
        self.obs_port: int = int(os.getenv("OBS_PORT", "4455"))
        self.obs_password: str = os.getenv("OBS_PASSWORD", "")
        
        # DALI / BACnet gateway config
        self.dali_gateway_ip = os.getenv("DALI_GATEWAY_IP")
        self.dali_gateway_device_id = int(os.getenv("DALI_GATEWAY_DEVICE_ID", "0")) if os.getenv("DALI_GATEWAY_DEVICE_ID") else None
        
        # Optional path to a logo image to include in generated reports (PNG/JPG)
        self.report_logo_path = os.getenv("REPORT_LOGO_PATH")
        
        # Logging configuration
        self.log_level: str = os.getenv("LOG_LEVEL", "INFO")
        self.json_logs: bool = os.getenv("JSON_LOGS", "false").lower() in ("1", "true", "yes", "on")
        
        # Rate limiting
        self.rate_limit_requests: int = int(os.getenv("RATE_LIMIT_REQUESTS", "100"))
        self.rate_limit_window: int = int(os.getenv("RATE_LIMIT_WINDOW", "60"))
        
        # Ensure directories exist
        Path(self.storage_path).mkdir(exist_ok=True)
        self.documents_path.mkdir(exist_ok=True)
        self.logs_path.mkdir(exist_ok=True)

        # compute a short fingerprint of the secret to help detect mismatched secrets across instances
        try:
            h = hashlib.sha256()
            h.update((self.secret_key or '').encode('utf-8'))
            self.secret_fingerprint = h.hexdigest()[:12]
        except Exception:
            self.secret_fingerprint = None

    @property
    def cors_origins(self) -> List[str]:
        return self._cors_origins


settings = Settings()
