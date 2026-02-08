import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

/**
 * Content Security Policy Configuration
 * Restricts resource loading to prevent XSS and data injection attacks
 */
const getCSPHeader = (): string => {
    const isProduction = process.env.NODE_ENV === 'production';

    // Define allowed sources
    const directives = {
        'default-src': ["'self'"],
        'script-src': [
            "'self'",
            "'unsafe-inline'", // Required for Next.js inline scripts
            "'unsafe-eval'", // Required for development hot reload (removed in production ideally)
            isProduction ? '' : "'unsafe-eval'",
        ].filter(Boolean),
        'style-src': ["'self'", "'unsafe-inline'"], // Required for Tailwind/styled components
        'img-src': [
            "'self'",
            'data:',
            'blob:',
            'https://assets.coincap.io',
            'https://img.icons8.com',
            'https://img.logo.dev',
            'https://cdn.jsdelivr.net',
            'https://assets.parqet.com',
            'https://media.licdn.com',
        ],
        'font-src': ["'self'", 'data:'],
        'connect-src': [
            "'self'",
            'https://query1.finance.yahoo.com',
            'https://query2.finance.yahoo.com',
            'https://www.alphavantage.co',
            'https://finnhub.io',
            'https://api.marketstack.com',
            'https://api.tefas.gov.tr',
            isProduction ? '' : 'ws://localhost:*', // WebSocket for dev hot reload
        ].filter(Boolean),
        'frame-ancestors': ["'none'"],
        'form-action': ["'self'"],
        'base-uri': ["'self'"],
        'object-src': ["'none'"],
    };

    return Object.entries(directives)
        .map(([key, values]) => `${key} ${values.join(' ')}`)
        .join('; ');
};

export default auth((req) => {
    const response = NextResponse.next();
    const isProduction = process.env.NODE_ENV === 'production';

    // ============================================
    // SECURITY HEADERS (OWASP Best Practices)
    // ============================================

    // Prevent clickjacking attacks
    response.headers.set('X-Frame-Options', 'DENY');

    // Prevent MIME-type sniffing
    response.headers.set('X-Content-Type-Options', 'nosniff');

    // Control referrer information leakage
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Restrict browser features/APIs
    response.headers.set(
        'Permissions-Policy',
        'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
    );

    // XSS Protection (legacy browsers)
    response.headers.set('X-XSS-Protection', '1; mode=block');

    // DNS Prefetch Control
    response.headers.set('X-DNS-Prefetch-Control', 'on');

    // Content Security Policy
    response.headers.set('Content-Security-Policy', getCSPHeader());

    // Production-only headers
    if (isProduction) {
        // Force HTTPS for 1 year with subdomains
        response.headers.set(
            'Strict-Transport-Security',
            'max-age=31536000; includeSubDomains; preload'
        );

        // Prevent browser from downloading files in site context
        response.headers.set('X-Download-Options', 'noopen');

        // Disable client-side caching for HTML responses (API responses handle their own caching)
        if (!req.nextUrl.pathname.startsWith('/api/')) {
            response.headers.set(
                'Cache-Control',
                'no-store, no-cache, must-revalidate, proxy-revalidate'
            );
        }
    }

    return response;
});

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder assets
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
};
