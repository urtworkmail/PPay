import { Navigate, Route, Routes } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AcceptInvite from "./pages/AcceptInvite";
import ApiKeys from "./pages/ApiKeys";
import Checkout from "./pages/Checkout";
import Customers from "./pages/Customers";
import GoLive from "./pages/GoLive";
import HelpCenter from "./pages/HelpCenter";
import InvoicePay from "./pages/InvoicePay";
import Invoices from "./pages/Invoices";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import PayLink from "./pages/PayLink";
import PaymentLinks from "./pages/PaymentLinks";
import Register from "./pages/Register";
import Settlements from "./pages/Settlements";
import Team from "./pages/Team";
import Transactions from "./pages/Transactions";
import Webhooks from "./pages/Webhooks";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/checkout/:sessionId" element={<Checkout />} />
      <Route path="/pay/:linkId" element={<PayLink />} />
      <Route path="/invoices/:invoiceId" element={<InvoicePay />} />
      <Route path="/accept-invite/:token" element={<AcceptInvite />} />

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
        <Route path="payment-links" element={<PaymentLinks />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="customers" element={<Customers />} />
        <Route path="api-keys" element={<ApiKeys />} />
        <Route path="webhooks" element={<Webhooks />} />
        <Route path="settlements" element={<Settlements />} />
        <Route path="team" element={<Team />} />
        <Route path="go-live" element={<GoLive />} />
        <Route path="help" element={<HelpCenter />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
