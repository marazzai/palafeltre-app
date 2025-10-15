from typing import List
import os


def _parse_csv(value: str | None, default: List[str]) -> List[str]:
    if not value:
        return default
    return [v.strip() for v in value.split(',') if v.strip()]


class Settings:
    def __init__(self) -> None:
        self.database_url: str = os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg2://palafeltre:palafeltre@db:5432/palafeltre",
        )
        self.storage_path: str = os.getenv("STORAGE_PATH", "/app/storage")
        self._cors_origins: List[str] = _parse_csv(
            os.getenv("CORS_ORIGINS"), ["http://localhost:8080"]
        )
        # Regex fallback to allow local network hosts (use env to override in production)
        self.cors_origin_regex: str = os.getenv(
            "CORS_ORIGIN_REGEX",
            r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?|https?://192\.168\.[0-9]+\.[0-9]+(:\d+)?",
        )
        self.jwt_secret: str = os.getenv("JWT_SECRET", "change-me-in-prod")
        self.jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
        self.access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
        # Admin bootstrap configuration
        self.admin_username: str = os.getenv("ADMIN_USERNAME", "admin")
        self.admin_email: str = os.getenv("ADMIN_EMAIL", "admin@example.com")
        # Default to a reasonable password; can be overridden via env in production
        self.admin_password: str = os.getenv("ADMIN_PASSWORD", "adminadmin")
        # If true, on startup we will force-reset the admin password to ADMIN_PASSWORD
        self.force_reset_admin_password: bool = (os.getenv("FORCE_RESET_ADMIN_PASSWORD", "false").lower() in ("1","true","yes","on"))
        # DALI / BACnet gateway config
        self.dali_gateway_ip = os.getenv("DALI_GATEWAY_IP")
        self.dali_gateway_device_id = int(os.getenv("DALI_GATEWAY_DEVICE_ID", "0")) if os.getenv("DALI_GATEWAY_DEVICE_ID") else None
        # Optional path to a logo image to include in generated reports (PNG/JPG)
        self.report_logo_path = os.getenv("REPORT_LOGO_PATH")
        # Logging configuration
        self.log_level: str = os.getenv("LOG_LEVEL", "INFO")
        self.json_logs: bool = os.getenv("JSON_LOGS", "false").lower() in ("1", "true", "yes", "on")

    @property
    def cors_origins(self) -> List[str]:
        return self._cors_origins


settings = Settings()
