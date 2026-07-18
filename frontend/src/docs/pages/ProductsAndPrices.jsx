import CodeBlock from "../CodeBlock";
import { Callout, DocsTable, H2, P } from "../DocsKit";

export default function ProductsAndPrices() {
  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>Products & Prices</h1>
      <P>
        A Product is the thing you sell (name + description). A Price is a specific amount/currency/billing-cycle
        you sell it at. One product can have several prices — e.g. a "Pro Plan" product with a monthly price and a
        yearly price — but each Price, once created, never changes value.
      </P>

      <H2 id="create">Create a product</H2>
      <CodeBlock
        samples={{
          cURL: `curl https://api.ppay.dev/api/v1/products \\
  -X POST \\
  -H "Authorization: Bearer sk_sandbox_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Pro Plan",
    "description": "Full access, billed monthly",
    "price": {
      "amount_minor": 250000,
      "currency": "PKR",
      "interval": "month",
      "interval_count": 1
    }
  }'`,
        }}
      />
      <P>
        <code className="mono">interval</code> is one of <code className="mono">one_time</code>,{" "}
        <code className="mono">day</code>, <code className="mono">week</code>, <code className="mono">month</code>,{" "}
        or <code className="mono">year</code>. Only <code className="mono">one_time</code> prices can back a{" "}
        <a href="/docs/payment-links">Payment Link</a>; recurring prices are for{" "}
        <a href="/docs/subscriptions">Subscriptions</a>.
      </P>

      <H2 id="add-price">Adding another price to a product</H2>
      <CodeBlock
        samples={{
          cURL: `curl https://api.ppay.dev/api/v1/products/{product_id}/prices \\
  -X POST \\
  -H "Authorization: Bearer sk_sandbox_..." \\
  -H "Content-Type: application/json" \\
  -d '{"amount_minor": 2500000, "currency": "PKR", "interval": "year", "interval_count": 1}'`,
        }}
      />

      <Callout tone="warn">
        <strong>Prices are immutable.</strong> There is no endpoint to change a price's amount, currency, or billing
        interval — by design. A price that's already attached to a live Payment Link or an active Subscription must
        never change value under the people relying on it. If you need a different amount, create a new price and
        deactivate the old one.
      </Callout>

      <H2 id="deactivate">Deactivating a price</H2>
      <CodeBlock
        samples={{
          cURL: `curl https://api.ppay.dev/api/v1/products/{product_id}/prices/{price_id} \\
  -X PATCH \\
  -H "Authorization: Bearer sk_sandbox_..." \\
  -H "Content-Type: application/json" \\
  -d '{"is_active": false}'`,
        }}
      />
      <P>
        This is the only mutation allowed on a price — a boolean toggle. A deactivated price can't be used to
        create new Payment Links or Subscriptions, but everything already using it (existing links, existing
        subscriptions still renewing) keeps working unaffected.
      </P>

      <H2 id="response-fields">Useful response fields</H2>
      <DocsTable
        headers={["Field", "Where", "Meaning"]}
        rows={[
          ["active_subscriptions", "on a price", "Count of subscriptions currently ACTIVE or PAST_DUE on this price — a live read on recurring revenue from this price."],
          ["active_subscriptions", "on a product", "Sum across all of the product's prices."],
        ]}
      />
    </div>
  );
}
