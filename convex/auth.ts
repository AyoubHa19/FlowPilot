import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { emailList } from "./lib/auth";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      // Sign-up is closed except for ALLOWED_SIGNUP_EMAILS (comma-separated),
      // so a public demo URL cannot be used to create accounts. When the
      // variable is not set (local development), anyone can sign up.
      profile(params) {
        const email = String(params.email ?? "").trim().toLowerCase();
        const allowed = emailList("ALLOWED_SIGNUP_EMAILS");
        if (params.flow === "signUp" && allowed !== null && !allowed.includes(email)) {
          throw new ConvexError("Sign-up is closed. Use the demo login shown on this page.");
        }
        return { email };
      },
    }),
  ],
});
