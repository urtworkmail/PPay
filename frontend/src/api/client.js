import { pushRequestLog } from "./requestLog";

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

  const startedAt = performance.now();
  const timestamp = new Date().toISOString();

  function log(status, ok, responseBody) {
    pushRequestLog({
      method,
      path,
      status,
      ok,
      durationMs: Math.round(performance.now() - startedAt),
      timestamp,
      requestBody: body,
      responseBody,
    });
  }

  let response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    log(0, false, { error: err.message });
    throw err;
  }

  if (!response.ok) {
    let detail = response.statusText;
    let parsed;
    try {
      parsed = await response.json();
      detail = typeof parsed.detail === "string" ? parsed.detail : JSON.stringify(parsed.detail);
    } catch {
      /* ignore parse errors on error body */
    }
    log(response.status, false, parsed ?? { detail });
    throw new ApiError(detail, response.status);
  }

  if (response.status === 204) {
    log(204, true, undefined);
    return undefined;
  }
  const data = await response.json();
  log(response.status, true, data);
  return data;
}

export { API_PREFIX, BASE_URL };
