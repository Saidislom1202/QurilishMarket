from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..database import get_session
from ..deps import get_current_seller
from ..models import (
    Order,
    OrderItem,
    OrderStatus,
    Product,
    Seller,
    SellerStatus,
    ensure_utc,
    is_effectively_blocked,
    to_tashkent,
)
from ..schemas import MonthlyStatOut, OrderCreateIn, OrderCreateResult, OrderItemOut, OrderOut, ProductStatOut

router = APIRouter(prefix="/api", tags=["orders"])


@router.post("/orders", response_model=OrderCreateResult)
def create_order(data: OrderCreateIn, session: Session = Depends(get_session)):
    if not data.items:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Savat bo'sh")

    by_seller: dict[int, list[tuple[Product, int]]] = defaultdict(list)
    for item in data.items:
        product = session.get(Product, item.product_id)
        if not product or item.qty < 1:
            continue
        seller = session.get(Seller, product.seller_id)
        if not seller or seller.status != SellerStatus.approved or is_effectively_blocked(seller):
            continue
        by_seller[product.seller_id].append((product, item.qty))

    if not by_seller:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Buyurtma uchun yaroqli mahsulot topilmadi")

    seller_names: list[str] = []
    for seller_id, entries in by_seller.items():
        total = sum(p.price * qty for p, qty in entries)
        order = Order(
            seller_id=seller_id,
            buyer_name=data.buyer_name.strip(),
            buyer_phone=data.buyer_phone.strip(),
            buyer_region=data.buyer_region,
            total=total,
        )
        session.add(order)
        session.flush()  # get order.id before adding items

        for product, qty in entries:
            session.add(OrderItem(order_id=order.id, product_id=product.id, name=product.name, qty=qty, price=product.price))

        seller = session.get(Seller, seller_id)
        seller_names.append(seller.shop_name)

    session.commit()
    return OrderCreateResult(sellers=seller_names)


@router.get("/sellers/me/orders", response_model=list[OrderOut])
def my_orders(
    seller: Seller = Depends(get_current_seller),
    session: Session = Depends(get_session),
):
    orders = session.exec(
        select(Order).where(Order.seller_id == seller.id).order_by(Order.created_at.desc())
    ).all()
    result = []
    for o in orders:
        items = session.exec(select(OrderItem).where(OrderItem.order_id == o.id)).all()
        result.append(
            OrderOut(
                id=o.id,
                buyer_name=o.buyer_name,
                buyer_phone=o.buyer_phone,
                buyer_region=o.buyer_region,
                total=o.total,
                status=o.status,
                created_at=ensure_utc(o.created_at),
                items=[OrderItemOut(name=i.name, qty=i.qty, price=i.price) for i in items],
            )
        )
    return result


@router.get("/sellers/me/stats", response_model=list[MonthlyStatOut])
def my_monthly_stats(
    seller: Seller = Depends(get_current_seller),
    session: Session = Depends(get_session),
):
    rows = session.exec(
        select(Order, OrderItem)
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(Order.seller_id == seller.id)
    ).all()

    # Oy chegarasi ham Toshkent vaqti bo'yicha aniqlanadi (UTC bo'yicha emas),
    # aks holda kechqurun/tunda tushgan buyurtma noto'g'ri oyga tushib qolishi mumkin.
    monthly: dict[str, dict] = defaultdict(lambda: {"order_ids": set(), "products": defaultdict(lambda: {"qty": 0, "total": 0})})
    for order, item in rows:
        key = to_tashkent(order.created_at).strftime("%Y-%m")
        bucket = monthly[key]
        bucket["order_ids"].add(order.id)
        p = bucket["products"][item.name]
        p["qty"] += item.qty
        p["total"] += item.price * item.qty

    months = sorted(monthly.keys(), reverse=True)[:12]
    result = []
    for key in months:
        bucket = monthly[key]
        products = [
            ProductStatOut(name=name, qty=v["qty"], total=v["total"])
            for name, v in sorted(bucket["products"].items(), key=lambda kv: -kv[1]["total"])
        ]
        result.append(MonthlyStatOut(
            month=key,
            order_count=len(bucket["order_ids"]),
            total=sum(p.total for p in products),
            products=products,
        ))
    return result


@router.post("/sellers/me/orders/mark-viewed", status_code=status.HTTP_204_NO_CONTENT)
def mark_orders_viewed(
    seller: Seller = Depends(get_current_seller),
    session: Session = Depends(get_session),
):
    orders = session.exec(
        select(Order).where(Order.seller_id == seller.id, Order.status == OrderStatus.new)
    ).all()
    for o in orders:
        o.status = OrderStatus.viewed
        session.add(o)
    session.commit()
