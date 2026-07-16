import { createContext, useContext, useEffect, useState } from "react";
import { apiFetch, clearTokens, setTokens } from "../api/client";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [merchant, setMerchant] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile() {
    try {
      const profile = await apiFetch("/merchants/me");
      setMerchant(profile);
    } catch {
      clearTokens();
      setMerchant(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (localStorage.getItem("openpay_access_token")) {
      loadProfile();
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email, password) {
    const tokens = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    setTokens(tokens.access_token, tokens.refresh_token);
    await loadProfile();
  }

  async function register(businessName, email, password) {
    const tokens = await apiFetch("/auth/register", {
      method: "POST",
      body: { business_name: businessName, email, password },
      auth: false,
    });
    setTokens(tokens.access_token, tokens.refresh_token);
    await loadProfile();
  }

  function logout() {
    clearTokens();
    setMerchant(null);
  }

  return (
    <AuthContext.Provider value={{ merchant, loading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
