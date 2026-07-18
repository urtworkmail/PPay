import { Callout, DocsTable, H2, P } from "../DocsKit";

export default function Testing() {
  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>Testing</h1>
      <P>
        Every account is sandbox-only until it completes go-live review, and the sandbox engine is fully
        deterministic — specific "magic" card numbers and wallet numbers always produce the same result, every
        time, so your integration tests are reproducible. This is the same idea as Stripe's test-mode card numbers.
      </P>

      <Callout tone="info">
        Nothing here touches a real card network, bank, or wallet provider, and no real card data is ever accepted
        or stored — the sandbox engine only recognizes these specific digit strings.
      </Callout>

      <H2 id="test-cards">Test cards</H2>
      <P>Use these as the <code className="mono">card_number</code> when paying a Checkout Session. Any other 16-digit number is treated as a generic valid card and succeeds.</P>
      <DocsTable
        headers={["Card number", "Result"]}
        rows={[
          ["4242 4242 4242 4242", "Succeeds"],
          ["4000 0000 0000 0002", "Fails — insufficient_funds"],
          ["4000 0000 0000 0069", "Fails — expired_card"],
          ["4000 0000 0000 0119", "Fails — processing_error"],
        ]}
      />

      <H2 id="test-wallets">Test wallet numbers</H2>
      <P>Use these as the <code className="mono">wallet_phone</code> when paying with a wallet.</P>
      <DocsTable
        headers={["Phone number", "Result"]}
        rows={[
          ["0300 0000000", "Succeeds"],
          ["0300 0000001", "Fails — insufficient_funds"],
          ["0300 0000002", "Fails — timeout (takes ~8s before failing, to simulate a slow gateway)"],
        ]}
      />

      <H2 id="bank-transfer">Bank transfer</H2>
      <P>The <code className="mono">bank_transfer</code> method always succeeds in sandbox — there's no separate confirmation step to simulate yet.</P>

      <H2 id="subscriptions">Subscriptions and saved cards</H2>
      <P>
        When a customer saves a card (via the "Save this card" checkbox at checkout), its digits are remembered so
        future off-session charges — subscription renewals — can be tested realistically:
      </P>
      <ul style={{ fontSize: 14.5, lineHeight: 1.8, paddingLeft: 20 }}>
        <li>A saved card matching one of the table above always produces that same outcome on renewal too.</li>
        <li>
          A saved card that <em>isn't</em> one of the magic numbers has a 15% random chance of declining on each
          renewal (reason: <code className="mono">insufficient_funds</code>, <code className="mono">card_declined</code>, or{" "}
          <code className="mono">expired_card</code>) — this is what makes the dunning/retry logic meaningful to test.
        </li>
      </ul>

      <H2 id="resetting">Starting fresh</H2>
      <P>
        There's no "reset sandbox" button today — test data (transactions, customers, subscriptions) accumulates on
        your account the same way production data would. Use a throwaway email per test run if you want a clean
        customer history, or ask support to help reset a development account.
      </P>
    </div>
  );
}
