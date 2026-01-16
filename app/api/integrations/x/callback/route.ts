import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import { buildRedirectUrl } from "@/app/lib/http";
import { clearOauthCookies, getXCallbackUrl, getXOAuthClient, isXConfigured, readOauthCookies } from "@/app/lib/integrations/x";

export async function GET(request: Request) {
  const user = await requireUser();

  const redirectWithToast = (message: string, toastType: "success" | "error") => {
    const url = buildRedirectUrl(request, "/profile");
    url.searchParams.set("toast", message);
    url.searchParams.set("toastType", toastType);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (!isXConfigured()) {
    return redirectWithToast("X integration is not configured on the server.", "error");
  }

  const { state: cookieState, codeVerifier } = readOauthCookies();
  clearOauthCookies();

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state || !cookieState || !codeVerifier || state !== cookieState) {
    return redirectWithToast("X authorization failed (invalid state).", "error");
  }

  try {
    const client = getXOAuthClient();
    const callbackUrl = getXCallbackUrl();

    const {
      client: loggedInClient,
      accessToken,
      refreshToken,
      expiresIn,
      scope
    } = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: callbackUrl
    });

    const me = await loggedInClient.v2.me().catch(() => null);
    const providerUserId = me?.data?.id ?? null;
    const username = me?.data?.username ?? null;
    const name = me?.data?.name ?? null;

    const expiresAt =
      typeof expiresIn === "number" && Number.isFinite(expiresIn)
        ? new Date(Date.now() + expiresIn * 1000)
        : null;

    await prisma.xAccount.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        providerUserId,
        username,
        name,
        accessToken,
        refreshToken: refreshToken ?? null,
        scope: Array.isArray(scope) ? scope.join(" ") : (scope ?? null),
        tokenType: null,
        expiresAt
      },
      update: {
        providerUserId,
        username,
        name,
        accessToken,
        refreshToken: refreshToken ?? null,
        scope: Array.isArray(scope) ? scope.join(" ") : (scope ?? null),
        tokenType: null,
        expiresAt
      }
    });

    return redirectWithToast("X account connected.", "success");
  } catch (error) {
    console.error("x.oauth.callback failed", error);
    return redirectWithToast("X authorization failed.", "error");
  }
}

