from sqlalchemy import inspect, text
from sqlmodel import SQLModel, Session, create_engine

from .config import settings


def _resolve_url(url: str) -> str:
    # Neon/Postgres odatda "postgresql://" yoki "postgres://" beradi, bu esa
    # SQLAlchemy'ni standart psycopg2 drayverini qidirishga majburlaydi — biz
    # esa psycopg (3-versiya) o'rnatganmiz, shuning uchun sxemani aniq ko'rsatamiz.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


database_url = _resolve_url(settings.database_url)
connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
engine = create_engine(database_url, connect_args=connect_args)


def _ensure_seller_columns() -> None:
    # SQLModel.metadata.create_all faqat YO'Q jadvallarni yaratadi — mavjud
    # "sellers" jadvaliga yangi ustun qo'shmaydi. Productionda allaqachon
    # ma'lumot bor bo'lgani uchun buni qo'lda, xavfsiz tarzda qo'shamiz.
    inspector = inspect(engine)
    if "sellers" not in inspector.get_table_names():
        return
    existing = {c["name"] for c in inspector.get_columns("sellers")}
    statements = []
    if "is_blocked" not in existing:
        statements.append("ALTER TABLE sellers ADD COLUMN is_blocked BOOLEAN NOT NULL DEFAULT FALSE")
    if "blocked_until" not in existing:
        statements.append("ALTER TABLE sellers ADD COLUMN blocked_until TIMESTAMP")
    if "blocked_reason" not in existing:
        statements.append("ALTER TABLE sellers ADD COLUMN blocked_reason TEXT DEFAULT ''")
    if not statements:
        return
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    _ensure_seller_columns()


def get_session():
    with Session(engine) as session:
        yield session
