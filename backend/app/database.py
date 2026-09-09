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


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
