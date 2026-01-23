"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { searchYahoo, getYahooQuote } from "@/services/yahooApi";
import { getLogoUrl } from "@/lib/logos";
import { getAssetCategory } from "@/lib/assetCategories";
import { trackActivity } from "@/services/telemetry";
import { cleanAssetName } from "@/lib/companyNames";

export interface ImportAsset {
    symbol: string;
    name?: string;
    quantity: number;
    buyPrice: number;
    currency: 'USD' | 'EUR' | 'TRY';
    type?: string;
    platform?: string;
}

export interface ResolvedAsset extends ImportAsset {
    resolvedSymbol: string;
    resolvedName: string;
    resolvedType: string;
    resolvedCurrency: string;
    exchange?: string;
    country?: string;
    sector?: string;
    currentPrice?: number;
    confidence: number;
    existingAsset?: {
        id: string;
        quantity: number;
        buyPrice: number;
    };
    action: 'add' | 'update' | 'skip';
}

export interface ResolveResult {
    success: boolean;
    resolved: ResolvedAsset[];
    errors: string[];
}

/**
 * Resolve symbols using Yahoo API and check for existing assets
 */
export async function resolveImportSymbols(assets: ImportAsset[]): Promise<ResolveResult> {
    const session = await auth();
    if (!session?.user?.email) {
        return { success: false, resolved: [], errors: ['Not authenticated'] };
    }

    // Get user's existing assets
    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
            portfolio: {
                include: {
                    assets: true
                }
            }
        }
    });

    if (!user?.portfolio) {
        return { success: false, resolved: [], errors: ['Portfolio not found'] };
    }

    const existingAssets = user.portfolio.assets;
    const existingSymbols = new Map(existingAssets.map(a => [a.symbol.toUpperCase(), a]));

    const resolved: ResolvedAsset[] = [];
    const errors: string[] = [];

    // Process in batches of 5 to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < assets.length; i += batchSize) {
        const batch = assets.slice(i, i + batchSize);

        const batchResults = await Promise.all(
            batch.map(async (asset): Promise<ResolvedAsset> => {
                let confidence = 100;
                let resolvedSymbol = asset.symbol;
                let resolvedName = asset.name || asset.symbol;
                let resolvedType = asset.type || 'STOCK';
                let resolvedCurrency = asset.currency;
                let exchange: string | undefined;
                let country: string | undefined;
                let sector: string | undefined;
                let currentPrice: number | undefined;

                try {
                    // Search for the symbol
                    const searchResults = await searchYahoo(asset.symbol);

                    if (searchResults.length > 0) {
                        const best = searchResults[0];

                        // Check if exact symbol match
                        const exactMatch = searchResults.find(
                            r => r.symbol.toUpperCase() === asset.symbol.toUpperCase()
                        );

                        const match = exactMatch || best;

                        resolvedSymbol = match.symbol;
                        resolvedName = cleanAssetName(match.shortname || match.longname || asset.name || asset.symbol);
                        exchange = match.exchange;

                        // Determine type
                        if (match.quoteType === 'CRYPTOCURRENCY') resolvedType = 'CRYPTO';
                        else if (match.quoteType === 'ETF') resolvedType = 'FUND';
                        else if (match.quoteType === 'MUTUALFUND') resolvedType = 'FUND';
                        else resolvedType = 'STOCK';

                        // Adjust confidence based on match quality
                        if (!exactMatch) {
                            confidence -= 15; // Not exact match
                        }

                        // Get current quote for price
                        try {
                            const quote = await getYahooQuote(resolvedSymbol);
                            if (quote) {
                                currentPrice = quote.regularMarketPrice;
                                resolvedCurrency = (quote.currency || asset.currency) as 'USD' | 'EUR' | 'TRY';
                            }
                        } catch {
                            // Ignore quote errors
                        }
                    } else {
                        // No search results - keep original, lower confidence
                        confidence = 50;
                    }
                } catch (error) {
                    // Search failed - keep original
                    confidence = 40;
                    errors.push(`Failed to resolve ${asset.symbol}`);
                }

                // Check if exists in portfolio
                const existing = existingSymbols.get(resolvedSymbol.toUpperCase());

                // Determine default action
                let action: 'add' | 'update' | 'skip' = 'add';
                if (existing) {
                    action = 'update'; // Default to update if exists
                }

                // Infer country from exchange
                if (exchange) {
                    if (exchange.includes('IST') || exchange.includes('BIST')) {
                        country = 'Turkey';
                        resolvedCurrency = 'TRY';
                    } else if (exchange.includes('NAS') || exchange.includes('NYS') || exchange.includes('NYSE') || exchange.includes('NASDAQ')) {
                        country = 'USA';
                    } else if (exchange.includes('LON') || exchange.includes('LSE')) {
                        country = 'United Kingdom';
                    } else if (exchange.includes('FRA') || exchange.includes('GER')) {
                        country = 'Germany';
                    }
                }

                return {
                    ...asset,
                    resolvedSymbol,
                    resolvedName,
                    resolvedType,
                    resolvedCurrency,
                    exchange,
                    country,
                    sector,
                    currentPrice,
                    confidence,
                    existingAsset: existing ? {
                        id: existing.id,
                        quantity: existing.quantity,
                        buyPrice: existing.buyPrice
                    } : undefined,
                    action
                };
            })
        );

        resolved.push(...batchResults);

        // Small delay between batches
        if (i + batchSize < assets.length) {
            await new Promise(r => setTimeout(r, 200));
        }
    }

    return { success: true, resolved, errors };
}

export interface ImportResult {
    success: boolean;
    added: number;
    updated: number;
    skipped: number;
    errors: string[];
    txAdded?: number;
}

/**
 * Execute the import - add/update assets based on user selections
 */
/**
 * Execute the import - add/update assets based on user selections
 */
export async function executeImport(
    assets: ResolvedAsset[],
    transactions: any[] = [], // Using any[] to avoid strict type dependency circularity if needed, but preferably specific type
    portfolioId?: string // Optional portfolioId - if not provided, use user's default portfolio
): Promise<ImportResult> {
    const session = await auth();
    if (!session?.user?.email) {
        return { success: false, added: 0, updated: 0, skipped: 0, errors: ['Not authenticated'] };
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: { portfolio: true }
    });

    if (!user) {
        return { success: false, added: 0, updated: 0, skipped: 0, errors: ['User not found'] };
    }

    // Use provided portfolioId or fall back to user's default portfolio
    const targetPortfolioId = portfolioId || user.portfolio?.id;

    if (!targetPortfolioId) {
        return { success: false, added: 0, updated: 0, skipped: 0, errors: ['Portfolio not found'] };
    }

    let added = 0;
    let updated = 0;
    let skipped = 0;
    let txAdded = 0;
    const errors: string[] = [];

    // Create a map of raw symbol -> resolved asset for quick lookup
    // This helps us link transactions to the correct final symbol
    const assetMap = new Map<string, ResolvedAsset>();
    for (const asset of assets) {
        assetMap.set(asset.symbol, asset);
        // Also map by resolved symbol just in case
        assetMap.set(asset.resolvedSymbol, asset);
    }

    // Get minimum sortOrder for new assets
    const minSortOrder = await prisma.asset.findFirst({
        where: { portfolioId: targetPortfolioId },
        orderBy: { sortOrder: 'asc' },
        select: { sortOrder: true }
    });

    let currentSortOrder = minSortOrder?.sortOrder != null ? minSortOrder.sortOrder - 1 : 0;

    // 1. Process Assets (Snapshots)
    for (const asset of assets) {
        try {
            if (asset.action === 'skip') {
                skipped++;
                continue;
            }

            const category = getAssetCategory(
                asset.resolvedType as any,
                asset.exchange,
                asset.resolvedSymbol
            );

            if (asset.action === 'add') {
                // Create new asset
                await prisma.asset.create({
                    data: {
                        portfolioId: targetPortfolioId,
                        symbol: asset.resolvedSymbol,
                        name: asset.resolvedName,
                        originalName: asset.resolvedName,
                        category,
                        type: asset.resolvedType,
                        quantity: asset.quantity,
                        buyPrice: asset.buyPrice,
                        currency: asset.resolvedCurrency,
                        exchange: asset.exchange || 'UNKNOWN',
                        country: asset.country || 'UNKNOWN',
                        sector: asset.sector || 'UNKNOWN',
                        platform: asset.platform || null,
                        sortOrder: currentSortOrder--,
                        logoUrl: getLogoUrl(
                            asset.resolvedSymbol,
                            asset.resolvedType,
                            asset.exchange,
                            asset.country
                        )
                    }
                });
                added++;
            } else if (asset.action === 'update' && asset.existingAsset) {
                // Update existing asset
                await prisma.asset.update({
                    where: { id: asset.existingAsset.id },
                    data: {
                        quantity: asset.quantity,
                        buyPrice: asset.buyPrice, // Update average buy price
                        // Don't update other fields - user may have customized them
                    }
                });
                updated++;
            }
        } catch (error) {
            errors.push(`Failed to ${asset.action} ${asset.resolvedSymbol}: ${error}`);
        }
    }

    // 2. Process Transactions (History)
    if (transactions && transactions.length > 0) {
        for (const tx of transactions) {
            try {
                // Determine resolved symbol using our map
                const asset = assetMap.get(tx.symbol);

                // IMPORTANT: Don't skip transactions for closed positions
                // Use resolved symbol if available, otherwise use original symbol
                // This ensures we save ALL transaction history, even for fully closed positions
                const resolvedSymbol = asset ? asset.resolvedSymbol : tx.symbol;

                // Try to create transaction, ignore duplicates if externalId exists and matches
                // We use Upsert if we want to update, but usually history is immutable unless explicit update.
                // Since user might re-import corrected file, let's use externalId to prevent duplicates.

                if (tx.externalId) {
                    await prisma.assetTransaction.upsert({
                        where: {
                            portfolioId_externalId: {
                                portfolioId: targetPortfolioId,
                                externalId: tx.externalId
                            }
                        },
                        update: {
                            symbol: resolvedSymbol,
                            quantity: tx.quantity,
                            price: tx.price,
                            currency: tx.currency,
                            date: new Date(tx.date),
                            type: tx.type
                        },
                        create: {
                            portfolioId: targetPortfolioId,
                            symbol: resolvedSymbol,
                            name: tx.name,
                            type: tx.type,
                            quantity: tx.quantity,
                            price: tx.price,
                            currency: tx.currency,
                            date: new Date(tx.date),
                            exchange: tx.exchange,
                            platform: tx.platform,
                            externalId: tx.externalId
                        }
                    });
                } else {
                    // No external ID - create new record (potential for duplicates on re-import, but safer than crashing)
                    // TODO: Implement fuzzy duplicate detection
                    await prisma.assetTransaction.create({
                        data: {
                            portfolioId: targetPortfolioId,
                            symbol: resolvedSymbol,
                            name: tx.name,
                            type: tx.type,
                            quantity: tx.quantity,
                            price: tx.price,
                            currency: tx.currency,
                            date: new Date(tx.date),
                            exchange: tx.exchange,
                            platform: tx.platform
                        }
                    });
                }
                txAdded++;
            } catch (error) {
                // If it's a unique constraint violation that wasn't caught by upsert (unlikely for externalId), ignore it
                console.warn(`Failed to save transaction for ${tx.symbol}:`, error);
                errors.push(`Tx Error ${tx.symbol}: ${error}`);
            }
        }
        console.log(`[Import] Processed ${transactions.length} transactions, successfully added ${txAdded}`);
    }

    // Track the import activity
    await trackActivity('PORTFOLIO', 'CREATE', {
        userId: user.id,
        username: user.username,
        details: {
            action: 'BULK_IMPORT',
            totalAssets: assets.length,
            added,
            updated,
            skipped,
            errors: errors.length
        }
    });

    // Revalidate paths
    revalidatePath('/');
    revalidatePath(`/${user.username}`);

    return {
        success: errors.length === 0,
        added,
        updated,
        skipped,
        errors,
        txAdded
    };
}
