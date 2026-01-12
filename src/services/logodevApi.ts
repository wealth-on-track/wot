import { trackApiRequest } from './telemetry';

const LOGODEV_API_KEY = process.env.NEXT_PUBLIC_LOGODEV_API_KEY || 'pk_OYRe85gjScGyAdhJcb1Jag';

export interface LogoDevResponse {
    url: string;
    success: boolean;
}

export const getLogoDevLogo = async (ticker: string): Promise<string | null> => {
    const url = `https://img.logo.dev/ticker/${ticker}?token=${LOGODEV_API_KEY}`;

    try {
        const response = await fetch(url);

        if (response.ok) {
            await trackApiRequest('LOGODEV', true);
            return url;
        } else {
            await trackApiRequest('LOGODEV', false, { error: `HTTP ${response.status}` });
            return null;
        }
    } catch (error) {
        await trackApiRequest('LOGODEV', false, { error: error instanceof Error ? error.message : 'Unknown error' });
        return null;
    }
};
