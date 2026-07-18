import { formatMinorAmount } from "../api/format";

function BrandMark({ merchant }) {
  if (merchant?.logo_url) {
    return (
      <img
        src={merchant.logo_url}
        alt={merchant.business_name}
        style={{ height: 36, maxWidth: 180, objectFit: "contain", marginBottom: 28 }}
        onError={(e) => {
          e.target.style.display = "none";
        }}
      />
    );
  }
  const initial = (merchant?.business_name || "P")[0].toUpperCase();
  return (
    <div
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        background: "rgba(255,255,255,0.18)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 17,
        marginBottom: 28,
      }}
    >
      {initial}
    </div>
  );
}

export default function CheckoutShell({ merchant, description, amountMinor, currency, badge, children }) {
  const brandColor = merchant?.brand_color || "#635bff";

  return (
    <div className="checkout-shell">
      <div className="checkout-shell-left" style={{ background: brandColor, color: "white" }}>
        <div style={{ maxWidth: 360, margin: "0 auto", width: "100%" }}>
          <BrandMark merchant={merchant} />
          <div style={{ fontSize: 14, opacity: 0.85, fontWeight: 500 }}>{merchant?.business_name || "PPay"}</div>
          {description && (
            <div style={{ fontSize: 15, opacity: 0.75, marginTop: 6, maxWidth: 320 }}>{description}</div>
          )}
          {amountMinor != null && (
            <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 20 }}>
              {formatMinorAmount(amountMinor, currency)}
            </div>
          )}
          {badge && (
            <span
              className="badge"
              style={{ marginTop: 16, background: "rgba(255,255,255,0.16)", color: "white", display: "inline-flex" }}
            >
              {badge}
            </span>
          )}
        </div>
      </div>

      <div className="checkout-shell-right">
        <div style={{ width: "100%", maxWidth: 420 }}>{children}</div>
      </div>
    </div>
  );
}
