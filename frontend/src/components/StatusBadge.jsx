const VARIANT_BY_STATUS = {
  succeeded: "badge-success",
  paid: "badge-success",
  delivered: "badge-success",
  active: "badge-success",
  failed: "badge-danger",
  expired: "badge-danger",
  cancelled: "badge-danger",
  canceled: "badge-danger",
  unpaid: "badge-danger",
  past_due: "badge-pending",
  pending: "badge-pending",
  authorizing: "badge-pending",
  created: "badge-neutral",
  incomplete: "badge-neutral",
  requires_reconciliation: "badge-pending",
};

const LABEL_OVERRIDE = {
  // The rail never responded — we're checking, not declining. Must read as
  // "we're on it," never as a failure, per architecture spec §13.6.
  requires_reconciliation: "Checking payment",
};

export default function StatusBadge({ status }) {
  const variant = VARIANT_BY_STATUS[status] ?? "badge-neutral";
  const label = LABEL_OVERRIDE[status] ?? status.replace("_", " ");
  return (
    <span className={`badge ${variant}`} style={{ textTransform: "capitalize" }} title={LABEL_OVERRIDE[status] ? "The payment rail didn't respond in time — we're reconciling this automatically, it hasn't failed." : undefined}>
      {label}
    </span>
  );
}
