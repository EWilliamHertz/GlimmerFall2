import axios from "axios";

// Same-origin by default (works on Vercel where the API is served under /api on
// the same domain). Locally, REACT_APP_BACKEND_URL points at the preview backend.
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });
