import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isSignInPage = createRouteMatcher(["/signin"]);

// Optimistic redirects only. The real access check lives in every Convex
// query and mutation (requireUserId), not here.
export const proxy = convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const authed = await convexAuth.isAuthenticated();
    if (isSignInPage(request) && authed) {
      return nextjsMiddlewareRedirect(request, "/");
    }
    if (!isSignInPage(request) && !authed) {
      return nextjsMiddlewareRedirect(request, "/signin");
    }
  },
);

export const config = {
  // Run on everything except static files and Next internals.
  matcher: ["/((?!.*\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
