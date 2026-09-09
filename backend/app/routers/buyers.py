from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from ..database import get_session
from ..deps import get_current_buyer
from ..models import Buyer
from ..schemas import BuyerAuthOut, BuyerLoginIn, BuyerOut, BuyerRegisterIn, BuyerUpdateIn
from ..security import create_token, hash_password, verify_password

router = APIRouter(prefix="/api/buyers", tags=["buyers"])


@router.post("/register", response_model=BuyerAuthOut)
def register(data: BuyerRegisterIn, session: Session = Depends(get_session)):
    phone = data.phone.strip()
    existing = session.exec(select(Buyer).where(Buyer.phone == phone)).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu telefon raqam bilan hisob allaqachon mavjud.")

    buyer = Buyer(
        name=data.name.strip(),
        phone=phone,
        email=data.email.strip(),
        region=data.region,
        password_hash=hash_password(data.password),
    )
    session.add(buyer)
    session.commit()
    session.refresh(buyer)
    token = create_token(buyer.id, "buyer")
    return BuyerAuthOut(token=token, buyer=BuyerOut(**buyer.model_dump()))


@router.post("/login", response_model=BuyerAuthOut)
def login(data: BuyerLoginIn, session: Session = Depends(get_session)):
    buyer = session.exec(select(Buyer).where(Buyer.phone == data.phone.strip())).first()
    if not buyer or not verify_password(data.password, buyer.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Telefon raqam yoki parol noto'g'ri.")
    token = create_token(buyer.id, "buyer")
    return BuyerAuthOut(token=token, buyer=BuyerOut(**buyer.model_dump()))


@router.get("/me", response_model=BuyerOut)
def me(buyer: Buyer = Depends(get_current_buyer)):
    return BuyerOut(**buyer.model_dump())


@router.put("/me", response_model=BuyerOut)
def update_me(
    data: BuyerUpdateIn,
    buyer: Buyer = Depends(get_current_buyer),
    session: Session = Depends(get_session),
):
    phone = data.phone.strip()
    clash = session.exec(select(Buyer).where(Buyer.phone == phone, Buyer.id != buyer.id)).first()
    if clash:
        raise HTTPException(status.HTTP_409_CONFLICT, "Bu telefon raqam boshqa hisobda band.")

    buyer.name = data.name.strip()
    buyer.phone = phone
    buyer.email = data.email.strip()
    buyer.region = data.region
    session.add(buyer)
    session.commit()
    session.refresh(buyer)
    return BuyerOut(**buyer.model_dump())
