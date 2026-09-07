from datetime import datetime

from pydantic import BaseModel, Field


class TaxSettingsUpdateRequest(BaseModel):
    national_tax_number: str | None = Field(default=None, max_length=32)
    sales_tax_registration_number: str | None = Field(default=None, max_length=32)
    tax_filer_status: str = Field(default="unknown")
    tax_province: str | None = None


class TaxSettingsResponse(BaseModel):
    national_tax_number: str | None
    sales_tax_registration_number: str | None
    tax_filer_status: str
    tax_province: str | None


class TaxSummaryResponse(BaseModel):
    period_start: datetime
    period_end: datetime
    currency: str

    gross_volume_minor: int
    platform_fee_minor: int

    province: str | None
    sales_tax_rate_bps: int | None
    sales_tax_minor: int | None

    filer_status: str
    withholding_tax_rate_bps: int
    estimated_withholding_tax_minor: int | None

    transaction_count: int
    is_estimate: bool

    model_config = {"from_attributes": True}
