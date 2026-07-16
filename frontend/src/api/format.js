export function formatMinorAmount(amountMinor, currency) {
  const major = amountMinor / 100;
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  }).format(major);
}

export function formatDate(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
