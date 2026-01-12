import { prisma } from '@/lib/prisma';
import { getLogoUrl } from '@/lib/logos';

/**
 * Get logo URL for an asset, with caching
 * 1. Check if asset has cached logoUrl in database
 * 2. If not, generate logo URL and cache it
 * 3. Return cached or generated URL
 */
export async function getCachedLogoUrl(
    assetId: string,
    symbol: string,
    type: string,
    exchange?: string,
    country?: string
): Promise<string | null> {
    try {
        // 1. Check if asset has cached logo
        const asset = await prisma.asset.findUnique({
            where: { id: assetId },
            select: { logoUrl: true }
        });

        if (asset?.logoUrl) {
            return asset.logoUrl;
        }

        // 2. Generate logo URL
        const logoUrl = getLogoUrl(symbol, type, exchange, country);

        // 3. Cache it in database (fire and forget)
        if (logoUrl) {
            prisma.asset.update({
                where: { id: assetId },
                data: { logoUrl }
            }).catch(() => {/* ignore cache errors */ });
        }

        return logoUrl;
    } catch (error) {
        console.error('Error getting cached logo:', error);
        // Fallback to direct generation
        return getLogoUrl(symbol, type, exchange, country);
    }
}
