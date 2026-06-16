/** Web app base URL, baked at build time (Vite inlines VITE_* envs). Trailing slash trimmed. */
export const APP_URL = (import.meta.env.VITE_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
