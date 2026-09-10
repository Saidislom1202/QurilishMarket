from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..database import get_session
from ..deps import get_current_seller
from ..models import Seller, SellerMessage, ensure_utc, seller_public_fields
from ..schemas import (
    SellerAuthOut,
    SellerLoginIn,
    SellerMessageOut,
    SellerOut,
    SellerRegisterIn,
    SellerUpdateIn,
)
from ..security import create_token, hash_password, verify_password

router = APIRouter(prefix="/api/sellers", tags=["sellers"])


@router.post("/register", response_model=SellerAuthOut)
def register(data: SellerRegisterIn, session: Session = Depends(get_session)):
    phone = data.phone.strip()
    existing = session.exec(select(Seller).where(Seller.phone == phone)).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu telefon raqam bilan do'kon allaqachon mavjud.")

    seller = Seller(
        shop_name=data.shop_name.strip(),
        owner_name=data.owner_name.strip(),
        phone=phone,
        email=data.email.strip(),
        region=data.region,
        password_hash=hash_password(data.password),
    )
    session.add(seller)
    session.commit()
    session.refresh(seller)
    token = create_token(seller.id, "seller")
    return SellerAuthOut(token=token, seller=SellerOut(**seller_public_fields(seller)))


@router.post("/login", response_model=SellerAuthOut)
def login(data: SellerLoginIn, session: Session = Depends(get_session)):
    seller = session.exec(select(Seller).where(Seller.phone == data.phone.strip())).first()
    if not seller or not verify_password(data.password, seller.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Telefon raqam yoki parol noto'g'ri.")
    token = create_token(seller.id, "seller")
    return SellerAuthOut(token=token, seller=SellerOut(**seller_public_fields(seller)))


@router.get("/me", response_model=SellerOut)
def me(seller: Seller = Depends(get_current_seller)):
    return SellerOut(**seller_public_fields(seller))


@router.put("/me", response_model=SellerOut)
def update_me(
    data: SellerUpdateIn,
    seller: Seller = Depends(get_current_seller),
    session: Session = Depends(get_session),
):
    phone = data.phone.strip()
    clash = session.exec(select(Seller).where(Seller.phone == phone, Seller.id != seller.id)).first()
    if clash:
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu telefon raqam boshqa hisobda band.")

    seller.shop_name = data.shop_name.strip()
    seller.owner_name = data.owner_name.strip()
    seller.phone = phone
    seller.email = data.email.strip()
    seller.region = data.region
    session.add(seller)
    session.commit()
    session.refresh(seller)
    return SellerOut(**seller_public_fields(seller))


@router.get("/me/messages", response_model=list[SellerMessageOut])
def my_messages(
    seller: Seller = Depends(get_current_seller),
    session: Session = Depends(get_session),
):
    messages = session.exec(
        select(SellerMessage).where(SellerMessage.seller_id == seller.id).order_by(SellerMessage.created_at.desc())
    ).all()
    return [SellerMessageOut(**{**m.model_dump(), "created_at": ensure_utc(m.created_at)}) for m in messages]


@router.post("/me/messages/mark-read", status_code=status.HTTP_204_NO_CONTENT)
def mark_messages_read(
    seller: Seller = Depends(get_current_seller),
    session: Session = Depends(get_session),
):
    messages = session.exec(
        select(SellerMessage).where(SellerMessage.seller_id == seller.id, SellerMessage.read == False)  # noqa: E712
    ).all()
    for m in messages:
        m.read = True
        session.add(m)
    session.commit()
