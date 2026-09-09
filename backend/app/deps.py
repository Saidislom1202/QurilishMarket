from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from .database import get_session
from .models import Buyer, Seller
from .security import decode_token

bearer_scheme = HTTPBearer(auto_error=False)


def _get_payload(creds: HTTPAuthorizationCredentials | None) -> dict:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Kirish talab qilinadi")
    payload = decode_token(creds.credentials)
    if payload is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token yaroqsiz yoki muddati o'tgan")
    return payload


def get_current_buyer(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: Session = Depends(get_session),
) -> Buyer:
    payload = _get_payload(creds)
    if payload.get("role") != "buyer":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Ruxsat yo'q")
    buyer = session.get(Buyer, int(payload["sub"]))
    if buyer is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Hisob topilmadi")
    return buyer


def get_current_seller(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: Session = Depends(get_session),
) -> Seller:
    payload = _get_payload(creds)
    if payload.get("role") != "seller":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Ruxsat yo'q")
    seller = session.get(Seller, int(payload["sub"]))
    if seller is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Hisob topilmadi")
    return seller


def require_admin(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> None:
    payload = _get_payload(creds)
    if payload.get("role") != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Ruxsat yo'q")
