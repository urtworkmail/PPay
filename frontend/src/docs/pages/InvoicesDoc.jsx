import CodeBlock from "../CodeBlock";
import { DocsTable, H2, P } from "../DocsKit";

export default function InvoicesDoc() {
  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>Invoices</h1>
      <P>
        An Invoice is a one-off bill you send to a specific, named customer — useful when you know exactly who owes
        you money and how much, outside of a normal checkout flow (a wholesale order, a service you already
        delivered, a subscription renewal charge).
      </P>

      <H2 id="create">Create an invoice</H2>
      <CodeBlock
        samples={{
          cURL: `curl https://api.ppay.dev/api/v1/invoices \\
  -X POST \\
  -H "Authorization: Bearer sk_sandbox_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_name": "Zainab Traders",
    "customer_email": "billing@zainabtraders.example",
    "amount_minor": 5000000,
    "description": "September wholesale order",
    "due_date": "2026-09-30T00:00:00Z"
  }'`,
        }}
      />
      <P>An invoice is created in <code className="mono">sent</code> status — there's no draft workflow, it goes out immediately with a hosted pay link.</P>

      <H2 id="lifecycle">Lifecycle</H2>
      <DocsTable
        headers={["Status", "Meaning"]}
        rows={[
          ["sent", "Awaiting payment. The hosted link is live."],
          ["paid", "Payment succeeded — see the linked Transaction on the invoice detail page."],
          ["cancelled", "You cancelled it before payment. Can't be paid after this."],
        ]}
      />
      <P>
        <code className="mono">POST /api/v1/invoices/&#123;id&#125;/cancel</code> cancels a <code className="mono">sent</code> invoice.
        A <code className="mono">paid</code> invoice can never be cancelled.
      </P>

      <H2 id="subscription-invoices">Subscription-generated invoices</H2>
      <P>
        Every subscription billing cycle — the first charge and every renewal — generates an Invoice under the hood,
        with <code className="mono">billing_reason</code> set to <code className="mono">subscription_first</code> or{" "}
        <code className="mono">subscription_cycle</code> and <code className="mono">subscription_id</code> pointing
        back to the subscription. These follow the exact same pay pipeline as a manually created invoice — there's
        no separate code path for subscription billing. See <a href="/docs/subscriptions">Subscriptions</a>.
      </P>
    </div>
  );
}
