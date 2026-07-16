const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";
const API_PREFIX = `${BASE_URL}/api/v1`;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function getAccessToken() {
  return localStorage.getItem("openpay_access_token");
}

export function setTokens(access, refresh) {
  localStorage.setItem("openpay_access_token", access);
  localStorage.setItem("openpay_refresh_token", refresh);
}

export function clearTokens() {
  localStorage.removeItem("openpay_access_token");
  localStorage.removeItem("openpay_refresh_token");
}

export async function apiFetch(path, options = {}) {
  const { method = "GET", body, auth = true, headers = {} } = options;

  const finalHeaders = {
    "Content-Type": "application/json",
    ...headers,
  };

  if (auth) {
    const token = getAccessToken();
    if (token) {
      finalHeaders["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_PREFIX}${path}`, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const data = await response.json();
      detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {
      /* ignore parse errors on error body */
    }
    throw new ApiError(detail, response.status);
  }

  if (response.status === 204) {
    return undefined;
  }
  return response.json();
}

export { API_PREFIX, BASE_URL };
