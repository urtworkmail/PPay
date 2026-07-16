const VARIANT_BY_STATUS = {
  succeeded: "badge-success",
  paid: "badge-success",
  delivered: "badge-success",
  active: "badge-success",
  failed: "badge-danger",
  expired: "badge-danger",
  cancelled: "badge-danger",
  pending: "badge-pending",
  authorizing: "badge-pending",
  created: "badge-neutral",
};

export default function StatusBadge({ status }) {
  const variant = VARIANT_BY_STATUS[status] ?? "badge-neutral";
  return <span className={`badge ${variant}`}>{status.replace("_", " ")}</span>;
}
