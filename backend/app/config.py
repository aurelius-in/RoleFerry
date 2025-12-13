from pydantic import BaseModel
from pydantic import Field
import os


class Settings(BaseModel):
    database_url: str = Field(default=os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/roleferry"))
    redis_url: str = Field(default=os.getenv("REDIS_URL", "redis://localhost:6379/0"))
    cors_origins: list[str] = Field(default_factory=lambda: (os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")))
    environment: str = Field(default=os.getenv("ENV", "dev"))
    app_version: str = Field(default=os.getenv("APP_VERSION", "0.1.0"))

    # MillionVerifier gating
    mv_threshold: float = Field(default=float(os.getenv("MV_THRESHOLD", "0.8")))
    mv_api_key: str | None = Field(default=os.getenv("MV_API_KEY"))
    instantly_api_key: str | None = Field(default=os.getenv("INSTANTLY_API_KEY"))
    apify_token: str | None = Field(default=os.getenv("APIFY_TOKEN"))
    apify_indeed_actor_id: str | None = Field(default=os.getenv("APIFY_INDEED_ACTOR_ID"))

    # Lead-Qual providers / LLM
    serper_api_key: str | None = Field(default=os.getenv("SERPER_API_KEY"))
    openai_api_key: str | None = Field(default=os.getenv("OPENAI_API_KEY"))
    openai_model: str = Field(default=os.getenv("OPENAI_MODEL", "gpt-4o-mini"))
    openai_base_url: str | None = Field(default=os.getenv("OPENAI_BASE_URL"))
    findymail_api_key: str | None = Field(default=os.getenv("FINDYMAIL_API_KEY"))
    neverbounce_api_key: str | None = Field(default=os.getenv("NEVERBOUNCE_API_KEY"))

    # Google Sheets (optional)
    gsheet_service_json_path: str | None = Field(default=os.getenv("GOOGLE_SHEETS_SERVICE_JSON_PATH"))
    gsheet_sheet_id: str | None = Field(default=os.getenv("GOOGLE_SHEETS_SHEET_ID"))

    # Feature flags / modes
    mock_mode: bool = Field(default=os.getenv("ROLEFERRY_MOCK_MODE", "true").lower() == "true")
    llm_mode: str = Field(
        default=os.getenv("LLM_MODE", "openai")
    )  # 'openai' | 'stub' | future providers
    preferred_email_verifier: str = Field(default=os.getenv("PREFERRED_EMAIL_VERIFIER", "neverbounce"))

    # Offer Decks / Clay-Clone
    gamma_api_key: str | None = Field(default=os.getenv("GAMMA_API_KEY"))
    gamma_webhook_url: str | None = Field(default=os.getenv("GAMMA_WEBHOOK_URL"))
    offer_deck_provider: str = Field(default=os.getenv("OFFER_DECK_PROVIDER", "gamma"))
    mesh_clone_enabled: bool = Field(default=os.getenv("MESH_CLONE_ENABLED", "true").lower() == "true")

    # Simple SMTP email sending (internal test only)
    smtp_host: str | None = Field(default=os.getenv("SMTP_HOST"))
    smtp_port: int = Field(default=int(os.getenv("SMTP_PORT", "587")))
    smtp_username: str | None = Field(default=os.getenv("SMTP_USERNAME"))
    smtp_password: str | None = Field(default=os.getenv("SMTP_PASSWORD"))
    smtp_from: str | None = Field(default=os.getenv("SMTP_FROM"))
    smtp_use_tls: bool = Field(default=os.getenv("SMTP_USE_TLS", "true").lower() == "true")
    internal_test_recipients: str | None = Field(default=os.getenv("INTERNAL_TEST_RECIPIENTS"))

    @property
    def instantly_enabled(self) -> bool:
        return bool(self.instantly_api_key)


settings = Settings()

