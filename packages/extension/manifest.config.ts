import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "SAASpilot",
  version: "0.1.0",
  description:
    "Pre-fill startup-directory submission forms from one profile. Human-reviewed — never auto-submits.",
  action: {
    default_popup: "src/popup/index.html",
    default_title: "SAASpilot",
  },
  background: {
    service_worker: "src/background/background.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/content.ts"],
      run_at: "document_idle",
    },
  ],
  // storage: profile + settings; activeTab/scripting/tabs: message the page to fill;
  // identity: launchWebAuthFlow sign-in handoff; <all_urls> host access: fill forms on
  // any directory + reach the configured API.
  permissions: ["storage", "activeTab", "scripting", "tabs", "identity"],
  host_permissions: ["<all_urls>"],
});
