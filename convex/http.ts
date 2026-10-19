import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { encryptSecret } from "./lib/crypto";
import { exchangeCode, getProfile } from "./model/gmailApi";

const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * Google redirects here after the user approves Gmail access. The one-time
 * state proves the flow started from our dashboard; tokens are encrypted
 * before they are stored, and the browser goes back to the inbox page.
 */
http.route({
  path: "/gmail/oauth/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";
    const back = (result: string) =>
      new Response(null, { status: 302, headers: { Location: `${siteUrl}/inbox?gmail=${result}` } });

    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    if (url.searchParams.get("error") || !state || !code) {
      return back("denied");
    }
    if (!(await ctx.runMutation(internal.gmail.consumeState, { state }))) {
      return back("invalid_state");
    }
    try {
      const tokens = await exchangeCode(code);
      if (!tokens.refreshToken) {
        throw new Error("Google did not return a refresh token");
      }
      const profile = await getProfile(tokens.accessToken);
      await ctx.runMutation(internal.gmail.saveAccount, {
        email: profile.emailAddress.toLowerCase(),
        refreshToken: await encryptSecret(tokens.refreshToken),
        accessToken: await encryptSecret(tokens.accessToken),
        accessTokenExpiresAt: tokens.expiresAt,
      });
      return back("connected");
    } catch (error) {
      console.error("Gmail OAuth callback failed", error);
      return back("error");
    }
  }),
});

export default http;
