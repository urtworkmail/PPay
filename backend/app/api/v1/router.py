from fastapi import APIRouter

from app.api.v1 import auth, checkout, settlements, transactions, webhooks

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(auth.merchants_router)
api_router.include_router(checkout.router)
api_router.include_router(transactions.router)
api_router.include_router(webhooks.router)
api_router.include_router(settlements.router)
