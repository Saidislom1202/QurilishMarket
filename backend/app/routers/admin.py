from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, func, or_, select

from ..config import settings
from ..database import get_session
from ..deps import require_admin
from ..models import Buyer, Order, Product, Seller, SellerMessage, SellerStatus, now_utc, seller_public_fields
from ..schemas import (
    AdminLoginIn,
    AdminStatsOut,
    AdminTokenOut,
    BlockSellerIn,
    SellerAdminOut,
    SellerMessageIn,
)
from ..security import create_token

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.post("/login", response_model=AdminTokenOut)
def login(data: AdminLoginIn):
    if data.username != settings.admin_username or data.password != settings.admin_password:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Login yoki parol noto'g'ri")
    token = create_token(0, "admin")
    return AdminTokenOut(token=token)


@router.get("/stats", response_model=AdminStatsOut, dependencies=[Depends(require_admin)])
def stats(session: Session = Depends(get_session)):
    def count(model) -> int:
        return session.exec(select(func.count()).select_from(model)).one()

    def count_sellers_with_status(s: SellerStatus) -> int:
        return session.exec(select(func.count()).select_from(Seller).where(Seller.status == s)).one()

    now = now_utc()
    blocked_count = session.exec(
        select(func.count()).select_from(Seller).where(
            Seller.is_blocked == True,  # noqa: E712
            or_(Seller.blocked_until == None, Seller.blocked_until > now),  # noqa: E711
        )
    ).one()

    return AdminStatsOut(
        total_buyers=count(Buyer),
        total_sellers=count(Seller),
        sellers_pending=count_sellers_with_status(SellerStatus.pending),
        sellers_approved=count_sellers_with_status(SellerStatus.approved),
        sellers_rejected=count_sellers_with_status(SellerStatus.rejected),
        sellers_blocked=blocked_count,
        total_products=count(Product),
        total_orders=count(Order),
    )


@router.get("/sellers", response_model=list[SellerAdminOut], dependencies=[Depends(require_admin)])
def list_sellers(status_filter: str | None = None, session: Session = Depends(get_session)):
    query = select(Seller)
    if status_filter:
        query = query.where(Seller.status == status_filter)
    sellers = session.exec(query.order_by(Seller.created_at.desc())).all()
    return [SellerAdminOut(**seller_public_fields(s)) for s in sellers]


@router.post("/sellers/{seller_id}/approve", response_model=SellerAdminOut, dependencies=[Depends(require_admin)])
def approve_seller(seller_id: int, session: Session = Depends(get_session)):
    seller = session.get(Seller, seller_id)
    if not seller:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sotuvchi topilmadi")
    seller.status = SellerStatus.approved
    session.add(seller)
    session.commit()
    session.refresh(seller)
    return SellerAdminOut(**seller_public_fields(seller))


@router.post("/sellers/{seller_id}/reject", response_model=SellerAdminOut, dependencies=[Depends(require_admin)])
def reject_seller(seller_id: int, session: Session = Depends(get_session)):
    seller = session.get(Seller, seller_id)
    if not seller:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sotuvchi topilmadi")
    seller.status = SellerStatus.rejected
    session.add(seller)
    session.commit()
    session.refresh(seller)
    return SellerAdminOut(**seller_public_fields(seller))


@router.post("/sellers/{seller_id}/block", response_model=SellerAdminOut, dependencies=[Depends(require_admin)])
def block_seller(seller_id: int, data: BlockSellerIn, session: Session = Depends(get_session)):
    seller = session.get(Seller, seller_id)
    if not seller:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sotuvchi topilmadi")
    seller.is_blocked = True
    seller.blocked_until = now_utc() + timedelta(days=data.days) if data.days else None
    seller.blocked_reason = data.reason.strip()
    session.add(seller)

    duration_note = f"{data.days} kunga" if data.days else "muddatsiz"
    session.add(SellerMessage(
        seller_id=seller.id,
        message=f"Do'koningiz {duration_note} bloklandi. Sabab: {data.reason.strip()}",
    ))
    session.commit()
    session.refresh(seller)
    return SellerAdminOut(**seller_public_fields(seller))


@router.post("/sellers/{seller_id}/unblock", response_model=SellerAdminOut, dependencies=[Depends(require_admin)])
def unblock_seller(seller_id: int, session: Session = Depends(get_session)):
    seller = session.get(Seller, seller_id)
    if not seller:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sotuvchi topilmadi")
    seller.is_blocked = False
    seller.blocked_until = None
    seller.blocked_reason = ""
    session.add(seller)
    session.add(SellerMessage(seller_id=seller.id, message="Do'koningiz blokdan chiqarildi."))
    session.commit()
    session.refresh(seller)
    return SellerAdminOut(**seller_public_fields(seller))


@router.post("/sellers/{seller_id}/message", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def message_seller(seller_id: int, data: SellerMessageIn, session: Session = Depends(get_session)):
    seller = session.get(Seller, seller_id)
    if not seller:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sotuvchi topilmadi")
    session.add(SellerMessage(seller_id=seller_id, message=data.message.strip()))
    session.commit()
