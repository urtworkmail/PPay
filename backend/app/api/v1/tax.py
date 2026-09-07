from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_merchant, require_role
from app.core.db import get_db
from app.models.merchant import Merchant, TaxFilerStatus, TaxProvince
from app.models.user import User, UserRole
from app.schemas.tax import TaxSettingsResponse, TaxSettingsUpdateRequest, TaxSummaryResponse
from app.services.audit_log import record_audit_event
from app.services.tax_calculator import get_tax_summary

router = APIRouter(prefix="/merchants/me/tax", tags=["tax"])

VALID_PERIODS = {7, 30, 90, 365}


@router.get("", response_model=TaxSettingsResponse)
async def get_tax_settings(merchant: Merchant = Depends(get_current_merchant)) -> Merchant:
    return merchant


@router.patch("", response_model=TaxSettingsResponse)
async def update_tax_settings(
    payload: TaxSettingsUpdateRequest,
    merchant: Merchant = Depends(get_current_merchant),
    _: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
) -> Merchant:
    try:
        filer_status = TaxFilerStatus(payload.tax_filer_status)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tax_filer_status") from exc

    province = None
    if payload.tax_province:
        try:
            province = TaxProvince(payload.tax_province)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid tax_province") from exc

    merchant.national_tax_number = payload.national_tax_number
    merchant.sales_tax_registration_number = payload.sales_tax_registration_number
    merchant.tax_filer_status = filer_status
    merchant.tax_province = province

    await record_audit_event(
        db,
        merchant_id=merchant.id,
        action="update",
        resource_type="tax_settings",
        changes={"tax_filer_status": filer_status.value, "tax_province": province.value if province else None},
    )
    await db.commit()
    await db.refresh(merchant)
    return merchant


@router.get("/summary", response_model=TaxSummaryResponse)
async def tax_summary(
    period_days: int = Query(default=30),
    merchant: Merchant = Depends(get_current_merchant),
    db: AsyncSession = Depends(get_db),
) -> TaxSummaryResponse:
    if period_days not in VALID_PERIODS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="period_days must be one of 7, 30, 90, 365")
    summary = await get_tax_summary(db, merchant, period_days)
    return TaxSummaryResponse(
        period_start=summary.period_start,
        period_end=summary.period_end,
        currency=summary.currency,
        gross_volume_minor=summary.gross_volume_minor,
        platform_fee_minor=summary.platform_fee_minor,
        province=summary.province.value if summary.province else None,
        sales_tax_rate_bps=summary.sales_tax_rate_bps,
        sales_tax_minor=summary.sales_tax_minor,
        filer_status=summary.filer_status.value,
        withholding_tax_rate_bps=summary.withholding_tax_rate_bps,
        estimated_withholding_tax_minor=summary.estimated_withholding_tax_minor,
        transaction_count=summary.transaction_count,
        is_estimate=summary.is_estimate,
    )
