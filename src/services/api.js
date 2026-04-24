import { EventSourcePolyfill } from 'event-source-polyfill';

const API_URL = import.meta.env.VITE_API_URL;
const API_KEY = import.meta.env.VITE_API_KEY;
const TOKEN_KEY = 'dashboard_token';

// ─── Token Helper ─────────────────────────────────────────────────────────────
const getAuthToken = () => sessionStorage.getItem(TOKEN_KEY);

// ─── Base Headers (API Key) ───────────────────────────────────────────────────
const getHeaders = () => {
  const headers = { "Content-Type": "application/json" };
  if (API_KEY) headers["x-api-key"] = API_KEY;
  return headers;
};

// ─── Authenticated Headers (API Key + JWT) ───────────────────────────────────
const getAuthHeaders = () => {
  const headers = getHeaders();
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
};

// ─── Generic Fetch Helper ─────────────────────────────────────────────────────
const apiFetch = async (path, options = {}) => {
  const res = await fetch(`${API_URL}${path}`, options);
  if (!res.ok) {
    const err = new Error(`API ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
};

// ─── GET (Public — API Key only) ─────────────────────────────────────────────
export const apiGet = async (path) => {
  return apiFetch(path, {
    method: "GET",
    headers: getHeaders(),
  });
};

// ─── GET (Internal — API Key + JWT Bearer) ───────────────────────────────────
export const apiGetInternal = async (path) => {
  return apiFetch(path, {
    method: "GET",
    headers: getAuthHeaders(),
  });
};

// ─── Auth API ─────────────────────────────────────────────────────────────────
export const authLogin = async (password) => {
  return apiFetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ password }),
  });
};

export const authVerify = async () => {
  return apiFetch("/api/auth/verify", {
    method: "GET",
    headers: getAuthHeaders(),
  });
};

// ─── SSE (Public) ─────────────────────────────────────────────────────────────
export const createEventSource = (path) => {
  return new EventSourcePolyfill(`${API_URL}${path}`, {
    headers: { "x-api-key": API_KEY },
    heartbeatTimeout: 60000,
  });
};

// ─── SSE (Internal — ส่ง JWT ผ่าน Header) ────────────────────────────────────
export const createInternalEventSource = (path) => {
  const headers = { "x-api-key": API_KEY };
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  return new EventSourcePolyfill(`${API_URL}${path}`, {
    headers,
    heartbeatTimeout: 60000,
  });
};
