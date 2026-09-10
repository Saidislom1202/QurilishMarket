from datetime import datetime, timezone
from enum import Enum
from typing import Optional
from zoneinfo import ZoneInfo

from sqlmodel import SQLModel, Field, Relationship

TASHKENT_TZ = ZoneInfo("Asia/Tashkent")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(dt: datetime) -> datetime:
    # DB drayverlari (SQLite/Postgres) datetime'ni odatda tzinfo'siz (naive)
    # qaytaradi, lekin biz doim UTC deb yozganmiz — shuni aniq belgilaymiz,
    # aks holda frontend uni noto'g'ri (brauzer vaqti deb) o'qib qo'yadi.
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def to_tashkent(dt: datetime) -> datetime:
    return ensure_utc(dt).astimezone(TASHKENT_TZ)


class SellerStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class OrderStatus(str, Enum):
    new = "yangi"
    viewed = "korilgan"


class Buyer(SQLModel, table=True):
    __tablename__ = "buyers"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = ""
    phone: str = Field(unique=True, index=True)
    email: str = ""
    region: str = ""
    password_hash: str
    created_at: datetime = Field(default_factory=now_utc)


class Seller(SQLModel, table=True):
    __tablename__ = "sellers"

    id: Optional[int] = Field(default=None, primary_key=True)
    shop_name: str
    owner_name: str = ""
    phone: str = Field(unique=True, index=True)
    email: str = ""
    region: str = ""
    password_hash: str
    status: SellerStatus = Field(default=SellerStatus.pending, index=True)
    is_blocked: bool = Field(default=False, index=True)
    blocked_until: Optional[datetime] = None
    blocked_reason: str = ""
    created_at: datetime = Field(default_factory=now_utc)

    products: list["Product"] = Relationship(back_populates="seller")
    orders: list["Order"] = Relationship(back_populates="seller")
    messages: list["SellerMessage"] = Relationship(back_populates="seller")


def is_effectively_blocked(seller: "Seller") -> bool:
    if not seller.is_blocked:
        return False
    if seller.blocked_until is None:
        return True
    until = seller.blocked_until
    if until.tzinfo is None:
        until = until.replace(tzinfo=timezone.utc)
    return until > now_utc()


def seller_public_fields(seller: "Seller") -> dict:
    data = seller.model_dump()
    data["is_blocked"] = is_effectively_blocked(seller)
    data["created_at"] = ensure_utc(seller.created_at)
    if seller.blocked_until is not None:
        data["blocked_until"] = ensure_utc(seller.blocked_until)
    return data


class Product(SQLModel, table=True):
    __tablename__ = "products"

    id: Optional[int] = Field(default=None, primary_key=True)
    seller_id: int = Field(foreign_key="sellers.id", index=True)
    name: str
    category: str
    price: int
    unit: str
    old_price: Optional[int] = None
    image_url: str
    rating: int = 0
    created_at: datetime = Field(default_factory=now_utc)

    seller: Optional[Seller] = Relationship(back_populates="products")


class Order(SQLModel, table=True):
    __tablename__ = "orders"

    id: Optional[int] = Field(default=None, primary_key=True)
    seller_id: int = Field(foreign_key="sellers.id", index=True)
    buyer_name: str
    buyer_phone: str
    buyer_region: str = ""
    total: int
    status: OrderStatus = Field(default=OrderStatus.new, index=True)
    created_at: datetime = Field(default_factory=now_utc)

    seller: Optional[Seller] = Relationship(back_populates="orders")
    items: list["OrderItem"] = Relationship(back_populates="order")


class SellerMessage(SQLModel, table=True):
    __tablename__ = "seller_messages"

    id: Optional[int] = Field(default=None, primary_key=True)
    seller_id: int = Field(foreign_key="sellers.id", index=True)
    message: str
    read: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=now_utc)

    seller: Optional[Seller] = Relationship(back_populates="messages")


class OrderItem(SQLModel, table=True):
    __tablename__ = "order_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="orders.id", index=True)
    product_id: Optional[int] = Field(default=None, foreign_key="products.id")
    name: str
    qty: int
    price: int

    order: Optional[Order] = Relationship(back_populates="items")
