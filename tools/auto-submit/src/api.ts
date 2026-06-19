import type { FieldMap, StartupProfile } from "@aisas/shared/types";

/** The subset of a catalog Directory row this tool reads. */
export interface ApiDirectory {
  id: string;
  slug: string;
  name: string;
  domain: string;
  submissionUrl: string;
  requiresLogin: boolean;
  cost: string;
  instructions: string | null;
}

export interface SubmissionLite {
  directoryId: string;
  status: string;
}

export interface SubmissionInput {
  directoryId: string;
  profileId: string;
  status: string;
  postUrl?: string;
  notes?: string;
}

/**
 * Thin client over the web API, using the same Bearer PAT flow as the extension.
 * `/api/directories` and `/api/field-maps` are public; profiles/submissions need the token.
 */
export function createApi(apiBase: string, token: string) {
  async function request<T>(reqPath: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((init?.headers as Record<string, string>) ?? {}),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${apiBase}${reqPath}`, { ...init, headers });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      throw new Error(body.message || body.error || `HTTP ${res.status} for ${reqPath}`);
    }
    return res.json() as Promise<T>;
  }

  return {
    async fetchProfiles(): Promise<StartupProfile[]> {
      const { profiles } = await request<{ profiles: StartupProfile[] }>("/api/profiles");
      return profiles;
    },

    /** Page through the whole catalog (no slug filter server-side) and return all rows. */
    async fetchAllDirectories(): Promise<ApiDirectory[]> {
      const out: ApiDirectory[] = [];
      let page = 1;
      for (;;) {
        const res = await request<{ items: ApiDirectory[]; pages: number }>(
          `/api/directories?pageSize=100&page=${page}`,
        );
        out.push(...res.items);
        if (res.items.length === 0 || page >= res.pages) break;
        page++;
      }
      return out;
    },

    /** Best-effort curated field map for a domain, or null (heuristic fallback). */
    async fetchFieldMap(domain: string): Promise<FieldMap | null> {
      try {
        const { fieldMap } = await request<{ fieldMap: FieldMap | null }>(
          `/api/field-maps?domain=${encodeURIComponent(domain)}`,
        );
        return fieldMap;
      } catch {
        return null;
      }
    },

    async fetchSubmissions(profileId: string): Promise<SubmissionLite[]> {
      const { submissions } = await request<{ submissions: SubmissionLite[] }>(
        `/api/submissions?profileId=${encodeURIComponent(profileId)}`,
      );
      return submissions;
    },

    async postSubmission(input: SubmissionInput): Promise<void> {
      await request("/api/submissions", { method: "POST", body: JSON.stringify(input) });
    },
  };
}

export type Api = ReturnType<typeof createApi>;
