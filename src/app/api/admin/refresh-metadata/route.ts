import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getYahooAssetProfile } from "@/services/yahooApi";
import { getManualMapping } from "@/lib/symbolMapping";
import { requireAdminAccess } from "@/lib/rbac";
import { apiMiddleware, STRICT_RATE_LIMIT } from '@/lib/api-security';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    // Apply rate limiting
    const middlewareResult = await apiMiddleware(request, { rateLimit: STRICT_RATE_LIMIT });
    if (middlewareResult) return middlewareResult;

    // SECURITY: Require admin role - not just authentication
    const adminUser = await requireAdminAccess();
    if (!adminUser) {
        return NextResponse.json(
            { error: "Admin access required", code: "FORBIDDEN" },
            { status: 403 }
        );
    }

    try {
        console.log('[RefreshMetadata] Starting metadata refresh for all assets...');

        // Get all unique symbols from PriceCache that are missing sector/country
        const cachesToUpdate = await prisma.priceCache.findMany({
            where: {
                OR: [
                    { sector: null },
                    { country: null },
                    { sector: 'unknown' },
                    { country: 'unknown' }
                ]
            }
        });

        console.log(`[RefreshMetadata] Found ${cachesToUpdate.length} symbols needing metadata update`);

        let updated = 0;
        let failed = 0;

        for (const cache of cachesToUpdate) {
            try {
                const symbol = cache.symbol;
                console.log(`[RefreshMetadata] Processing ${symbol}...`);

                let profileData: { country?: string; sector?: string; industry?: string } | null = null;

                // TIER 1: Yahoo Finance
                try {
                    profileData = await getYahooAssetProfile(symbol);
                    if (profileData?.sector || profileData?.country) {
                        console.log(`[RefreshMetadata] Yahoo Finance success for ${symbol}`);
                    }
                } catch (e) {
                    console.warn(`[RefreshMetadata] Yahoo failed for ${symbol}`);
                }

                // TIER 2: Alpha Vantage (if Yahoo failed)
                if (!profileData || (!profileData.sector && !profileData.country)) {
                    try {
                        const { getCompanyOverview } = await import('@/services/alphaVantageApi');
                        const alphaData = await getCompanyOverview(symbol);
                        if (alphaData) {
                            profileData = {
                                country: profileData?.country || alphaData.country,
                                sector: profileData?.sector || alphaData.sector,
                                industry: profileData?.industry || alphaData.industry
                            };
                            console.log(`[RefreshMetadata] Alpha Vantage success for ${symbol}`);
                        }
                    } catch (e) {
                        console.warn(`[RefreshMetadata] Alpha Vantage failed for ${symbol}`);
                    }
                }

                // TIER 3: Finnhub (if still missing)
                if (!profileData || (!profileData.sector && !profileData.country)) {
                    try {
                        const { getCompanyProfile } = await import('@/services/finnhubApi');
                        const finnhubData = await getCompanyProfile(symbol);
                        if (finnhubData) {
                            profileData = {
                                country: profileData?.country || finnhubData.country,
                                sector: profileData?.sector || (finnhubData.sector || finnhubData.finnhubIndustry),
                                industry: profileData?.industry || finnhubData.industry
                            };
                            console.log(`[RefreshMetadata] Finnhub success for ${symbol}`);
                        }
                    } catch (e) {
                        console.warn(`[RefreshMetadata] Finnhub failed for ${symbol}`);
                    }
                }

                // TIER 4: Manual Mapping (guaranteed fallback)
                if (!profileData || (!profileData.sector && !profileData.country)) {
                    const manualData = getManualMapping(symbol, symbol);
                    if (manualData) {
                        profileData = {
                            country: profileData?.country || manualData.country,
                            sector: profileData?.sector || manualData.sector,
                            industry: profileData?.industry || manualData.industry
                        };
                        console.log(`[RefreshMetadata] Manual mapping success for ${symbol}`);
                    }
                }

                // Update database if we got data
                if (profileData && (profileData.sector || profileData.country)) {
                    await prisma.priceCache.update({
                        where: { symbol },
                        data: {
                            sector: profileData.sector || cache.sector,
                            country: profileData.country || cache.country
                        }
                    });
                    updated++;
                    console.log(`[RefreshMetadata] Updated ${symbol} in PriceCache`);
                } else {
                    failed++;
                    console.warn(`[RefreshMetadata] No data found for ${symbol}`);
                }

                // Small delay
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.error(`[RefreshMetadata] Error processing ${cache.symbol}:`, error);
                failed++;
            }
        }

        // STEP 2: FORCE SYNC ALL ASSETS FROM PRICE CACHE
        // This ensures that even if PriceCache was already correct, the Asset table gets updated.
        console.log('[RefreshMetadata] Starting Asset Table Sync...');
        const allValidCaches = await prisma.priceCache.findMany({
            where: {
                AND: [
                    { sector: { not: null } },
                    { country: { not: null } },
                    { sector: { not: 'unknown' } },
                    { country: { not: 'unknown' } }
                ]
            }
        });

        let syncedAssets = 0;
        for (const cache of allValidCaches) {
            if (cache.sector && cache.country) {
                const result = await prisma.asset.updateMany({
                    where: { symbol: cache.symbol },
                    data: {
                        sector: cache.sector,
                        country: cache.country
                    }
                });
                if (result.count > 0) {
                    syncedAssets += result.count;
                    console.log(`[RefreshMetadata] Synced ${result.count} assets for ${cache.symbol}`);
                }
            }
        }

        console.log(`[RefreshMetadata] Complete. Updated Cache: ${updated}, Failed: ${failed}, Synced Assets: ${syncedAssets}`);

        return NextResponse.json({
            success: true,
            message: `Refresh complete. Updated ${updated} caches. Synced ${syncedAssets} assets from cache.`,
            updated,
            failed,
            syncedAssets,
            total: cachesToUpdate.length
        });

    } catch (error: any) {
        console.error('[RefreshMetadata] Error:', error);
        return NextResponse.json(
            { error: error.message || "Failed to refresh metadata" },
            { status: 500 }
        );
    }
}
