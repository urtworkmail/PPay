import Authentication from "./pages/Authentication";
import CheckoutSessions from "./pages/CheckoutSessions";
import Errors from "./pages/Errors";
import GettingStarted from "./pages/GettingStarted";
import GoLiveChecklist from "./pages/GoLiveChecklist";
import InvoicesDoc from "./pages/InvoicesDoc";
import PaymentLinksDoc from "./pages/PaymentLinksDoc";
import ProductsAndPrices from "./pages/ProductsAndPrices";
import SubscriptionsDoc from "./pages/SubscriptionsDoc";
import Testing from "./pages/Testing";
import WebhooksDoc from "./pages/WebhooksDoc";

export const DOCS_GROUPS = [
  {
    label: "Get started",
    items: [
      { slug: "getting-started", title: "Getting started", Component: GettingStarted },
      { slug: "authentication", title: "Authentication", Component: Authentication },
      { slug: "testing", title: "Testing", Component: Testing },
    ],
  },
  {
    label: "Core resources",
    items: [
      { slug: "checkout-sessions", title: "Checkout Sessions", Component: CheckoutSessions },
      { slug: "payment-links", title: "Payment Links", Component: PaymentLinksDoc },
      { slug: "products-and-prices", title: "Products & Prices", Component: ProductsAndPrices },
      { slug: "invoices", title: "Invoices", Component: InvoicesDoc },
      { slug: "subscriptions", title: "Subscriptions", Component: SubscriptionsDoc },
    ],
  },
  {
    label: "Events",
    items: [{ slug: "webhooks", title: "Webhooks", Component: WebhooksDoc }],
  },
  {
    label: "Reference",
    items: [{ slug: "errors-and-idempotency", title: "Errors & idempotency", Component: Errors }],
  },
  {
    label: "Launch",
    items: [{ slug: "go-live-checklist", title: "Go-live checklist", Component: GoLiveChecklist }],
  },
];

export const DOCS_FLAT = DOCS_GROUPS.flatMap((g) => g.items);
