import { Navigate, Route, Routes } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import DocsLayout from "./docs/DocsLayout";
import DocsPage from "./docs/DocsPage";
import AcceptInvite from "./pages/AcceptInvite";
import Analytics from "./pages/Analytics";
import ApiKeys from "./pages/ApiKeys";
import Balances from "./pages/Balances";
import Checkout from "./pages/Checkout";
import ComingSoon from "./pages/ComingSoon";
import CustomerDetail from "./pages/CustomerDetail";
import Customers from "./pages/Customers";
import DisputeDetail from "./pages/DisputeDetail";
import Disputes from "./pages/Disputes";
import Events from "./pages/Events";
import FinancialConnections from "./pages/FinancialConnections";
import ForgotPassword from "./pages/ForgotPassword";
import GoLive from "./pages/GoLive";
import HelpArticle from "./pages/HelpArticle";
import HelpCategory from "./pages/HelpCategory";
import HelpCenter from "./pages/HelpCenter";
import InvoiceDetail from "./pages/InvoiceDetail";
import InvoicePay from "./pages/InvoicePay";
import Invoices from "./pages/Invoices";
import Login from "./pages/Login";
import NotificationDetail from "./pages/NotificationDetail";
import Notifications from "./pages/Notifications";
import Overview from "./pages/Overview";
import PayLink from "./pages/PayLink";
import PaymentLinkDetail from "./pages/PaymentLinkDetail";
import PaymentLinks from "./pages/PaymentLinks";
import ProductDetail from "./pages/ProductDetail";
import Products from "./pages/Products";
import Register from "./pages/Register";
import Sentinel from "./pages/Sentinel";
import Settings from "./pages/Settings";
import SettingsBilling from "./pages/SettingsBilling";
import SettingsBranding from "./pages/SettingsBranding";
import SettingsBusiness from "./pages/SettingsBusiness";
import SettingsDocuments from "./pages/SettingsDocuments";
import SettingsPayments from "./pages/SettingsPayments";
import SettingsPayout from "./pages/SettingsPayout";
import SettingsNotifications from "./pages/SettingsNotifications";
import SettingsPersonal from "./pages/SettingsPersonal";
import SettingsPlansFees from "./pages/SettingsPlansFees";
import SettingsSessions from "./pages/SettingsSessions";
import SubscriptionDetail from "./pages/SubscriptionDetail";
import Subscriptions from "./pages/Subscriptions";
import SystemStatus from "./pages/SystemStatus";
import Tax from "./pages/Tax";
import Team from "./pages/Team";
import TransactionDetail from "./pages/TransactionDetail";
import Transactions from "./pages/Transactions";
import VerifyEmail from "./pages/VerifyEmail";
import WebhookEndpointDetail from "./pages/WebhookEndpointDetail";
import Webhooks from "./pages/Webhooks";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      {/* Unauthenticated on purpose: the emailed link has to work in any
          browser, not only the one holding the session. */}
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/checkout/:sessionId" element={<Checkout />} />
      <Route path="/pay/:linkId" element={<PayLink />} />
      <Route path="/invoices/:invoiceId" element={<InvoicePay />} />
      <Route path="/accept-invite/:token" element={<AcceptInvite />} />

      <Route path="/docs" element={<DocsLayout />}>
        <Route index element={<Navigate to="getting-started" replace />} />
        <Route path=":slug" element={<DocsPage />} />
      </Route>

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Overview />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="transactions/:id" element={<TransactionDetail />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="tax" element={<Tax />} />
        <Route path="financial-connections" element={<FinancialConnections />} />
        <Route path="disputes" element={<Disputes />} />
        <Route path="disputes/:id" element={<DisputeDetail />} />
        <Route path="payment-links" element={<PaymentLinks />} />
        <Route path="payment-links/:id" element={<PaymentLinkDetail />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="customers" element={<Customers />} />
        <Route path="customers/:email" element={<CustomerDetail />} />
        <Route path="products" element={<Products />} />
        <Route path="products/:id" element={<ProductDetail />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="subscriptions/:id" element={<SubscriptionDetail />} />
        <Route path="api-keys" element={<ApiKeys />} />
        <Route path="webhooks" element={<Webhooks />} />
        <Route path="webhooks/:id" element={<WebhookEndpointDetail />} />
        <Route path="events" element={<Events />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="notifications/:id" element={<NotificationDetail />} />
        <Route path="balances" element={<Balances />} />
        <Route path="team" element={<Team />} />
        <Route path="go-live" element={<GoLive />} />
        <Route path="sentinel" element={<Sentinel />} />
        <Route path="status" element={<SystemStatus />} />
        <Route path="help" element={<HelpCenter />} />
        <Route path="help/category/:categorySlug" element={<HelpCategory />} />
        <Route path="help/:articleSlug" element={<HelpArticle />} />
        <Route path="coming-soon/:slug" element={<ComingSoon />} />
        <Route path="settings" element={<Settings />} />
        <Route path="settings/personal" element={<SettingsPersonal />} />
        <Route path="settings/sessions" element={<SettingsSessions />} />
        <Route path="settings/notifications" element={<SettingsNotifications />} />
        <Route path="settings/business" element={<SettingsBusiness />} />
        <Route path="settings/branding" element={<SettingsBranding />} />
        <Route path="settings/payout" element={<SettingsPayout />} />
        <Route path="settings/plans-and-fees" element={<SettingsPlansFees />} />
        <Route path="settings/payments" element={<SettingsPayments />} />
        <Route path="settings/billing" element={<SettingsBilling />} />
        <Route path="settings/documents" element={<SettingsDocuments />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
