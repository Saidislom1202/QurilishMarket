from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, or_, select

from ..database import get_session
from ..deps import get_current_seller
from ..models import Product, Seller, SellerStatus, is_effectively_blocked, now_utc
from ..schemas import ProductCreateIn, ProductOut, ShopOut

router = APIRouter(prefix="/api", tags=["products"])


def _not_blocked(query):
    # Bloklanmagan, YOKI vaqtinchalik blok muddati allaqachon tugagan sotuvchilar
    now = now_utc()
    return query.where(
        or_(Seller.is_blocked == False, (Seller.blocked_until != None) & (Seller.blocked_until <= now))  # noqa: E712,E711
    )


def _discount(price: int, old_price: int | None) -> str | None:
    if old_price and old_price > price:
        return f"-{round((1 - price / old_price) * 100)}%"
    return None


def _to_product_out(product: Product, seller: Seller) -> ProductOut:
    return ProductOut(
        id=product.id,
        seller_id=product.seller_id,
        seller=seller.shop_name,
        name=product.name,
        category=product.category,
        price=product.price,
        unit=product.unit,
        old=product.old_price,
        discount=_discount(product.price, product.old_price),
        rating=product.rating,
        image=product.image_url,
    )


# ---------- Public ----------

@router.get("/products", response_model=list[ProductOut])
def list_products(
    category: str | None = None,
    search: str | None = None,
    session: Session = Depends(get_session),
):
    query = select(Product, Seller).join(Seller).where(Seller.status == SellerStatus.approved)
    query = _not_blocked(query)
    if category and category not in ("all", "sale"):
        query = query.where(Product.category == category)
    rows = session.exec(query).all()

    results = [_to_product_out(p, s) for p, s in rows]
    if category == "sale":
        results = [r for r in results if r.discount]
    if search:
        term = search.strip().lower()
        results = [r for r in results if term in r.name.lower() or term in r.seller.lower()]
    return results


@router.get("/shops", response_model=list[ShopOut])
def list_shops(region: str | None = None, session: Session = Depends(get_session)):
    query = select(Seller).where(Seller.status == SellerStatus.approved)
    query = _not_blocked(query)
    if region:
        query = query.where(Seller.region == region)
    sellers = session.exec(query).all()
    return [
        ShopOut(
            id=s.id,
            initials=(s.shop_name or "??").strip()[:2].upper(),
            name=s.shop_name,
            rating="5.0",
            reviews="0",
            place=s.region,
            region=s.region,
        )
        for s in sellers
    ]


# ---------- Seller-owned products ----------

@router.get("/sellers/me/products", response_model=list[ProductOut])
def my_products(
    seller: Seller = Depends(get_current_seller),
    session: Session = Depends(get_session),
):
    products = session.exec(select(Product).where(Product.seller_id == seller.id)).all()
    return [_to_product_out(p, seller) for p in products]


@router.post("/sellers/me/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    data: ProductCreateIn,
    seller: Seller = Depends(get_current_seller),
    session: Session = Depends(get_session),
):
    if seller.status != SellerStatus.approved:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Do'koningiz hali admin tomonidan tasdiqlanmagan.",
        )
    if is_effectively_blocked(seller):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Do'koningiz bloklangan, mahsulot qo'sha olmaysiz.",
        )
    product = Product(
        seller_id=seller.id,
        name=data.name.strip(),
        category=data.category,
        price=data.price,
        unit=data.unit.strip(),
        old_price=data.old_price,
        image_url=data.image_url,
    )
    session.add(product)
    session.commit()
    session.refresh(product)
    return _to_product_out(product, seller)


@router.delete("/sellers/me/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    seller: Seller = Depends(get_current_seller),
    session: Session = Depends(get_session),
):
    product = session.get(Product, product_id)
    if not product or product.seller_id != seller.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mahsulot topilmadi")
    session.delete(product)
    session.commit()
