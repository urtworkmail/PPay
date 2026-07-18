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
};

export default function StatusBadge({ status }) {
  const variant = VARIANT_BY_STATUS[status] ?? "badge-neutral";
  return (
    <span className={`badge ${variant}`} style={{ textTransform: "capitalize" }}>
      {status.replace("_", " ")}
    </span>
  );
}
