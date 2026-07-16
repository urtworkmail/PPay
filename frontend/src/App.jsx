import { Navigate, Route, Routes } from "react-router-dom";
import DashboardLayout from "./components/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import ApiKeys from "./pages/ApiKeys";
import Checkout from "./pages/Checkout";
import Login from "./pages/Login";
import Overview from "./pages/Overview";
import Register from "./pages/Register";
import Settlements from "./pages/Settlements";
import Transactions from "./pages/Transactions";
import Webhooks from "./pages/Webhooks";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/checkout/:sessionId" element={<Checkout />} />

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
        <Route path="api-keys" element={<ApiKeys />} />
        <Route path="webhooks" element={<Webhooks />} />
        <Route path="settlements" element={<Settlements />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
