import { Callout, DocsTable, H2, P } from "../DocsKit";

export default function GoLiveChecklist() {
  return (
    <div>
      <h1 style={{ fontSize: 30, fontWeight: 700, marginBottom: 6 }}>Go-live checklist</h1>
      <P>
        Every account starts sandbox-only. Moving to live processing is a deliberate, human-reviewed step — there
        is no code path that auto-approves it. This page lists exactly what the dashboard's <strong>Go Live</strong>{" "}
        wizard collects, so you can have it ready before you start.
      </P>

      <Callout tone="warn">
        This is a KYC/business-verification step, not a technical one. Approval is a manual review — see{" "}
        <a href="/dashboard/help">Support</a> if you're waiting on a decision.
      </Callout>

      <H2 id="business">Business details</H2>
      <DocsTable
        headers={["Field", "Notes"]}
        rows={[
          ["Business type", "Unregistered / Sole proprietorship / Partnership / Private limited / Nonprofit."],
          ["Legal business name", "—"],
          ["Business category", "What you sell, in a few words."],
          ["Registration number", "If applicable to your business type."],
          ["National Tax Number (NTN)", "FBR tax registration number, if you have one."],
          ["Business address", "—"],
          ["Website URL", "Optional."],
          ["Product/service description", "What customers are actually paying for."],
        ]}
      />

      <H2 id="representative">Account representative</H2>
      <P>The individual legally responsible for this account.</P>
      <DocsTable
        headers={["Field", "Notes"]}
        rows={[
          ["Full name", "—"],
          ["CNIC", "—"],
          ["Date of birth", "—"],
          ["Address", "—"],
        ]}
      />

      <H2 id="payout">Payout details</H2>
      <DocsTable
        headers={["Field", "Notes"]}
        rows={[
          ["Bank name", "—"],
          ["Bank account number", "Where settled funds are paid out — see your dashboard's Balances page for the payout schedule."],
        ]}
      />

      <H2 id="other">Also required</H2>
      <DocsTable
        headers={["Field", "Notes"]}
        rows={[
          ["Contact phone", "—"],
          ["Terms acceptance", "You must explicitly accept terms before submitting."],
          ["Notes", "Optional — anything reviewers should know."],
        ]}
      />

      <H2 id="review">What happens after you submit</H2>
      <P>
        The request status starts at <code className="mono">pending_review</code>. A reviewer either approves it —
        your merchant's <code className="mono">live_status</code> moves from <code className="mono">sandbox_only</code>{" "}
        to <code className="mono">live</code> — or rejects it with a reason. Nothing about your existing sandbox
        integration changes when you go live; the same API shapes, the same webhook events, just processing real
        transactions instead of simulated ones (once live-mode processing is connected to a real acquirer — see the
        go-to-market plan for what that involves).
      </P>
    </div>
  );
}
