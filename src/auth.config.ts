import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
    newUser: "/register",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;

      // Define public paths
      const isPublicPath =
        nextUrl.pathname === "/" ||
        nextUrl.pathname.startsWith("/login") ||
        nextUrl.pathname.startsWith("/register") ||
        nextUrl.pathname.startsWith("/api/auth") ||
        nextUrl.pathname.startsWith("/_next") ||
        nextUrl.pathname.includes("favicon.ico");

      // Exception for Demo
      const isDemo = nextUrl.pathname === "/demo" || nextUrl.pathname.startsWith("/demo/");

      if (isDemo) return true;

      if (isLoggedIn) {
        // Redirect logged-in users away from auth pages
        if (nextUrl.pathname.startsWith("/login") || nextUrl.pathname.startsWith("/register")) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      // Allow public paths for everyone
      if (isPublicPath) {
        return true;
      }

      // Redirect unauthenticated users to login
      return false;
    },
  },
  providers: [], // Configured in auth.ts
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  trustHost: true,
} satisfies NextAuthConfig;
