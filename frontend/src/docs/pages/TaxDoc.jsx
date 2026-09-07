import CodeBlock from "../CodeBlock";
import { Callout, DocsTable, H2, P } from "../DocsKit";

export default function TaxDoc() {
  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>Tax</h1>
      <P>
        Two structurally different figures, computed separately: <strong>Sales Tax on Services</strong> owed on
        PPay's own platform fee, and your <strong>estimated withholding tax</strong> exposure on gross volume.
      </P>

      <Callout tone="warn">
        These are estimates from published provincial rates, not filing advice. PPay doesn't file or remit tax on
        your behalf — confirm current rates with your revenue authority or a tax advisor before filing.
      </Callout>

      <H2 id="rates">Sales Tax on Services rates</H2>
      <P>Pakistan taxes services provincially — there's no federal sales tax on services.</P>
      <DocsTable
        headers={["Province / territory", "Authority"]}
        rows={[
          ["Punjab", "Punjab Revenue Authority (PRA)"],
          ["Sindh", "Sindh Revenue Board (SRB)"],
          ["Khyber Pakhtunkhwa", "Khyber Pakhtunkhwa Revenue Authority (KPRA)"],
          ["Balochistan", "Balochistan Revenue Authority (BRA)"],
          ["Islamabad Capital Territory", "FBR"],
        ]}
      />

      <H2 id="settings">Set your registration</H2>
      <CodeBlock
        samples={{
          cURL: `curl https://app.ppay.silicatelabs.site/api/v1/merchants/me/tax \\
  -X PATCH \\
  -H "Authorization: Bearer sk_sandbox_..." \\
  -H "Content-Type: application/json" \\
  -d '{"tax_province": "sindh", "tax_filer_status": "filer"}'`,
        }}
      />

      <H2 id="report">Get the report</H2>
      <CodeBlock
        samples={{
          cURL: `curl "https://app.ppay.silicatelabs.site/api/v1/merchants/me/tax/summary?period_days=365" \\
  -H "Authorization: Bearer sk_sandbox_..."`,
        }}
      />
      <P>
        Before you set a province or filer status, the corresponding figures return <code className="mono">null</code> —
        there's nothing to compute them against yet, so the API doesn't guess.
      </P>
    </div>
  );
}
