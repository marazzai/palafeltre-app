"""
Structured JSON logging configuration for production
"""
import logging
import json
import sys
from datetime import datetime, timezone
from typing import Any, Dict


class JsonFormatter(logging.Formatter):
    """Custom formatter that outputs JSON logs"""
    
    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields from record using getattr so static analyzers don't complain
        user_id = getattr(record, "user_id", None)
        if user_id is not None:
            log_data["user_id"] = user_id
        request_id = getattr(record, "request_id", None)
        if request_id is not None:
            log_data["request_id"] = request_id
        endpoint = getattr(record, "endpoint", None)
        if endpoint is not None:
            log_data["endpoint"] = endpoint
        method = getattr(record, "method", None)
        if method is not None:
            log_data["method"] = method
        duration_ms = getattr(record, "duration_ms", None)
        if duration_ms is not None:
            log_data["duration_ms"] = duration_ms
        
        return json.dumps(log_data, ensure_ascii=False)


def setup_logging(enable_json: bool = False, log_level: str = "INFO") -> None:
    """
    Configure logging for the application
    
    Args:
        enable_json: If True, use JSON formatting (recommended for production)
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    """
    level = getattr(logging, log_level.upper(), logging.INFO)
    
    # Root logger configuration
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    
    # Remove existing handlers
    root_logger.handlers.clear()
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    
    if enable_json:
        console_handler.setFormatter(JsonFormatter())
    else:
        console_handler.setFormatter(
            logging.Formatter(
                "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S"
            )
        )
    
    root_logger.addHandler(console_handler)
    
    # Reduce noise from third-party libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
