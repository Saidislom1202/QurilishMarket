from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from sqlmodel import SQLModel, Field, Relationship


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


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
    created_at: datetime = Field(default_factory=now_utc)

    products: list["Product"] = Relationship(back_populates="seller")
    orders: list["Order"] = Relationship(back_populates="seller")


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


class OrderItem(SQLModel, table=True):
    __tablename__ = "order_items"

    id: Optional[int] = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="orders.id", index=True)
    product_id: Optional[int] = Field(default=None, foreign_key="products.id")
    name: str
    qty: int
    price: int

    order: Optional[Order] = Relationship(back_populates="items")
