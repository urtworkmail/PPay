/** What's shipped, newest first — shown on the auth screens and kept in step
 *  with the root CHANGELOG.md. Deliberately factual: this is the first thing a
 *  prospective merchant reads, so it states what actually exists rather than
 *  what's planned.
 */
export const RELEASES = [
  {
    version: "Q3 2026",
    title: "Notifications & platform status",
    summary:
      "Every change on your account now lands in a notification feed you can filter, read, and get emailed about — plus a public status page for the services behind PPay.",
    highlights: ["Activity feed & email digests", "Verified sign-in alerts", "Live platform status"],
  },
  {
    version: "Q2 2026",
    title: "Stripe-parity core",
    summary:
      "Payment intents, charges, and a full ledger sit under the sandbox engine, with sandbox and live data separated at the database level.",
    highlights: ["Payment intents & charges", "Sandbox/live isolation", "Audit log"],
  },
];

/** The capabilities that are built and usable today. */
export const PRODUCTS = [
  { name: "Hosted checkout", detail: "A payment page you don't have to build." },
  { name: "Payment links", detail: "Collect a payment without writing code." },
  { name: "Invoicing", detail: "Issue invoices and get paid against them." },
  { name: "Subscriptions", detail: "Recurring billing with saved methods." },
  { name: "Webhooks & API keys", detail: "Signed events and a documented API." },
];
