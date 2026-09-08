import CodeBlock from "../CodeBlock";
import { Callout, DocsTable, H2, P } from "../DocsKit";

export default function Authentication() {
  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>Authentication</h1>
      <P>
        Server-to-server calls (creating checkout sessions, products, invoices, etc.) authenticate with an API key
        as a bearer token. The public, customer-facing endpoints (fetching a checkout session, paying it, viewing a
        payment link) don't require a key — they're meant to be called from a browser.
      </P>

      <H2 id="api-keys">API keys</H2>
      <P>
        Create keys from the dashboard under <strong>Developers → API Keys</strong> (Owner/Admin only). A key looks
        like:
      </P>
      <CodeBlock samples={{ Format: "sk_sandbox_XjKp92mQ...   (44 characters after the prefix)" }} />
      <P>
        The full key is shown <strong>once</strong>, at creation time. PPay stores only a bcrypt hash of it — if you
        lose it, revoke the key and create a new one. There is currently one mode: <code className="mono">sandbox</code>.
        A <code className="mono">live</code> mode exists in the data model for when an account completes go-live
        review, gated behind identity and business verification before it becomes usable.
      </P>

      <H2 id="using-a-key">Using a key</H2>
      <P>Pass it as a bearer token on every authenticated request:</P>
      <CodeBlock
        samples={{
          cURL: `curl https://api.ppay.dev/api/v1/products \\
  -H "Authorization: Bearer sk_sandbox_XjKp92mQ..."`,
          Python: `import requests

headers = {"Authorization": "Bearer sk_sandbox_XjKp92mQ..."}
resp = requests.get("https://api.ppay.dev/api/v1/products", headers=headers)`,
          Node: `const resp = await fetch("https://api.ppay.dev/api/v1/products", {
  headers: { Authorization: "Bearer sk_sandbox_XjKp92mQ..." },
});`,
        }}
      />

      <Callout tone="danger">
        Treat your API key like a password. It authenticates as your whole business — never embed it in frontend
        JavaScript, a mobile app binary, or a public repo. Revoke and rotate immediately if one leaks.
      </Callout>

      <H2 id="dashboard-sessions">Dashboard sessions</H2>
      <P>
        The dashboard itself (what you're reading this next to) uses a separate login system: email/password →
        short-lived JWT access token + refresh token, tied to a specific team member (not the business as a whole).
        This is how role-based permissions work — Owner/Admin/Analyst/Support each see and can do different things.
        API keys, by contrast, act on behalf of the whole merchant account regardless of who created them.
      </P>

      <H2 id="roles">Team roles</H2>
      <DocsTable
        headers={["Role", "Can do"]}
        rows={[
          ["Owner", "Everything, including managing other team members and API keys. Can't remove the last remaining Owner."],
          ["Admin", "Everything an Owner can do except demoting/removing Owners."],
          ["Support", "View everything, plus issue refunds. Can't touch API keys, webhooks, team, or settings."],
          ["Analyst", "Read-only access everywhere."],
        ]}
      />
    </div>
  );
}
