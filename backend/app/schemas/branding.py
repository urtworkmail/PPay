from pydantic import BaseModel


class MerchantBrandingSummary(BaseModel):
    """Populated via `.model_validate(merchant_orm_object)` everywhere it's used —
    field names must match the Merchant model's attribute names exactly."""

    business_name: str
    logo_url: str | None = None
    brand_color: str | None = None
    enabled_payment_methods: list[str] = []
    checkout_terms_url: str | None = None
    checkout_privacy_url: str | None = None
    invoice_footer: str | None = None

    model_config = {"from_attributes": True}
