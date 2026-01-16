import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db";
import { requireUser } from "@/app/lib/auth/session";
import { validateRequestCsrf } from "@/app/lib/auth/csrf";
import { TwitterApi } from "twitter-api-v2";
import { isXConfigured } from "@/app/lib/integrations/x";

export async function POST(request: Request) {
  const csrf = validateRequestCsrf(request);
  if (!csrf.ok) {
    return NextResponse.json({ error: csrf.error ?? "CSRF validation failed." }, { status: 403 });
  }

  const user = await requireUser();

  if (!isXConfigured()) {
    return NextResponse.json({ error: "X integration is not configured on the server." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as null | { text?: unknown };
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Missing text." }, { status: 400 });
  }

  const account = await prisma.xAccount.findFirst({
    where: { userId: user.id },
    select: { accessToken: true, refreshToken: true, expiresAt: true }
  });

  if (!account) {
    return NextResponse.json({ error: "X account is not connected." }, { status: 400 });
  }

  const doTweet = async (accessToken: string) => {
    const client = new TwitterApi(accessToken);
    return await client.v2.tweet(text);
  };

  try {
    // Best-effort refresh if token expired and refresh token is present.
    const now = Date.now();
    const shouldRefresh =
      account.refreshToken &&
      account.expiresAt &&
      account.expiresAt.getTime() - now < 60_000;

    if (shouldRefresh) {
      const refreshClient = new TwitterApi({
        clientId: process.env.X_CLIENT_ID!,
        clientSecret: process.env.X_CLIENT_SECRET!
      });
      const refreshed = await refreshClient.refreshOAuth2Token(account.refreshToken!);
      await prisma.xAccount.update({
        where: { userId: user.id },
        data: {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken ?? account.refreshToken,
          expiresAt:
            typeof refreshed.expiresIn === "number"
              ? new Date(Date.now() + refreshed.expiresIn * 1000)
              : account.expiresAt
        }
      });
      const tweet = await doTweet(refreshed.accessToken);
      return NextResponse.json({ ok: true, tweetId: tweet.data.id });
    }

    const tweet = await doTweet(account.accessToken);
    return NextResponse.json({ ok: true, tweetId: tweet.data.id });
  } catch (error: any) {
    console.error("x.post failed", error);
    return NextResponse.json(
      { error: error?.message ?? "Failed to post to X." },
      { status: 500 }
    );
  }
}

