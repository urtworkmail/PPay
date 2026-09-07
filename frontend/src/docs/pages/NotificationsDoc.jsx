import CodeBlock from "../CodeBlock";
import { Callout, DocsTable, H2, P, Ul } from "../DocsKit";

export default function NotificationsDoc() {
  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>Notifications</h1>
      <P>
        Every audited change on your account — and a set of purpose-built events like payments, refunds, disputes,
        and payouts — lands in your notification feed automatically. No webhook subscription required to see them
        in the dashboard; webhooks are for your backend, notifications are for you.
      </P>

      <H2 id="categories">Categories</H2>
      <DocsTable
        headers={["Category", "Examples"]}
        rows={[
          ["payment", "A checkout attempt succeeded, failed, or was blocked by Sentinel."],
          ["refund", "A refund was issued."],
          ["dispute", "A chargeback was raised or your response was recorded."],
          ["payout", "A settlement batch was paid out to your bank account."],
          ["security", "A sign-in from a new device, a password change, a session revoked."],
          ["team", "A team member was invited, changed role, or removed."],
          ["account", "Business/branding/payout settings changed, a Go-Live decision."],
        ]}
      />

      <H2 id="list">List notifications</H2>
      <CodeBlock
        samples={{
          cURL: `curl "https://app.ppay.silicatelabs.site/api/v1/notifications?page_size=25&unread_only=true" \\
  -H "Authorization: Bearer sk_sandbox_..."`,
        }}
      />

      <H2 id="mark-read">Mark read</H2>
      <P>
        Opening a notification's detail page in the dashboard marks it read automatically
        (<code className="mono">POST /notifications/&#123;id&#125;/read</code>). To mark everything at once, use{" "}
        <code className="mono">POST /notifications/read-all</code>.
      </P>

      <H2 id="email">Email delivery</H2>
      <P>
        Off by default for most categories — <code className="mono">security</code>, <code className="mono">payout</code>,{" "}
        <code className="mono">team</code>, and <code className="mono">dispute</code> are on by default, since those
        are the ones you'd want to know about away from the dashboard. Configure per-category opt-in and an
        alternate delivery address (confirmed by a one-time code before it's used) from{" "}
        <strong>Settings → Notifications</strong> or via <code className="mono">PATCH /notifications/preferences</code>.
      </P>
      <Ul
        items={[
          "An unverified address is never emailed — verify your login email first (or confirm an alternate one) before mail will send.",
          "Sandbox and live mode notifications are stored separately — one merchant's sandbox testing never shows up as a live-mode alert.",
        ]}
      />

      <Callout tone="info">
        Notifications are for humans reading the dashboard. If your backend needs to react to an event
        programmatically, use <a href="/docs/webhooks">webhooks</a> instead — they're delivered independently and
        include a verifiable signature.
      </Callout>
    </div>
  );
}
