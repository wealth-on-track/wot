"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { signIn, auth } from "@/auth";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAssetName } from "@/services/marketData";
import { getLogoUrl } from "@/lib/logos";
import { trackActivity } from "@/services/telemetry";
import { getAssetCategory } from "@/lib/assetCategories";



const RegisterSchema = z.object({
    username: z.string().min(3).regex(/^[a-zA-Z0-9_-]+$/).optional(),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

async function generateUniqueUsername(email: string): Promise<string> {
    // 1. Get prefix from email (e.g., "john.doe" from "john.doe@gmail.com")
    let baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_-]/g, '_');

    // 2. Ensure min length
    if (baseUsername.length < 3) baseUsername += "_user";

    // 3. Check for duplicates and append random number if needed
    let username = baseUsername;
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
        const existing = await prisma.user.findUnique({ where: { username } });
        if (!existing) {
            isUnique = true;
        } else {
            // Append a small random suffix
            const suffix = Math.floor(Math.random() * 900) + 100;
            username = `${baseUsername}${suffix}`;
            attempts++;
        }
    }

    return username;
}

export async function register(prevState: any, formData: FormData) {
    const rawData = Object.fromEntries(formData.entries());
    const validatedFields = RegisterSchema.safeParse(rawData);

    if (!validatedFields.success) {
        return { error: "Invalid fields. Please check your input.", timestamp: Date.now() };
    }

    const { email, password } = validatedFields.data;

    try {
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return { error: "User already exists.", timestamp: Date.now() };
        }

        const username = await generateUniqueUsername(email);
        const hashedPassword = await bcrypt.hash(password, 10);

        const now = new Date();
        // @ts-ignore - Prisma Client type mismatch workaround
        const newUser = await prisma.user.create({
            data: {
                id: crypto.randomUUID(), // Explicit ID workaround
                username,
                email,
                password: hashedPassword,
                createdAt: now,
                updatedAt: now,
                Portfolio: { // Capitalized Relation workaround
                    create: {
                        id: crypto.randomUUID(),
                        isPublic: true,
                        createdAt: now,
                        updatedAt: now,
                    },
                },
            },
        });

        // Track signup
        await trackActivity('AUTH', 'SIGNUP', {
            userId: newUser.id,
            username: newUser.username,
            details: { email: newUser.email }
        });

        // AUTO-LOGIN AFTER SUCCESSFUL REGISTRATION
        await signIn("credentials", {
            email,
            password,
            redirectTo: `/${username}`,
        });

        return { success: true, timestamp: Date.now() };

    } catch (error) {
        if (error instanceof AuthError) {
            return { error: "Failed to sign in after registration.", timestamp: Date.now() };
        }
        console.error("Registration error:", error);
        throw error;
    }
}

export async function authenticate(
    prevState: any,
    formData: FormData,
) {
    try {
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return { status: "user_not_found", timestamp: Date.now() };
        }

        const passwordsMatch = await bcrypt.compare(password, user.password);
        if (!passwordsMatch) {
            return { error: "Invalid credentials.", timestamp: Date.now() };
        }

        const redirectTo = `/${user.username}`;

        await signIn("credentials", {
            ...Object.fromEntries(formData),
            redirectTo,
        });

        return { success: true, timestamp: Date.now() };
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case "CredentialsSignin":
                    return { error: "Invalid credentials.", timestamp: Date.now() };
                default:
                    return { error: "Something went wrong.", timestamp: Date.now() };
            }
        }
        throw error;
    }
}

// Supported currencies across the platform (aligned with Yahoo Finance & global exchanges)
const SUPPORTED_CURRENCIES = ["USD", "EUR", "TRY", "GBP", "CHF", "JPY", "CAD", "AUD", "HKD", "SGD", "ZAR", "CNY", "NZD", "INR", "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "MXN", "BRL", "KRW", "TWD", "THB", "IDR", "MYR", "PHP", "VND", "ILS", "AED", "SAR", "RUB"] as const;

const AssetSchema = z.object({
    symbol: z.string().toUpperCase().min(1),
    category: z.enum(["BIST", "TEFAS", "US_MARKETS", "EU_MARKETS", "CRYPTO", "COMMODITIES", "FX", "CASH"]).optional(),  // New 8-category system
    type: z.enum(["STOCK", "CRYPTO", "GOLD", "BOND", "FUND", "CASH", "COMMODITY", "CURRENCY", "ETF"]),  // Legacy field
    quantity: z.coerce.number().positive(),
    buyPrice: z.coerce.number().positive(),
    currency: z.enum(SUPPORTED_CURRENCIES),
    exchange: z.string().optional(),
    sector: z.string().optional(),
    country: z.string().optional(),
    platform: z.string().optional(),
    customGroup: z.string().optional(),
    logoUrl: z.string().optional(),
    originalName: z.string().optional(),  // Original name from search API
});

export async function addAsset(prevState: string | undefined, formData: FormData) {
    const session = await auth();
    if (!session?.user?.email) return "Not authenticated";

    const rawData = Object.fromEntries(formData.entries());
    // Helper to ensure types match
    const validatedFields = AssetSchema.safeParse(rawData);

    if (!validatedFields.success) {
        console.error('Asset validation failed:', validatedFields.error.format());
        return "Invalid input. Please check all fields.";
    }

    const { symbol, type, category: inputCategory, quantity, buyPrice, currency, exchange, sector: inputSector, country: inputCountry, platform, customGroup, logoUrl, originalName } = validatedFields.data;

    // Use metadata exactly as provided - no overrides, only fallback to UNKNOWN if empty
    const country = inputCountry || 'UNKNOWN';
    const sector = inputSector || 'UNKNOWN';

    // Determine category (use provided or infer from type + exchange)
    const category = inputCategory || getAssetCategory(type, exchange, symbol);

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { Portfolio: true },
        });

        if (!user || !user.Portfolio) return "Portfolio not found";

        // Get minimum sortOrder to place new asset at the top
        const minSortOrder = await prisma.asset.findFirst({
            where: { portfolioId: user.Portfolio.id },
            orderBy: { sortOrder: 'asc' },
            select: { sortOrder: true }
        });

        // New asset gets sortOrder = min - 1 (or 0 if no assets exist)
        const newSortOrder = minSortOrder?.sortOrder != null ? minSortOrder.sortOrder - 1 : 0;

        // Use originalName (from search result) as the display name, or fallback to getAssetName
        const displayName = originalName || (await getAssetName(symbol, type, exchange || undefined)) || symbol;

        const newAsset = await prisma.asset.create({
            data: {
                portfolioId: user.Portfolio.id,
                symbol,
                category,  // NEW: 8-category system
                type,      // Legacy field for backward compatibility
                quantity,
                buyPrice,
                currency,
                exchange: exchange || 'UNKNOWN',
                sector: sector || 'UNKNOWN',
                country: country,
                platform: platform || null,
                customGroup: customGroup || null,
                sortOrder: newSortOrder,  // Add to top of list
                name: displayName,  // Use the original name from search
                originalName: originalName || null,  // Save original name for tooltip
                logoUrl: logoUrl || getLogoUrl(symbol, type, exchange, country),
            },
        });

        // Track asset creation
        await trackActivity('ASSET', 'CREATE', {
            userId: user.id,
            username: user.username,
            targetType: 'Asset',
            targetId: newAsset.id,
            details: {
                symbol,
                type,
                quantity,
                buyPrice,
                currency,
                exchange: exchange || 'UNKNOWN',
                platform
            }
        });

        return "success";
    } catch (error: any) {
        console.error("Add asset error:", error);
        return `Failed to add asset: ${error.message || error}`;
    }
}

export async function deleteAsset(assetId: string) {
    const session = await auth();
    if (!session?.user?.email) return { error: "Not authenticated" };

    try {
        // Verify ownership
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { Portfolio: true }
        });

        if (!user?.Portfolio) return { error: "Portfolio not found" };

        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        if (!asset || asset.portfolioId !== user.Portfolio.id) {
            return { error: "Unauthorized" };
        }

        await prisma.asset.delete({ where: { id: assetId } });

        // Track asset deletion
        await trackActivity('ASSET', 'DELETE', {
            userId: user.id,
            username: user.username,
            targetType: 'Asset',
            targetId: assetId,
            details: {
                symbol: asset.symbol,
                type: asset.type,
                quantity: asset.quantity,
                buyPrice: asset.buyPrice
            }
        });

        return { success: true };
    } catch (error) {
        return { error: "Failed to delete" };
    }
}

/**
 * Get all open positions (assets) for the current user with current prices
 */
export async function getOpenPositions() {
    const session = await auth();
    if (!session?.user?.email) return [];

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                Portfolio: {
                    include: {
                        Asset: {
                            orderBy: { sortOrder: 'asc' }
                        }
                    }
                }
            }
        });

        if (!user?.Portfolio) return [];

        // Process assets through getPortfolioMetrics to get current prices and values
        const { getPortfolioMetrics } = await import('@/lib/portfolio');
        const { assetsWithValues } = await getPortfolioMetrics(user.Portfolio.Asset, undefined, false, user.id);

        // Fetch transactions separately
        const transactions = await prisma.assetTransaction.findMany({
            where: { portfolioId: user.Portfolio.id },
            orderBy: { date: 'desc' }
        });

        // Attach transactions to assets
        console.log(`[getOpenPositions] Processing ${assetsWithValues.length} assets and ${transactions.length} transactions`);

        return assetsWithValues.map(asset => {
            const assetTxs = transactions.filter(t => {
                // 1. Strict Symbol Match
                if (t.symbol === asset.symbol) return true;
                // 2. Original Name/Symbol Match (if imported)
                if (asset.originalName && (t.symbol === asset.originalName || t.name === asset.originalName)) return true;
                // 3. Name Match (fallback)
                if (t.name === asset.name) return true;

                return false;
            });

            return {
                ...asset,
                transactions: assetTxs
            };
        });
    } catch (error) {
        console.error('[getOpenPositions] Error:', error);
        return [];
    }
}

const UpdateAssetSchema = z.object({
    quantity: z.coerce.number().positive(),
    buyPrice: z.coerce.number().nonnegative(),
    name: z.string().optional(),
    // symbol removed - cannot change ticker unique ID
    type: z.enum(["STOCK", "CRYPTO", "GOLD", "BOND", "FUND", "CASH", "COMMODITY", "CURRENCY", "ETF"]).optional(),
    currency: z.enum(SUPPORTED_CURRENCIES).optional(),
    exchange: z.string().optional(),
    sector: z.string().optional(),
    country: z.string().optional(),
    platform: z.string().optional(),
    customGroup: z.string().optional(),
});

type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

export async function updateAsset(assetId: string, data: { quantity: number; buyPrice: number; name?: string; type?: "STOCK" | "CRYPTO" | "GOLD" | "BOND" | "FUND" | "CASH" | "COMMODITY" | "CURRENCY" | "ETF"; currency?: SupportedCurrency; exchange?: string; sector?: string; country?: string; platform?: string; customGroup?: string }) {
    const session = await auth();
    if (!session?.user?.email) return { error: "Not authenticated" };

    const validated = UpdateAssetSchema.safeParse(data);
    if (!validated.success) return { error: "Invalid input" };

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { Portfolio: true }
        });

        if (!user?.Portfolio) return { error: "Portfolio not found" };

        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        if (!asset || asset.portfolioId !== user.Portfolio.id) {
            return { error: "Unauthorized" };
        }

        // If originalName doesn't exist yet (legacy asset), set it to the current name before updating
        const updateData: any = {
            quantity: validated.data.quantity,
            buyPrice: validated.data.buyPrice,
            // Strict Separation: API Data (type/currency/exchange) vs User Overrides (custom...)
            // When user edits in UI, they are setting their PREFERENCE.
            ...(validated.data.type && { customType: validated.data.type }),
            ...(validated.data.currency && { customCurrency: validated.data.currency }),
            ...(validated.data.exchange !== undefined && { customExchange: validated.data.exchange || undefined }),
            // Map sector/country input to CUSTOM fields for user overrides
            ...(validated.data.sector !== undefined && { customSector: validated.data.sector || null }),
            ...(validated.data.country !== undefined && { customCountry: validated.data.country || null }),
            ...(validated.data.platform !== undefined && { platform: validated.data.platform || undefined }),
            ...(validated.data.customGroup !== undefined && { customGroup: validated.data.customGroup }),
        };

        // Handle name update: preserve originalName
        if (validated.data.name) {
            // If originalName doesn't exist, set it to the current name (for legacy assets)
            if (!asset.originalName && asset.name) {
                updateData.originalName = asset.name;
            }
            updateData.name = validated.data.name;
        }

        const updatedAsset = await prisma.asset.update({
            where: { id: assetId },
            data: updateData
        });

        // Track asset update
        await trackActivity('ASSET', 'UPDATE', {
            userId: user.id,
            username: user.username,
            targetType: 'Asset',
            targetId: assetId,
            details: {
                symbol: asset.symbol,
                changes: validated.data
            }
        });

        return { success: true };
    } catch (error) {
        console.error("Update asset error:", error);
        return { error: "Failed to update" };
    }
}


// Reorder assets by updating sortOrder
export async function reorderAssets(assetIds: string[]) {
    const session = await auth();
    if (!session?.user?.email) return { error: "Not authenticated" };

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { Portfolio: true }
        });

        if (!user?.Portfolio) return { error: "Portfolio not found" };

        // Update sortOrder for each asset
        await Promise.all(
            assetIds.map((id, index) =>
                prisma.asset.updateMany({
                    where: {
                        id,
                        portfolioId: user.Portfolio!.id // Verify ownership
                    },
                    data: { sortOrder: index }
                })
            )
        );

        revalidatePath("/");
        revalidatePath(`/${user.username}`);
        return { success: true };
    } catch (error) {
        console.error("Reorder assets error:", error);
        return { error: "Failed to reorder" };
    }
}

export async function refreshPortfolioPrices() {
    const session = await auth();
    if (!session?.user?.id) return { error: "Not authenticated" };

    try {
        const userWithAssets = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: {
                Portfolio: {
                    include: {
                        Asset: true
                    }
                }
            }
        });

        if (!userWithAssets || !userWithAssets.Portfolio) return { error: "User not found" };

        const { getPortfolioMetrics } = await import('@/lib/portfolio');
        const { totalValueEUR } = await getPortfolioMetrics(userWithAssets.Portfolio.Asset, undefined, true);

        // Save snapshot for history
        if (userWithAssets.Portfolio) {
            const { savePortfolioSnapshot } = await import('@/lib/portfolio-history');
            await savePortfolioSnapshot(userWithAssets.Portfolio.id, totalValueEUR);
        }

        revalidatePath(`/${userWithAssets.username}`);
        return { success: true };
    } catch (error) {
        console.error("Refresh prices error:", error);
        return { error: "Failed to refresh prices" };
    }
}

export async function searchAssets(query: string) {
    const session = await auth();
    if (!session?.user?.email) return [];

    try {
        const { searchYahoo } = await import('@/services/yahooApi');
        // We only want to search stocks/etfs for now based on user flow
        const results = await searchYahoo(query);
        return results;
    } catch (error) {
        console.error("Search assets error:", error);
        return [];
    }
}


export async function getAssetMetadata(symbol: string) {
    const session = await auth();
    if (!session?.user?.email) return null;

    try {
        const { getYahooAssetProfile, getYahooQuote } = await import('@/services/yahooApi');
        const { getSearchSymbol } = await import('@/services/marketData');
        const { getCountryFromExchange } = await import('@/lib/exchangeToCountry');

        // 1. Primary Source: Yahoo Finance
        const searchSymbol = getSearchSymbol(symbol, 'STOCK');

        // Parallel fetch for speed
        const [profile, quote] = await Promise.all([
            getYahooAssetProfile(searchSymbol),
            getYahooQuote(searchSymbol)
        ]);

        const exchange = (quote as any)?.exchange || (quote as any)?.fullExchangeName || "";
        let country = profile?.country;

        // 2. Fallback: Derive country from exchange if Yahoo doesn't provide it
        if (!country || country.trim() === "") {
            const derivedCountry = getCountryFromExchange(exchange, searchSymbol);
            if (derivedCountry) {
                console.log(`[Metadata] Derived country "${derivedCountry}" from exchange for ${searchSymbol}`);
                country = derivedCountry;
            }
        }

        return {
            sector: profile?.sector || "",
            country: country || "",
            currency: quote?.currency,
            exchange: exchange,
            name: quote?.symbol || symbol,
            currentPrice: quote?.regularMarketPrice
        };
    } catch (error) {
        console.error("Get asset metadata error:", error);
        return null;
    }
}


// Server action for tracking logo API requests from client components
// Server action for tracking logo API requests from client components
export async function trackLogoRequest(provider: string, isSuccess: boolean, symbol: string, type: string, exchange?: string) {
    "use server";
    try {
        const session = await auth();
        // Silently skip if no session (e.g. demo mode)
        if (!session?.user?.id) return;

        const { trackActivity } = await import("@/services/telemetry");

        // Log to System Activity Log (Visible in Admin Panel)
        await trackActivity('API', 'LOGO_FETCH', {
            userId: session.user.id,
            username: session.user.name || session.user.email?.split('@')[0],
            targetType: 'LOGO',
            targetId: `${symbol} (${provider})`,
            status: isSuccess ? 'SUCCESS' : 'ERROR',
            details: {
                provider,
                symbol,
                type,
                exchange: exchange || 'N/A',
                isSuccess
            }
        });
    } catch (error) {
        // Silently fail - dont break UI if telemetry fails
        // console.error("Failed to track logo request:", error); 
    }
}


// Server action to get autocomplete suggestions for Portfolio and Platform fields
export async function getAutocompleteSuggestions(): Promise<{ portfolios: string[], platforms: string[] }> {
    "use server";
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { portfolios: [], platforms: [] };
        }

        // Get user's portfolio ID
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { Portfolio: { select: { id: true } } }
        });

        if (!user?.Portfolio?.id) {
            return { portfolios: [], platforms: [] };
        }

        const portfolioId = user.Portfolio.id;

        // Get all distinct customGroup (Portfolio) and platform values from user's assets
        const portfolios = await prisma.asset.findMany({
            where: {
                portfolioId: portfolioId,
                customGroup: { not: null }
            },
            select: {
                customGroup: true
            },
            distinct: ['customGroup']
        });

        const platforms = await prisma.asset.findMany({
            where: {
                portfolioId: portfolioId,
                platform: { not: null }
            },
            select: {
                platform: true
            },
            distinct: ['platform']
        });

        // Extract unique values and filter out nulls
        const portfolioList = [...new Set(portfolios.map(p => p.customGroup).filter(Boolean))] as string[];
        const platformList = [...new Set(platforms.map(p => p.platform).filter(Boolean))] as string[];

        // Sort alphabetically for better UX
        portfolioList.sort((a, b) => a.localeCompare(b));
        platformList.sort((a, b) => a.localeCompare(b));

        return {
            portfolios: portfolioList,
            platforms: platformList
        };
    } catch (error) {
        console.error("Get autocomplete suggestions error:", error);
        return { portfolios: [], platforms: [] };
    }
}

// Preferences Logic
export async function updateUserPreferences(newPreferences: any) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Not authenticated");

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { preferences: true }
    });

    const currentPreferences = (user?.preferences as Record<string, any>) || {};
    const updatedPreferences = { ...currentPreferences, ...newPreferences };

    await prisma.user.update({
        where: { email: session.user.email },
        data: { preferences: updatedPreferences }
    });
    // Note: revalidatePath removed to prevent refresh loops.
    // Preferences are managed via client-side state (contexts).
    // The updated preferences will be loaded on next page navigation.
}

export async function getTransactions() {
    const session = await auth();
    if (!session?.user?.email) return [];

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { Portfolio: true }
        });
        if (!user?.Portfolio) return [];

        const transactions = await prisma.assetTransaction.findMany({
            where: { portfolioId: user.Portfolio.id },
            orderBy: { date: 'desc' }
        });
        return transactions;
    } catch (error) {
        console.error("Get transactions error:", error);
        return [];
    }
}

/**
 * Delete user account and ALL associated data permanently
 * Uses transaction to ensure atomic deletion - all or nothing
 * Cascade delete handles: Portfolio → Assets, Transactions, Goals, Snapshots
 */
export async function deleteAccount(): Promise<{ success: boolean; error?: string }> {
    const session = await auth();
    if (!session?.user?.email) {
        return { success: false, error: "Not authenticated" };
    }

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { Portfolio: true }
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        const portfolio = (user as { Portfolio?: { id: string } }).Portfolio;
        const portfolioId = portfolio?.id;

        // Track account deletion before deleting (for audit trail)
        await trackActivity('AUTH', 'DELETE_ACCOUNT', {
            userId: user.id,
            username: user.username,
            details: {
                email: user.email,
                portfolioId: portfolioId,
                deletedAt: new Date().toISOString()
            }
        });

        // Use transaction for atomic deletion - ensures ALL data is deleted
        await prisma.$transaction(async (tx) => {
            if (portfolioId) {
                // 1. Delete all Assets (includes BES, stocks, funds, etc.)
                const deletedAssets = await tx.asset.deleteMany({
                    where: { portfolioId }
                });
                console.log(`[deleteAccount] Deleted ${deletedAssets.count} assets`);

                // 2. Delete all Asset Transactions (BES işlemleri dahil)
                const deletedTransactions = await tx.assetTransaction.deleteMany({
                    where: { portfolioId }
                });
                console.log(`[deleteAccount] Deleted ${deletedTransactions.count} transactions`);

                // 3. Delete all Goals
                const deletedGoals = await tx.goal.deleteMany({
                    where: { portfolioId }
                });
                console.log(`[deleteAccount] Deleted ${deletedGoals.count} goals`);

                // 4. Delete all Portfolio Snapshots
                const deletedSnapshots = await tx.portfolioSnapshot.deleteMany({
                    where: { portfolioId }
                });
                console.log(`[deleteAccount] Deleted ${deletedSnapshots.count} snapshots`);

                // 5. Delete Portfolio
                await tx.portfolio.delete({
                    where: { id: portfolioId }
                });
                console.log(`[deleteAccount] Deleted portfolio ${portfolioId}`);
            }

            // 6. Delete User (this triggers cascade for any remaining relations)
            await tx.user.delete({
                where: { id: user.id }
            });
            console.log(`[deleteAccount] Deleted user ${user.id} (${user.email})`);
        }, {
            timeout: 30000, // 30 second timeout for large portfolios
            maxWait: 10000, // Max 10 seconds to acquire lock
        });

        console.log(`[deleteAccount] Successfully deleted account for ${user.email}`);
        return { success: true };

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[deleteAccount] Failed:", errorMessage);
        return { success: false, error: `Failed to delete account: ${errorMessage}` };
    }
}

// ============================================
// BES (Bireysel Emeklilik Sistemi) Actions
// ============================================

import { BESMetadata, calculateBESTotals } from '@/lib/besTypes';

export async function saveBESData(metadata: BESMetadata, portfolioName?: string, platform?: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { Portfolio: true }
        });

        if (!user?.Portfolio) {
            return { success: false, error: "Portfolio not found" };
        }

        const totals = calculateBESTotals(metadata);

        // Check if BES asset already exists
        const existingBES = await prisma.asset.findFirst({
            where: {
                portfolioId: user.Portfolio.id,
                symbol: 'BES',
                type: 'BES'
            }
        });

        if (existingBES) {
            // Update existing BES asset
            await prisma.asset.update({
                where: { id: existingBES.id },
                data: {
                    quantity: 1,
                    buyPrice: totals.grandTotal,
                    metadata: metadata as any,
                    platform: platform || existingBES.platform,
                    customGroup: portfolioName || existingBES.customGroup,
                    updatedAt: new Date()
                }
            });
        } else {
            // Create new BES asset
            await prisma.asset.create({
                data: {
                    portfolioId: user.Portfolio.id,
                    symbol: 'BES',
                    name: 'BES Emeklilik',
                    type: 'BES',
                    category: 'BES',
                    quantity: 1,
                    buyPrice: totals.grandTotal,
                    currency: 'TRY',
                    exchange: 'BES',
                    sector: 'Pension',
                    country: 'Turkey',
                    platform: platform,
                    customGroup: portfolioName,
                    metadata: metadata as any,
                    sortOrder: -1000 // Put BES at the top
                }
            });
        }

        // Track activity
        await trackActivity('ASSET', 'BES_UPDATE', {
            userId: user.id,
            username: user.username,
            details: {
                contractCount: metadata.contracts.length,
                totalValue: totals.grandTotal
            }
        });

        revalidatePath(`/${user.username}`);
        return { success: true };

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[saveBESData] Failed:", errorMessage);
        return { success: false, error: errorMessage };
    }
}

export async function getBESData(): Promise<BESMetadata | null> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return null;
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { Portfolio: true }
        });

        if (!user?.Portfolio) {
            return null;
        }

        const besAsset = await prisma.asset.findFirst({
            where: {
                portfolioId: user.Portfolio.id,
                symbol: 'BES',
                type: 'BES'
            }
        });

        if (!besAsset?.metadata) {
            return null;
        }

        return besAsset.metadata as unknown as BESMetadata;

    } catch (error) {
        console.error("[getBESData] Failed:", error);
        return null;
    }
}

export async function deleteBESData(): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return { success: false, error: "Unauthorized" };
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { Portfolio: true }
        });

        if (!user?.Portfolio) {
            return { success: false, error: "Portfolio not found" };
        }

        await prisma.asset.deleteMany({
            where: {
                portfolioId: user.Portfolio.id,
                symbol: 'BES',
                type: 'BES'
            }
        });

        revalidatePath(`/${user.username}`);
        return { success: true };

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("[deleteBESData] Failed:", errorMessage);
        return { success: false, error: errorMessage };
    }
}
