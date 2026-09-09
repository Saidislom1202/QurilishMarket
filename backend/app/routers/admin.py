from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, func, select

from ..config import settings
from ..database import get_session
from ..deps import require_admin
from ..models import Buyer, Order, Product, Seller, SellerStatus
from ..schemas import AdminLoginIn, AdminStatsOut, AdminTokenOut, SellerAdminOut
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

    return AdminStatsOut(
        total_buyers=count(Buyer),
        total_sellers=count(Seller),
        sellers_pending=count_sellers_with_status(SellerStatus.pending),
        sellers_approved=count_sellers_with_status(SellerStatus.approved),
        sellers_rejected=count_sellers_with_status(SellerStatus.rejected),
        total_products=count(Product),
        total_orders=count(Order),
    )


@router.get("/sellers", response_model=list[SellerAdminOut], dependencies=[Depends(require_admin)])
def list_sellers(status_filter: str | None = None, session: Session = Depends(get_session)):
    query = select(Seller)
    if status_filter:
        query = query.where(Seller.status == status_filter)
    sellers = session.exec(query.order_by(Seller.created_at.desc())).all()
    return [SellerAdminOut(**s.model_dump()) for s in sellers]


@router.post("/sellers/{seller_id}/approve", response_model=SellerAdminOut, dependencies=[Depends(require_admin)])
def approve_seller(seller_id: int, session: Session = Depends(get_session)):
    seller = session.get(Seller, seller_id)
    if not seller:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sotuvchi topilmadi")
    seller.status = SellerStatus.approved
    session.add(seller)
    session.commit()
    session.refresh(seller)
    return SellerAdminOut(**seller.model_dump())


@router.post("/sellers/{seller_id}/reject", response_model=SellerAdminOut, dependencies=[Depends(require_admin)])
def reject_seller(seller_id: int, session: Session = Depends(get_session)):
    seller = session.get(Seller, seller_id)
    if not seller:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sotuvchi topilmadi")
    seller.status = SellerStatus.rejected
    session.add(seller)
    session.commit()
    session.refresh(seller)
    return SellerAdminOut(**seller.model_dump())
