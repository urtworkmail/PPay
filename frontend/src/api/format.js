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

const RELATIVE_UNITS = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

// "3 min ago" reads better than a timestamp in a notification feed, but only
// while it's recent — past a week the absolute date is what's actually useful.
export function formatRelativeTime(isoString) {
  if (!isoString) return "—";
  const then = new Date(isoString);
  const seconds = (Date.now() - then.getTime()) / 1000;

  if (seconds < 45) return "just now";
  if (seconds > 604800) {
    return then.toLocaleDateString("en-PK", { dateStyle: "medium" });
  }

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, unitSeconds] of RELATIVE_UNITS) {
    if (seconds >= unitSeconds) {
      return formatter.format(-Math.floor(seconds / unitSeconds), unit);
    }
  }
  return "just now";
}
