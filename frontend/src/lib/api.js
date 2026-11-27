import axios from "axios";

// Same-origin by default (works on Vercel where the API is served under /api on
// the same domain). In production with the Oracle realtime backend or local dev,
// REACT_APP_BACKEND_URL points at https://play-api.glimmerfall.online or http://localhost:8000.
export const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").trim().replace(/\/+$/, "");
export const API = `${BACKEND_URL}/api`;

export const GUEST_TOKEN_KEY = "glimmerfall_guest_token";
export const GUEST_NAME_KEY = "glimmerfall_guest_name";

export function getActiveToken() {
  return localStorage.getItem("glimmerfall_token") || localStorage.getItem(GUEST_TOKEN_KEY) || null;
}

export const api = axios.create({ baseURL: API, timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = getActiveToken();
  if (token && config.headers) {
    if (typeof config.headers.set === "function") {
      config.headers.set("Authorization", `Bearer ${token}`);
    } else {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const config = error?.config;
    if (!config) return Promise.reject(error);

    // Retry once on transient network/transport error (e.g. HTTP/2 stream reset or cold wakeup)
    if (!error.response && !config._netRetried) {
      config._netRetried = true;
      await new Promise((r) => setTimeout(r, 250));
      return api.request(config);
    }

    // Auto-heal stale guest or user tokens if rejected with 401 on play/lobby/queue routes
    const url = String(config.url || "");
    const isAuthRoute = url.startsWith("/auth/login") || url.startsWith("/auth/register");
    if (error.response?.status === 401 && !isAuthRoute && !config._authRetried) {
      config._authRetried = true;
      const hadUserToken = Boolean(localStorage.getItem("glimmerfall_token"));
      if (hadUserToken) {
        localStorage.removeItem("glimmerfall_token");
        localStorage.removeItem("glimmerfall_user");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("gf-auth-expired"));
        }
      } else if (localStorage.getItem(GUEST_TOKEN_KEY)) {
        localStorage.removeItem(GUEST_TOKEN_KEY);
        localStorage.removeItem(GUEST_NAME_KEY);
        if (!url.startsWith("/guest")) {
          await ensurePlayerSession();
          return api.request(config);
        }
      }
    }
    return Promise.reject(error);
  }
);

let guestInflight = null;

/**
 * Ensures the browser has either a signed-in user JWT or a signed guest JWT.
 * Returns { token, name, registered }.
 */
export async function ensurePlayerSession(preferredName = "") {
  const userToken = localStorage.getItem("glimmerfall_token");
  const savedUser = localStorage.getItem("glimmerfall_user");
  if (userToken && savedUser) {
    try {
      const parsed = JSON.parse(savedUser);
      return { token: userToken, name: parsed.nickname, registered: true };
    } catch {
      // fall through
    }
  }
  const existingGuest = localStorage.getItem(GUEST_TOKEN_KEY);
  const existingName = localStorage.getItem(GUEST_NAME_KEY);
  const trimmedPref = (preferredName || "").trim();
  const wantsRename =
    trimmedPref &&
    existingName &&
    !existingName.toLowerCase().startsWith(trimmedPref.toLowerCase() + " #");

  if (existingGuest && existingName && !wantsRename) {
    return { token: existingGuest, name: existingName, registered: false };
  }

  if (!guestInflight) {
    guestInflight = api
      .post("/guest", { nickname: trimmedPref || localStorage.getItem("gf_username") || "" })
      .then((res) => {
        localStorage.setItem(GUEST_TOKEN_KEY, res.data.token);
        localStorage.setItem(GUEST_NAME_KEY, res.data.name);
        return { token: res.data.token, name: res.data.name, registered: false };
      })
      .finally(() => {
        guestInflight = null;
      });
  }
  return guestInflight;
}

/**
 * Builds a WebSocket URL (ws:// or wss://) to `/api/ws/...` with token query param.
 */
export function buildWsUrl(wsPath, extraParams = {}) {
  let base = BACKEND_URL;
  if (!base && typeof window !== "undefined") {
    base = window.location.origin;
  }
  const wsBase = base.replace(/^http/i, "ws");
  const params = new URLSearchParams();
  const token = getActiveToken();
  if (token) params.set("token", token);
  Object.entries(extraParams).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  });
  const qs = params.toString();
  return `${wsBase}${wsPath}${qs ? `?${qs}` : ""}`;
}

export function openAuthModal(mode = "login") {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("gf-open-auth", { detail: { mode } }));
  }
}
