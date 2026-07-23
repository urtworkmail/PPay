from fastapi import APIRouter

from app.api.v1 import (
    audit_log,
    auth,
    checkout,
    customers,
    invoices,
    payment_links,
    platform_admin,
    products,
    search,
    settlements,
    subscriptions,
    team,
    transactions,
    webhooks,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(auth.merchants_router)
api_router.include_router(auth.users_router)
api_router.include_router(team.router)
api_router.include_router(checkout.router)
api_router.include_router(transactions.router)
api_router.include_router(webhooks.router)
api_router.include_router(settlements.router)
api_router.include_router(payment_links.router)
api_router.include_router(invoices.router)
api_router.include_router(customers.router)
api_router.include_router(search.router)
api_router.include_router(products.router)
api_router.include_router(subscriptions.router)
api_router.include_router(platform_admin.router)
api_router.include_router(audit_log.router)
