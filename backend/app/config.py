from pydantic import BaseModel
from pydantic import Field
import os


class Settings(BaseModel):
    database_url: str = Field(default=os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/roleferry"))
    redis_url: str = Field(default=os.getenv("REDIS_URL", "redis://localhost:6379/0"))
    cors_origins: list[str] = Field(default_factory=lambda: (os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")))
    environment: str = Field(default=os.getenv("ENV", "dev"))
    app_version: str = Field(default=os.getenv("APP_VERSION", "0.1.0"))

    # MillionVerifier gating
    mv_threshold: float = Field(default=float(os.getenv("MV_THRESHOLD", "0.8")))


settings = Settings()

