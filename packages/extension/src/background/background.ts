import { DEFAULT_SETTINGS } from "../lib/storage";

// Seed default settings on first install so the popup has a sane starting state.
chrome.runtime.onInstalled.addListener(async () => {
  const r = await chrome.storage.local.get("settings");
  if (!r.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
});
