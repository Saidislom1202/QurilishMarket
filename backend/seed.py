"""Faqat lokal ishlab chiqish/test uchun. Productionga hech qachon ishga tushirilmasin —
haqiqiy xaridorlarga soxta do'kon/mahsulotlarni ko'rsatish noto'g'ri bo'lardi.

Ishga tushirish: venv/Scripts/python.exe seed.py
"""

from app.database import engine, init_db
from app.models import Product, Seller, SellerStatus
from app.security import hash_password
from sqlmodel import Session, select

DEMO_SELLERS = [
    {
        "shop_name": "StroyMarket Do'koni",
        "owner_name": "Test Sotuvchi",
        "phone": "998900000001",
        "email": "stroymarket@example.com",
        "region": "Toshkent shahri",
        "products": [
            {"name": "Qizil G'isht M-150", "category": "brick", "price": 405, "unit": "dona", "old_price": 450, "rating": 318, "image_url": "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&w=700&q=80"},
            {"name": "Portland Sement M-400", "category": "brick", "price": 85000, "unit": "qop", "rating": 512, "image_url": "https://images.unsplash.com/photo-1622986100671-d32e613d4790?auto=format&fit=crop&w=700&q=80"},
        ],
    },
    {
        "shop_name": "Ustalar Makoni",
        "owner_name": "Test Sotuvchi",
        "phone": "998900000002",
        "email": "ustalar@example.com",
        "region": "Toshkent shahri",
        "products": [
            {"name": "Gazobeton Blok D-500", "category": "brick", "price": 20900, "unit": "dona", "old_price": 22000, "rating": 204, "image_url": "https://images.unsplash.com/photo-1541971875076-8f970d573be6?auto=format&fit=crop&w=700&q=80"},
        ],
    },
    {
        "shop_name": "QurilishPro",
        "owner_name": "Test Sotuvchi",
        "phone": "998900000003",
        "email": "qurilishpro@example.com",
        "region": "Samarqand viloyati",
        "products": [
            {"name": "PVC Quvur 110 mm", "category": "plumbing", "price": 35000, "unit": "metr", "rating": 89, "image_url": "https://images.unsplash.com/photo-1595844730298-b96066c6b7e1?auto=format&fit=crop&w=700&q=80"},
            {"name": "Knauf Gips Shtukaturka", "category": "paint", "price": 43240, "unit": "qop", "old_price": 47000, "rating": 342, "image_url": "https://images.unsplash.com/photo-1574359411659-15573a27fd0c?auto=format&fit=crop&w=700&q=80"},
        ],
    },
]

DEMO_PASSWORD = "demo12345"


def run():
    init_db()
    with Session(engine) as session:
        for entry in DEMO_SELLERS:
            existing = session.exec(select(Seller).where(Seller.phone == entry["phone"])).first()
            if existing:
                print(f"skip (already exists): {entry['shop_name']}")
                continue

            seller = Seller(
                shop_name=entry["shop_name"],
                owner_name=entry["owner_name"],
                phone=entry["phone"],
                email=entry["email"],
                region=entry["region"],
                password_hash=hash_password(DEMO_PASSWORD),
                status=SellerStatus.approved,
            )
            session.add(seller)
            session.commit()
            session.refresh(seller)

            for p in entry["products"]:
                session.add(Product(seller_id=seller.id, **p))
            session.commit()
            print(f"created: {entry['shop_name']} (phone={entry['phone']}, password={DEMO_PASSWORD})")


if __name__ == "__main__":
    run()
