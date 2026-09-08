import { Link } from "react-router-dom";
import CodeBlock from "../CodeBlock";
import { Callout, H2, P } from "../DocsKit";

export default function PaymentLinksDoc() {
  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>Payment Links</h1>
      <P>
        A Payment Link is a hosted, shareable URL that takes a customer straight to checkout for a specific price —
        no integration required. Send it in a chat message, an invoice, a social post, anywhere.
      </P>

      <Callout tone="info">
        Payment Links are always created from a <Link to="/docs/products-and-prices">Product's Price</Link>, the
        same way most modern payment platforms require. This keeps every link tied to something you can report on, and keeps the amount
        immutable once shared.
      </Callout>

      <H2 id="create">Create a link</H2>
      <P>
        In the dashboard: create a Product with a one-time price (Payment Links can't be built from a recurring
        price — that's what Subscriptions are for), then either use <strong>Payment Links → New link</strong> or, on
        the product's page, click <strong>Create link</strong> next to a specific price.
      </P>
      <CodeBlock
        samples={{
          cURL: `curl https://api.ppay.dev/api/v1/payment-links \\
  -X POST \\
  -H "Authorization: Bearer sk_sandbox_..." \\
  -H "Content-Type: application/json" \\
  -d '{"price_id": "b4f0e6a2-..."}'`,
        }}
      />
      <P>
        The link copies the price's amount and the product's name/description onto itself at creation time. If you
        later deactivate that price, links already shared keep working exactly as they were — only new links can't
        be created from a deactivated price.
      </P>

      <H2 id="share">Sharing it</H2>
      <P>
        The response includes a <code className="mono">url</code> like <code className="mono">https://yourppay.example/pay/&lt;id&gt;</code>. Opening it creates a fresh Checkout Session behind the scenes and takes the customer straight to the branded checkout page — there's no separate "click to continue" step.
      </P>

      <H2 id="tracking">What you get back</H2>
      <P>
        Every Payment Link tracks <code className="mono">usage_count</code> (checkout sessions created from it) and
        a distinct-customer count. Open any link in the dashboard to see every transaction it produced, each linked
        straight through to the paying customer's full profile.
      </P>

      <H2 id="deactivate">Deactivating a link</H2>
      <P>
        <code className="mono">DELETE /api/v1/payment-links/&#123;id&#125;</code> deactivates it — it stops accepting new
        payments immediately, but existing transaction history is untouched.
      </P>
    </div>
  );
}
