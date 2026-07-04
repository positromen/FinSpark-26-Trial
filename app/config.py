"""Application configuration via pydantic settings."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Prahari runtime settings, loaded from environment / .env."""

    app_name: str = "Prahari"
    debug: bool = False
    database_url: str = "sqlite:///./prahari.db"
    host: str = "127.0.0.1"
    port: int = 8000

    model_config = SettingsConfigDict(env_file=".env", env_prefix="PRAHARI_")


settings = Settings()
