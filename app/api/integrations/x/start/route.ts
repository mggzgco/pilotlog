import { NextResponse } from "next/server";
import { requireUser } from "@/app/lib/auth/session";
import { buildRedirectUrl } from "@/app/lib/http";
import { getXCallbackUrl, getXOAuthClient, getXScopes, isXConfigured, setOauthCookies } from "@/app/lib/integrations/x";

export async function GET(request: Request) {
  await requireUser();

  const redirectWithToast = (message: string, toastType: "success" | "error") => {
    const url = buildRedirectUrl(request, "/profile");
    url.searchParams.set("toast", message);
    url.searchParams.set("toastType", toastType);
    return NextResponse.redirect(url, { status: 303 });
  };

  if (!isXConfigured()) {
    return redirectWithToast("X integration is not configured on the server.", "error");
  }

  try {
    const callbackUrl = getXCallbackUrl();
    const client = getXOAuthClient();
    const { url, codeVerifier, state } = client.generateOAuth2AuthLink(callbackUrl, {
      scope: getXScopes()
    });

    setOauthCookies({ state, codeVerifier });
    return NextResponse.redirect(url, { status: 303 });
  } catch (error) {
    console.error("x.oauth.start failed", error);
    return redirectWithToast(
      error instanceof Error ? error.message : "X authorization failed to start.",
      "error"
    );
  }
}

