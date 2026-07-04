"""Application configuration via pydantic settings."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Prahari runtime settings, loaded from environment / .env."""

    app_name: str = "Prahari"
    debug: bool = False
    database_url: str = "sqlite:///./prahari.db"
    host: str = "127.0.0.1"
    port: int = 8000
    # Auth. Override PRAHARI_SECRET_KEY in production; this default is demo-only.
    secret_key: str = "prahari-demo-secret-change-me"
    token_ttl_minutes: int = 480
    demo_password: str = "prahari123"  # shared password for all seeded accounts (demo)
    mfa_code: str = "246810"           # accepted step-up MFA code (demo)

    model_config = SettingsConfigDict(env_file=".env", env_prefix="PRAHARI_")


settings = Settings()
