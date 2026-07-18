import PageHeader from "../components/PageHeader";

export default function SettingsPlansFees() {
  return (
    <div>
      <PageHeader backTo="/dashboard/settings" title="Plans and fees" subtitle="Your current transaction fee schedule." />

      <div className="card" style={{ padding: 22, maxWidth: 480 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Standard processing fee</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>2.90%</div>
        </div>
        <p style={{ fontSize: 13, color: "var(--color-text-muted)", margin: 0 }}>
          Charged per successful transaction, deducted before settlement. No fixed per-transaction fee, no monthly
          minimums, no setup fees.
        </p>
      </div>

      <p style={{ fontSize: 12, color: "var(--color-text-faint)", marginTop: 16, maxWidth: 480 }}>
        This is the sandbox fee model — illustrative for the demo, not a finalized commercial rate.
      </p>
    </div>
  );
}
