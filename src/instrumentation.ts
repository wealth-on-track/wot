/**
 * Next.js Instrumentation
 * Initializes Sentry on server startup
 */

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        await import('../sentry.server.config');
    }

    if (process.env.NEXT_RUNTIME === 'edge') {
        await import('../sentry.edge.config');
    }
}

export const onRequestError = async (
    err: { digest: string } & Error,
    request: {
        path: string;
        method: string;
        headers: { [key: string]: string };
    },
    context: {
        routerKind: 'Pages Router' | 'App Router';
        routePath: string;
        routeType: 'render' | 'route' | 'action' | 'middleware';
        renderSource: 'react-server-components' | 'react-server-components-payload' | 'server-rendering';
        revalidateReason: 'on-demand' | 'stale' | undefined;
        renderType: 'dynamic' | 'dynamic-resume';
    }
) => {
    // Only import Sentry if configured
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
        const Sentry = await import('@sentry/nextjs');

        Sentry.captureException(err, {
            tags: {
                routerKind: context.routerKind,
                routeType: context.routeType,
                renderSource: context.renderSource,
            },
            extra: {
                path: request.path,
                method: request.method,
                routePath: context.routePath,
                revalidateReason: context.revalidateReason,
                digest: err.digest,
            },
        });
    }
};
