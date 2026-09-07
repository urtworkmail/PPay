import CodeBlock from "../CodeBlock";
import { H2, P } from "../DocsKit";

export default function AnalyticsDoc() {
  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>Analytics</h1>
      <P>
        Trends and comparisons behind the Overview page's snapshot — same underlying transaction data, aggregated
        differently. No separate data source, no delay.
      </P>

      <H2 id="endpoint">Fetch analytics</H2>
      <CodeBlock
        samples={{
          cURL: `curl "https://app.ppay.silicatelabs.site/api/v1/dashboard/payments-analytics?period_days=30" \\
  -H "Authorization: Bearer sk_sandbox_..."`,
        }}
      />

      <H2 id="what-you-get">What you get</H2>
      <P>
        Daily success-rate, average-order-value, and refund-rate trends; a breakdown by payment method (card,
        wallet, bank transfer) with per-method success rates; an hourly activity histogram; and period-over-period
        comparisons — this window against the immediately preceding window of equal length.
      </P>

      <H2 id="null-vs-zero">Null vs. zero</H2>
      <P>
        A day or period with no transactions returns <code className="mono">null</code> for its rate, not{" "}
        <code className="mono">0</code> — a 0% success rate and "nothing happened" are different claims, and the
        response shape keeps that distinction so you don't have to guess which one you're looking at.
      </P>
    </div>
  );
}
