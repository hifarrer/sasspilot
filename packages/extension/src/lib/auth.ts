import { APP_URL } from "./config";

/**
 * Sign in via the web app and return a freshly minted access token.
 *
 * Opens the app's `/extension/connect` page in Chrome's auth popup. That page mints a
 * personal access token against the user's web session (prompting for email/password
 * sign-in first if needed) and redirects back to this extension's chromiumapp.org URL
 * with the token in the hash. Chrome captures that redirect and hands the URL back here.
 */
export async function connectAccount(): Promise<string> {
  // chrome.identity only exists once the "identity" permission is active. If the extension
  // was rebuilt after the permission was added but not reloaded, this namespace is missing.
  if (!chrome.identity?.getRedirectURL) {
    throw new Error(
      "Sign-in needs the 'identity' permission. Reload the extension at chrome://extensions (or remove and re-add it), then try again.",
    );
  }
  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl = `${APP_URL}/extension/connect?redirect_uri=${encodeURIComponent(redirectUri)}`;

  const responseUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl, interactive: true });
  if (!responseUrl) throw new Error("Sign-in was cancelled.");

  const token = new URLSearchParams(new URL(responseUrl).hash.slice(1)).get("token");
  if (!token) throw new Error("Sign-in did not return a token.");
  return token;
}
