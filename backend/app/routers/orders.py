from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..database import get_session
from ..deps import get_current_seller
from ..models import Order, OrderItem, OrderStatus, Product, Seller, SellerStatus, is_effectively_blocked
from ..schemas import MonthlyStatOut, OrderCreateIn, OrderCreateResult, OrderItemOut, OrderOut

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
                created_at=o.created_at,
                items=[OrderItemOut(name=i.name, qty=i.qty, price=i.price) for i in items],
            )
        )
    return result


@router.get("/sellers/me/stats", response_model=list[MonthlyStatOut])
def my_monthly_stats(
    seller: Seller = Depends(get_current_seller),
    session: Session = Depends(get_session),
):
    orders = session.exec(select(Order).where(Order.seller_id == seller.id)).all()
    monthly: dict[str, dict[str, int]] = defaultdict(lambda: {"order_count": 0, "total": 0})
    for o in orders:
        key = o.created_at.strftime("%Y-%m")
        monthly[key]["order_count"] += 1
        monthly[key]["total"] += o.total

    months = sorted(monthly.keys(), reverse=True)[:12]
    return [MonthlyStatOut(month=m, order_count=monthly[m]["order_count"], total=monthly[m]["total"]) for m in months]


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
