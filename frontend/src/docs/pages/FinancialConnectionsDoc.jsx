import CodeBlock from "../CodeBlock";
import { Callout, H2, P } from "../DocsKit";

export default function FinancialConnectionsDoc() {
  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>Financial Connections</h1>
      <P>
        Proves you control the bank account your payouts are sent to, via micro-deposit verification — the same
        mechanism major payment platforms use for real ACH verification. Not a third-party bank-aggregator
        integration; none broadly exists to connect to for Pakistani banks yet.
      </P>

      <H2 id="start">Start verification</H2>
      <CodeBlock
        samples={{
          cURL: `curl https://app.ppay.silicatelabs.site/api/v1/merchants/me/financial-connections/start \\
  -X POST \\
  -H "Authorization: Bearer sk_sandbox_..."`,
        }}
      />
      <P>
        Two small amounts (1–99, sub-currency-unit) are sent. In a live deployment they'd only appear on your real
        bank statement after 1–2 business days. In sandbox mode, they're included directly in the notification you
        receive — there's no real bank behind a sandbox account to wait on.
      </P>

      <H2 id="confirm">Confirm</H2>
      <CodeBlock
        samples={{
          cURL: `curl https://app.ppay.silicatelabs.site/api/v1/merchants/me/financial-connections/confirm \\
  -X POST \\
  -H "Authorization: Bearer sk_sandbox_..." \\
  -H "Content-Type: application/json" \\
  -d '{"amount_1": 20, "amount_2": 3}'`,
        }}
      />

      <Callout tone="info">
        5 attempts per verification. Changing your payout bank account number resets verification automatically —
        a different account has proven nothing about who controls it.
      </Callout>
    </div>
  );
}
