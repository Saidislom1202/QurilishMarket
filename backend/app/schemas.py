from datetime import datetime

from pydantic import BaseModel

from .models import OrderStatus, SellerStatus


# ---------- Buyers ----------

class BuyerRegisterIn(BaseModel):
    name: str = ""
    phone: str
    email: str = ""
    region: str = ""
    password: str


class BuyerLoginIn(BaseModel):
    phone: str
    password: str


class BuyerUpdateIn(BaseModel):
    name: str = ""
    phone: str
    email: str = ""
    region: str = ""


class BuyerOut(BaseModel):
    id: int
    name: str
    phone: str
    email: str
    region: str


class BuyerAuthOut(BaseModel):
    token: str
    buyer: BuyerOut


# ---------- Sellers ----------

class SellerRegisterIn(BaseModel):
    shop_name: str
    owner_name: str = ""
    phone: str
    email: str = ""
    region: str = ""
    password: str


class SellerLoginIn(BaseModel):
    phone: str
    password: str


class SellerUpdateIn(BaseModel):
    shop_name: str
    owner_name: str = ""
    phone: str
    email: str = ""
    region: str = ""


class SellerOut(BaseModel):
    id: int
    shop_name: str
    owner_name: str
    phone: str
    email: str
    region: str
    status: SellerStatus
    is_blocked: bool
    blocked_until: datetime | None = None
    blocked_reason: str = ""


class SellerAuthOut(BaseModel):
    token: str
    seller: SellerOut


# ---------- Products / Shops (public) ----------

class ProductCreateIn(BaseModel):
    name: str
    category: str
    price: int
    unit: str
    old_price: int | None = None
    image_url: str


class ProductOut(BaseModel):
    id: int
    seller_id: int
    seller: str
    name: str
    category: str
    price: int
    unit: str
    old: int | None
    discount: str | None
    rating: int
    image: str


class ShopOut(BaseModel):
    id: int
    initials: str
    name: str
    rating: str
    reviews: str
    place: str
    region: str


# ---------- Orders ----------

class OrderItemIn(BaseModel):
    product_id: int
    qty: int


class OrderCreateIn(BaseModel):
    buyer_name: str
    buyer_phone: str
    buyer_region: str = ""
    items: list[OrderItemIn]


class OrderItemOut(BaseModel):
    name: str
    qty: int
    price: int


class OrderOut(BaseModel):
    id: int
    buyer_name: str
    buyer_phone: str
    buyer_region: str
    total: int
    status: OrderStatus
    created_at: datetime
    items: list[OrderItemOut]


class OrderCreateResult(BaseModel):
    sellers: list[str]


# ---------- Admin ----------

class AdminLoginIn(BaseModel):
    username: str
    password: str


class AdminTokenOut(BaseModel):
    token: str


class SellerAdminOut(SellerOut):
    created_at: datetime


class BlockSellerIn(BaseModel):
    reason: str
    days: int | None = None  # None = butunlay bloklash


class SellerMessageIn(BaseModel):
    message: str


class SellerMessageOut(BaseModel):
    id: int
    message: str
    read: bool
    created_at: datetime


class AdminStatsOut(BaseModel):
    total_buyers: int
    total_sellers: int
    sellers_pending: int
    sellers_approved: int
    sellers_rejected: int
    sellers_blocked: int
    total_products: int
    total_orders: int


# ---------- Seller monthly stats ----------

class MonthlyStatOut(BaseModel):
    month: str  # "YYYY-MM"
    order_count: int
    total: int
