import { Link } from "react-router-dom";
import ActivationChecklist from "../components/ActivationChecklist";
import {
  BankIcon,
  BoxIcon,
  HelpIcon,
  InvoiceIcon,
  KeyIcon,
  RocketIcon,
  SettingsIcon,
  UsersIcon,
} from "../components/Icons";

function SettingsCard({ to, icon: Icon, title, description }) {
  return (
    <Link
      to={to}
      className="card"
      style={{
        display: "flex",
        gap: 12,
        padding: 16,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "var(--radius-sm)",
          background: "var(--color-accent-soft)",
          color: "var(--color-accent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon width={16} height={16} />
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--color-accent)" }}>{title}</div>
        <div style={{ fontSize: 12.5, color: "var(--color-text-muted)", marginTop: 2 }}>{description}</div>
      </div>
    </Link>
  );
}

function SettingsSection({ title, children }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>{children}</div>
    </div>
  );
}

export default function Settings() {
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Settings</h1>
      <p style={{ color: "var(--color-text-muted)", marginTop: 0, marginBottom: 28 }}>
        Manage your account, business, and platform preferences.
      </p>

      <ActivationChecklist />

      <SettingsSection title="Personal settings">
        <SettingsCard
          to="/dashboard/settings/personal"
          icon={UsersIcon}
          title="Personal details"
          description="Your name, email, password, and account security."
        />
        <SettingsCard
          to="/dashboard/coming-soon/profiles"
          icon={HelpIcon}
          title="Communication preferences"
          description="Customize the emails and notifications you receive."
        />
        <SettingsCard
          to="/dashboard/api-keys"
          icon={KeyIcon}
          title="Developers"
          description="API keys, webhooks, and events."
        />
      </SettingsSection>

      <SettingsSection title="Account settings">
        <SettingsCard
          to="/dashboard/settings/business"
          icon={BoxIcon}
          title="Business"
          description="Account details, support contact, and statement descriptor."
        />
        <SettingsCard
          to="/dashboard/settings/branding"
          icon={SettingsIcon}
          title="Branding"
          description="Logo and brand color shown on checkout and invoices."
        />
        <SettingsCard
          to="/dashboard/settings/payout"
          icon={BankIcon}
          title="Payout account"
          description="Settlement bank account and payout schedule."
        />
        <SettingsCard to="/dashboard/team" icon={UsersIcon} title="Team and security" description="Team members, roles, and access." />
        <SettingsCard
          to="/dashboard/settings/plans-and-fees"
          icon={InvoiceIcon}
          title="Plans and fees"
          description="Your current transaction fee schedule."
        />
        <SettingsCard
          to="/dashboard/settings/documents"
          icon={RocketIcon}
          title="Documents and compliance"
          description="Go-Live status and what we collect, and why."
        />
      </SettingsSection>

      <SettingsSection title="Product settings">
        <SettingsCard
          to="/dashboard/settings/payments"
          icon={BoxIcon}
          title="Payments"
          description="Accepted payment methods and checkout policies."
        />
        <SettingsCard
          to="/dashboard/settings/billing"
          icon={InvoiceIcon}
          title="Billing"
          description="Invoice footer and subscription billing behavior."
        />
        <SettingsCard
          to="/dashboard/coming-soon/financial-connections"
          icon={BankIcon}
          title="Financial Connections"
          description="Link and verify customer bank accounts."
        />
      </SettingsSection>
    </div>
  );
}
