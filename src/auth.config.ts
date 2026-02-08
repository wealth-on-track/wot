import type { NextAuthConfig } from "next-auth";

/**
 * NextAuth Configuration with Production-Ready Security
 * - JWT-based sessions with secure cookie settings
 * - CSRF protection enabled by default
 * - Strict authorization rules
 */

// Public paths that don't require authentication
const PUBLIC_PATHS = new Set(['/', '/login', '/register', '/demo']);
const PUBLIC_PATH_PREFIXES = ['/api/auth', '/_next', '/api/cron'];

function isPublicPath(pathname: string): boolean {
    // Exact matches
    if (PUBLIC_PATHS.has(pathname)) return true;

    // Prefix matches
    for (const prefix of PUBLIC_PATH_PREFIXES) {
        if (pathname.startsWith(prefix)) return true;
    }

    // Demo routes
    if (pathname.startsWith('/demo/')) return true;

    // Static assets
    if (pathname.includes('favicon.ico')) return true;

    return false;
}

export const authConfig = {
    pages: {
        signIn: "/login",
        newUser: "/register",
        error: "/login", // Redirect auth errors to login page
    },

    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const pathname = nextUrl.pathname;

            // Always allow public paths
            if (isPublicPath(pathname)) {
                // Redirect authenticated users away from auth pages (except on error)
                if (isLoggedIn && (pathname === '/login' || pathname === '/register')) {
                    if (!nextUrl.searchParams.has("error")) {
                        return Response.redirect(new URL("/", nextUrl));
                    }
                }
                return true;
            }

            // Protected paths require authentication
            return isLoggedIn;
        },

        // Enrich JWT with user data
        jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.username = (user as { username?: string }).username;
            }
            return token;
        },

        // Enrich session with JWT data
        session({ session, token }) {
            if (session.user && token) {
                session.user.id = token.id as string;
                (session.user as { username?: string }).username = token.username as string;
            }
            return session;
        },
    },

    providers: [], // Configured in auth.ts

    // Security settings
    secret: process.env.AUTH_SECRET,

    session: {
        strategy: "jwt",
        maxAge: 7 * 24 * 60 * 60, // 7 days (reduced from 30 for security)
        updateAge: 24 * 60 * 60, // Update session every 24 hours
    },

    // Cookie configuration for security
    cookies: {
        sessionToken: {
            name: process.env.NODE_ENV === 'production'
                ? '__Secure-authjs.session-token'
                : 'authjs.session-token',
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            },
        },
        callbackUrl: {
            name: process.env.NODE_ENV === 'production'
                ? '__Secure-authjs.callback-url'
                : 'authjs.callback-url',
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            },
        },
        csrfToken: {
            name: process.env.NODE_ENV === 'production'
                ? '__Host-authjs.csrf-token'
                : 'authjs.csrf-token',
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            },
        },
    },

    trustHost: true,

    // Enable debug logging in development
    debug: process.env.NODE_ENV === 'development',
} satisfies NextAuthConfig;
