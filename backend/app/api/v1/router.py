from fastapi import APIRouter

from app.api.v1 import (
    audit_log,
    auth,
    checkout,
    customers,
    disputes,
    financial_connections,
    invoices,
    notifications,
    payment_links,
    platform_admin,
    products,
    search,
    settlements,
    status,
    subscriptions,
    tax,
    team,
    transactions,
    events,
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
api_router.include_router(events.router)
api_router.include_router(settlements.router)
api_router.include_router(payment_links.router)
api_router.include_router(invoices.router)
api_router.include_router(customers.router)
api_router.include_router(search.router)
api_router.include_router(products.router)
api_router.include_router(subscriptions.router)
api_router.include_router(platform_admin.router)
api_router.include_router(audit_log.router)
api_router.include_router(disputes.router)
api_router.include_router(financial_connections.router)
api_router.include_router(tax.router)
api_router.include_router(notifications.router)
api_router.include_router(status.router)
api_router.include_router(status.admin_router)
