import { TwitterApi } from "twitter-api-v2";
import { cookies } from "next/headers";

export function getAppUrlFromEnv() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "").replace(/\/$/, "");
}

export function isXConfigured() {
  try {
    getXCallbackUrl();
    return Boolean(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET);
  } catch {
    return false;
  }
}

export function getXCallbackUrl() {
  const raw = (process.env.X_CALLBACK_URL ?? "").trim();
  if (!raw) {
    throw new Error("X OAuth callback URL is not configured.");
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("X OAuth callback URL is invalid.");
  }
  if (url.protocol !== "https:" && process.env.NODE_ENV === "production") {
    throw new Error("X OAuth callback URL must be https in production.");
  }
  return url.toString();
}

export function getXScopes() {
  // Minimal scopes for posting and reading the connected account identity.
  // offline.access enables refresh tokens.
  const raw = process.env.X_SCOPES?.trim();
  if (raw) return raw.split(/\s+/).filter(Boolean);
  return ["tweet.read", "tweet.write", "users.read", "offline.access"];
}

export function getXOAuthClient() {
  const clientId = process.env.X_CLIENT_ID ?? "";
  const clientSecret = process.env.X_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) {
    throw new Error("X OAuth is not configured.");
  }
  return new TwitterApi({ clientId, clientSecret });
}

export function setOauthCookies({
  state,
  codeVerifier
}: {
  state: string;
  codeVerifier: string;
}) {
  const store = cookies();
  const secure = process.env.NODE_ENV === "production";
  store.set("x_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 10 * 60
  });
  store.set("x_oauth_verifier", codeVerifier, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 10 * 60
  });
}

export function readOauthCookies() {
  const store = cookies();
  return {
    state: store.get("x_oauth_state")?.value ?? null,
    codeVerifier: store.get("x_oauth_verifier")?.value ?? null
  };
}

export function clearOauthCookies() {
  const store = cookies();
  store.set("x_oauth_state", "", { path: "/", maxAge: 0 });
  store.set("x_oauth_verifier", "", { path: "/", maxAge: 0 });
}

