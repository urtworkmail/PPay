import {
  BankIcon,
  BoxIcon,
  CardIcon,
  ChartIcon,
  ChartLineIcon,
  DatabaseIcon,
  FingerprintIcon,
  HomeIcon,
  InvoiceIcon,
  KeyIcon,
  LinkIcon,
  ListIcon,
  PercentIcon,
  RefreshIcon,
  RocketIcon,
  ShieldIcon,
  UsersIcon,
  WebhookIcon,
  WorkflowIcon,
} from "../components/Icons";

export const TOP_ITEMS = [
  { to: "/dashboard", label: "Home", icon: HomeIcon, end: true },
  { to: "/dashboard/balances", label: "Balances", icon: BankIcon },
  { to: "/dashboard/transactions", label: "Transactions", icon: ListIcon },
  { to: "/dashboard/customers", label: "Customers", icon: UsersIcon },
  { to: "/dashboard/products", label: "Product catalog", icon: BoxIcon },
];

export const SHORTCUTS = [
  { to: "/dashboard/subscriptions", label: "Subscriptions", icon: RefreshIcon },
  { to: "/dashboard/invoices", label: "Invoices", icon: InvoiceIcon },
  { to: "/dashboard/coming-soon/payments-analytics", label: "Payments Analytics", icon: ChartIcon, soon: true },
  { to: "/dashboard/payment-links", label: "Payment Links", icon: LinkIcon },
];

export const PRODUCT_GROUPS = [
  {
    label: "Payments",
    items: [
      { to: "/dashboard/coming-soon/payments-analytics", label: "Analytics", icon: ChartIcon, soon: true },
      { to: "/dashboard/coming-soon/disputes", label: "Disputes", icon: InvoiceIcon, soon: true },
      { to: "/dashboard/payment-links", label: "Payment Links", icon: LinkIcon },
      { to: "/dashboard/sentinel", label: "Sentinel", icon: ShieldIcon },
    ],
  },
  {
    label: "Billing",
    items: [
      { to: "/dashboard/coming-soon/billing-overview", label: "Overview", icon: ChartIcon, soon: true },
      { to: "/dashboard/subscriptions", label: "Subscriptions", icon: RefreshIcon },
      { to: "/dashboard/invoices", label: "Invoices", icon: InvoiceIcon },
      { to: "/dashboard/coming-soon/usage-based", label: "Usage-based", icon: PercentIcon, soon: true },
      { to: "/dashboard/coming-soon/revenue-recovery", label: "Revenue Recovery", icon: RefreshIcon, soon: true },
    ],
  },
  {
    label: "Reporting",
    items: [
      { to: "/dashboard/coming-soon/reports", label: "Reports", icon: ChartIcon, soon: true },
      { to: "/dashboard/coming-soon/metrics", label: "Metrics", icon: ChartLineIcon, soon: true },
      { to: "/dashboard/coming-soon/data-management", label: "Data Management", icon: DatabaseIcon, soon: true },
      { to: "/dashboard/coming-soon/data-analysis", label: "Data Analysis", icon: ChartLineIcon, soon: true },
    ],
  },
  {
    label: "More",
    items: [
      { to: "/dashboard/coming-soon/profiles", label: "Profiles", icon: UsersIcon, soon: true },
      { to: "/dashboard/coming-soon/tax", label: "Tax", icon: PercentIcon, soon: true },
      { to: "/dashboard/coming-soon/identity", label: "Identity", icon: FingerprintIcon, soon: true },
      { to: "/dashboard/coming-soon/financial-connections", label: "Financial Connections", icon: BankIcon, soon: true },
      { to: "/dashboard/coming-soon/workflows", label: "Workflows", icon: WorkflowIcon, soon: true },
      { to: "/dashboard/coming-soon/issuing", label: "Issuing", icon: CardIcon, soon: true },
    ],
  },
];

export const DEVELOPERS = [
  { to: "/dashboard/api-keys", label: "API Keys", icon: KeyIcon },
  { to: "/dashboard/webhooks", label: "Webhooks", icon: WebhookIcon },
  { to: "/dashboard/events", label: "Events", icon: ListIcon },
  { to: "/docs", label: "Documentation", icon: InvoiceIcon },
];

export const ACCOUNT = [
  { to: "/dashboard/team", label: "Team", icon: UsersIcon },
  { to: "/dashboard/go-live", label: "Go Live", icon: RocketIcon },
];

const ALL_NAV_ITEMS = [
  ...TOP_ITEMS,
  ...SHORTCUTS,
  ...PRODUCT_GROUPS.flatMap((g) => g.items),
  ...DEVELOPERS,
  ...ACCOUNT,
];

// Extra segment labels for detail/sub-routes that aren't in the sidebar at all.
const SEGMENT_LABELS = {
  dashboard: "Home",
  settings: "Settings",
  personal: "Personal",
  business: "Business",
  branding: "Branding",
  payout: "Payout",
  "plans-and-fees": "Plans & fees",
  payments: "Payments",
  billing: "Billing",
  documents: "Documents",
  help: "Help",
  status: "System Status",
  sentinel: "Sentinel",
  "go-live": "Go Live",
  "api-keys": "API Keys",
  "coming-soon": "Coming soon",
};

function titleCase(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function getBreadcrumb(pathname) {
  const exact = ALL_NAV_ITEMS.find((item) => item.to === pathname);
  if (exact) return [{ label: "Dashboard", to: "/dashboard" }, { label: exact.label }];

  const segments = pathname.replace(/^\/dashboard\/?/, "").split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: "Home" }];

  const crumbs = [{ label: "Dashboard", to: "/dashboard" }];
  let accPath = "/dashboard";
  segments.forEach((seg, i) => {
    accPath += `/${seg}`;
    const isLast = i === segments.length - 1;
    const navMatch = ALL_NAV_ITEMS.find((item) => item.to === accPath);
    let label = navMatch?.label ?? SEGMENT_LABELS[seg];
    if (!label) {
      // A detail-page id segment (uuid/slug) — show a generic "Detail" crumb
      // rather than a raw id.
      label = /^[0-9a-f-]{8,}$/i.test(seg) || seg.includes("@") ? "Detail" : titleCase(seg);
    }
    crumbs.push(isLast ? { label } : { label, to: accPath });
  });
  return crumbs;
}
