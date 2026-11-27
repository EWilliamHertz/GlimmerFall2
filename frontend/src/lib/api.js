import axios from "axios";

// Direct realtime backend URL (e.g. https://play-api.glimmerfall.online in prod).
// If the player's ISP blocks or blackholes the Oracle IP, `api` automatically and
// transparently fails over to same-origin `/api` on Vercel Edge (`www.glimmerfalltcg.com/api`),
// which shares the exact same NeonDB & JWT_SECRET and forwards realtime wakeups to Oracle!
export const BACKEND_URL = (process.env.REACT_APP_BACKEND_URL || "").trim().replace(/\/+$/, "");
export const API = `${BACKEND_URL}/api`;

export const GUEST_TOKEN_KEY = "glimmerfall_guest_token";
export const GUEST_NAME_KEY = "glimmerfall_guest_name";
export const EDGE_RELAY_KEY = "gf_edge_relay";

export function canUseSameOriginRelay() {
  if (typeof window === "undefined" || !BACKEND_URL) return false;
  return window.location.origin !== BACKEND_URL;
}

export function isEdgeRelayActive() {
  if (!canUseSameOriginRelay()) return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("relay") === "1") {
      localStorage.setItem(EDGE_RELAY_KEY, "1");
      return true;
    }
    if (params.get("relay") === "0") {
      localStorage.removeItem(EDGE_RELAY_KEY);
      return false;
    }
    return localStorage.getItem(EDGE_RELAY_KEY) === "1";
  } catch {
    return false;
  }
}

export function enableEdgeRelay() {
  if (!canUseSameOriginRelay()) return;
  try {
    localStorage.setItem(EDGE_RELAY_KEY, "1");
    window.dispatchEvent(new CustomEvent("gf-edge-relay-enabled"));
  } catch {}
}

// Non-blocking startup probe: detects ISP blocks on Oracle IP within 2.5s so the
// player doesn't even wait on their first button click, while clearing relay mode
// automatically if they switch to an unblocked network.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "test" && canUseSameOriginRelay()) {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 2500) : null;
  fetch(`${BACKEND_URL}/api/`, { method: "GET", mode: "cors", signal: ctrl?.signal })
    .then((res) => {
      if (timer) clearTimeout(timer);
      if (res.ok) {
        try {
          const params = new URLSearchParams(window.location.search);
          if (params.get("relay") !== "1") {
            localStorage.removeItem(EDGE_RELAY_KEY);
          }
        } catch {}
      } else {
        enableEdgeRelay();
      }
    })
    .catch(() => {
      if (timer) clearTimeout(timer);
      enableEdgeRelay();
    });
}

export function getActiveToken() {
  return localStorage.getItem("glimmerfall_token") || localStorage.getItem(GUEST_TOKEN_KEY) || null;
}

export const api = axios.create({ baseURL: API, timeout: 15000 });

api.interceptors.request.use((config) => {
  if (config._useEdgeRelay || isEdgeRelayActive()) {
    config.baseURL = "/api";
    config.timeout = 15000;
  } else if (canUseSameOriginRelay()) {
    config.baseURL = API;
    // Fast 3.5s failover timeout on direct cross-origin requests so blackholed ISPs
    // switch to Vercel Edge `/api` seamlessly without a long hang.
    if (!config.timeout || config.timeout > 3500) {
      config.timeout = 3500;
    }
  }

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

    // Instant transparent failover to same-origin Vercel Edge `/api` when Oracle IP is blocked!
    if (!error.response && canUseSameOriginRelay() && !config._useEdgeRelay && config.baseURL !== "/api") {
      enableEdgeRelay();
      config._useEdgeRelay = true;
      config.baseURL = "/api";
      config.timeout = 15000;
      return api.request(config);
    }

    // Retry once on transient network/transport error (skipped in Jest unit tests)
    if (!error.response && !config._netRetried && process.env.NODE_ENV !== "test") {
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
