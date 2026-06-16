import type { StartupProfile } from "@aisas/shared/types";

export interface Settings {
  token: string;
  activeProfileId: string | null;
  /** True when the popup holds local profile edits not yet saved to the server. */
  dirty: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  token: "",
  activeProfileId: null,
  dirty: false,
};

export async function getSettings(): Promise<Settings> {
  const r = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...(r.settings ?? {}) };
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}

export async function getProfiles(): Promise<StartupProfile[]> {
  const r = await chrome.storage.local.get("profiles");
  return (r.profiles as StartupProfile[]) ?? [];
}

export async function setProfiles(profiles: StartupProfile[]): Promise<void> {
  await chrome.storage.local.set({ profiles });
}
