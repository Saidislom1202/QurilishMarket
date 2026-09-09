import os
from dotenv import load_dotenv

load_dotenv()


def _env(name: str, default: str = "") -> str:
    # Bo'sh qatorli .env yozuvini ham "sozlanmagan" deb hisoblaymiz (os.getenv faqat
    # o'zgaruvchi umuman yo'q bo'lsagina standart qiymatni qaytaradi, bo'sh qatorda emas).
    return os.getenv(name) or default


class Settings:
    database_url: str = _env("DATABASE_URL", "sqlite:///./dev.db")
    jwt_secret: str = _env("JWT_SECRET", "dev-only-insecure-secret-change-me")
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 30

    admin_username: str = _env("ADMIN_USERNAME", "admin")
    admin_password: str = _env("ADMIN_PASSWORD", "admin123")

    public_base_url: str = _env("PUBLIC_BASE_URL", "http://localhost:8000")
    cors_origins: list[str] = [o.strip() for o in _env("CORS_ORIGINS", "*").split(",")]

    r2_account_id: str | None = _env("R2_ACCOUNT_ID") or None
    r2_access_key_id: str | None = _env("R2_ACCESS_KEY_ID") or None
    r2_secret_access_key: str | None = _env("R2_SECRET_ACCESS_KEY") or None
    r2_bucket: str | None = _env("R2_BUCKET") or None
    r2_public_url: str | None = _env("R2_PUBLIC_URL") or None

    @property
    def r2_configured(self) -> bool:
        return bool(self.r2_account_id and self.r2_access_key_id and self.r2_secret_access_key and self.r2_bucket and self.r2_public_url)


settings = Settings()
