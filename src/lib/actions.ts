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

export async function register(prevState: string | undefined, formData: FormData) {
    const rawData = Object.fromEntries(formData.entries());
    const validatedFields = RegisterSchema.safeParse(rawData);

    if (!validatedFields.success) {
        return "Invalid fields. Please check your input.";
    }

    const { email, password } = validatedFields.data;

    try {
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return "User already exists.";
        }

        const username = await generateUniqueUsername(email);
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                username,
                email,
                password: hashedPassword,
                portfolio: {
                    create: {
                        isPublic: true,
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

        return "success";

    } catch (error) {
        if (error instanceof AuthError) {
            return "Failed to sign in after registration.";
        }
        console.error("Registration error:", error);
        throw error;
    }
}

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        const email = formData.get("email") as string;
        const password = formData.get("password") as string;

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return "user_not_found";
        }

        const passwordsMatch = await bcrypt.compare(password, user.password);
        if (!passwordsMatch) {
            return "Invalid credentials.";
        }

        const redirectTo = `/${user.username}`;

        await signIn("credentials", {
            ...Object.fromEntries(formData),
            redirectTo,
        });
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case "CredentialsSignin":
                    return "Invalid credentials.";
                default:
                    return "Something went wrong.";
            }
        }
        throw error;
    }
}

const AssetSchema = z.object({
    symbol: z.string().toUpperCase().min(1),
    category: z.enum(["BIST", "TEFAS", "US_MARKETS", "EU_MARKETS", "CRYPTO", "COMMODITIES", "FX", "CASH"]).optional(),  // New 8-category system
    type: z.enum(["STOCK", "CRYPTO", "GOLD", "BOND", "FUND", "CASH", "COMMODITY", "CURRENCY", "ETF"]),  // Legacy field
    quantity: z.coerce.number().positive(),
    buyPrice: z.coerce.number().positive(),
    currency: z.enum(["USD", "EUR", "TRY"]),
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
            include: { portfolio: true },
        });

        if (!user || !user.portfolio) return "Portfolio not found";

        // Get minimum sortOrder to place new asset at the top
        const minSortOrder = await prisma.asset.findFirst({
            where: { portfolioId: user.portfolio.id },
            orderBy: { sortOrder: 'asc' },
            select: { sortOrder: true }
        });

        // New asset gets sortOrder = min - 1 (or 0 if no assets exist)
        const newSortOrder = minSortOrder?.sortOrder != null ? minSortOrder.sortOrder - 1 : 0;

        // Use originalName (from search result) as the display name, or fallback to getAssetName
        const displayName = originalName || (await getAssetName(symbol, type, exchange || undefined)) || symbol;

        const newAsset = await prisma.asset.create({
            data: {
                portfolioId: user.portfolio.id,
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
            include: { portfolio: true }
        });

        if (!user?.portfolio) return { error: "Portfolio not found" };

        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        if (!asset || asset.portfolioId !== user.portfolio.id) {
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

const UpdateAssetSchema = z.object({
    quantity: z.coerce.number().positive(),
    buyPrice: z.coerce.number().nonnegative(),
    name: z.string().optional(),
    // symbol removed - cannot change ticker unique ID
    type: z.enum(["STOCK", "CRYPTO", "GOLD", "BOND", "FUND", "CASH", "COMMODITY", "CURRENCY", "ETF"]).optional(),
    currency: z.enum(["USD", "EUR", "TRY"]).optional(),
    exchange: z.string().optional(),
    sector: z.string().optional(),
    country: z.string().optional(),
    platform: z.string().optional(),
    customGroup: z.string().optional(),
});

export async function updateAsset(assetId: string, data: { quantity: number; buyPrice: number; name?: string; type?: "STOCK" | "CRYPTO" | "GOLD" | "BOND" | "FUND" | "CASH" | "COMMODITY" | "CURRENCY" | "ETF"; currency?: "USD" | "EUR" | "TRY"; exchange?: string; sector?: string; country?: string; platform?: string; customGroup?: string }) {
    const session = await auth();
    if (!session?.user?.email) return { error: "Not authenticated" };

    const validated = UpdateAssetSchema.safeParse(data);
    if (!validated.success) return { error: "Invalid input" };

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { portfolio: true }
        });

        if (!user?.portfolio) return { error: "Portfolio not found" };

        const asset = await prisma.asset.findUnique({ where: { id: assetId } });
        if (!asset || asset.portfolioId !== user.portfolio.id) {
            return { error: "Unauthorized" };
        }

        // If originalName doesn't exist yet (legacy asset), set it to the current name before updating
        const updateData: any = {
            quantity: validated.data.quantity,
            buyPrice: validated.data.buyPrice,
            ...(validated.data.type && { type: validated.data.type }),
            ...(validated.data.currency && { currency: validated.data.currency }),
            ...(validated.data.exchange !== undefined && { exchange: validated.data.exchange || undefined }),
            ...(validated.data.sector !== undefined && { sector: validated.data.sector || undefined }),
            ...(validated.data.country !== undefined && { country: validated.data.country || undefined }),
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
            include: { portfolio: true }
        });

        if (!user?.portfolio) return { error: "Portfolio not found" };

        // Update sortOrder for each asset
        await Promise.all(
            assetIds.map((id, index) =>
                prisma.asset.updateMany({
                    where: {
                        id,
                        portfolioId: user.portfolio!.id // Verify ownership
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
                portfolio: {
                    include: {
                        assets: true
                    }
                }
            }
        });

        if (!userWithAssets || !userWithAssets.portfolio) return { error: "User not found" };

        const { getPortfolioMetrics } = await import('@/lib/portfolio');
        const { totalValueEUR } = await getPortfolioMetrics(userWithAssets.portfolio.assets, undefined, true);

        // Save snapshot for history
        if (userWithAssets.portfolio) {
            const { savePortfolioSnapshot } = await import('@/lib/portfolio-history');
            await savePortfolioSnapshot(userWithAssets.portfolio.id, totalValueEUR);
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
        const { trackActivity } = await import("@/services/telemetry");

        // Log to System Activity Log (Visible in Admin Panel)
        await trackActivity('API', 'LOGO_FETCH', {
            userId: session?.user?.id,
            username: session?.user?.name || session?.user?.email?.split('@')[0],
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
        console.error("Failed to track logo request:", error);
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

        // Get all distinct customGroup (Portfolio) and platform values from all assets
        // We'll use raw query for better performance
        const portfolios = await prisma.asset.findMany({
            where: {
                customGroup: { not: null }
            },
            select: {
                customGroup: true
            },
            distinct: ['customGroup']
        });

        const platforms = await prisma.asset.findMany({
            where: {
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
export async function updateUserPreferences(preferences: any) {
    const session = await auth();
    if (!session?.user?.email) throw new Error("Not authenticated");

    await prisma.user.update({
        where: { email: session.user.email },
        data: { preferences }
    });
    // Optional: revalidatePath might not be needed if state is local, 
    // but good for ensuring fresh data on reload.
    revalidatePath("/[username]", "page");
}
