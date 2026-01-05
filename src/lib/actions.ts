"use server";


import { z } from "zod";
// import fs from "fs"; -- Removed for Vercel compatibility


import bcrypt from "bcryptjs";
import { signIn, auth } from "@/auth";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAssetName } from "@/services/marketData";



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

        await prisma.user.create({
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
    type: z.enum(["STOCK", "CRYPTO", "GOLD", "BOND", "FUND", "CASH", "COMMODITY"]),
    quantity: z.coerce.number().positive(),
    buyPrice: z.coerce.number().positive(),
    currency: z.enum(["USD", "EUR", "TRY"]),
    exchange: z.string().optional(),
    sector: z.string().optional(),
    country: z.string().optional(),
    platform: z.string().optional(),
    isin: z.string().optional(),
    customGroup: z.string().optional(),
});

export async function addAsset(prevState: string | undefined, formData: FormData) {
    const session = await auth();
    if (!session?.user?.email) return "Not authenticated";

    const rawData = Object.fromEntries(formData.entries());
    // Helper to ensure types match
    const validatedFields = AssetSchema.safeParse(rawData);

    if (!validatedFields.success) {
        return "Invalid input. Please check all fields.";
    }

    const { symbol, type, quantity, buyPrice, currency, exchange, sector, country, platform, isin, customGroup } = validatedFields.data;

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: { portfolio: true },
        });

        if (!user || !user.portfolio) return "Portfolio not found";

        await prisma.asset.create({
            data: {
                portfolioId: user.portfolio.id,
                symbol,
                type,
                quantity,
                buyPrice,
                currency,
                exchange: exchange || null,
                sector: sector || null,
                country: country || null,
                platform: platform || null,
                isin: isin || null,
                customGroup: customGroup || null,
                name: (await getAssetName(symbol, type, exchange || undefined)) || symbol,
            },
        });

        return "success";
    } catch (error) {
        console.error("Add asset error:", error);
        return "Failed to add asset.";
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
        return { success: true };
    } catch (error) {
        return { error: "Failed to delete" };
    }
}

const UpdateAssetSchema = z.object({
    quantity: z.coerce.number().positive(),
    buyPrice: z.coerce.number().nonnegative(),
    name: z.string().optional(),
    symbol: z.string().toUpperCase().optional(),
    type: z.enum(["STOCK", "CRYPTO", "GOLD", "BOND", "FUND", "CASH", "COMMODITY"]).optional(),
    currency: z.enum(["USD", "EUR", "TRY"]).optional(),
    exchange: z.string().optional(),
    sector: z.string().optional(),
    country: z.string().optional(),
    platform: z.string().optional(),
    isin: z.string().optional(),
    customGroup: z.string().optional(),
    nextEarningsDate: z.coerce.date().optional().nullable(),
});

export async function updateAsset(assetId: string, data: { quantity: number; buyPrice: number; name?: string; symbol?: string; type?: "STOCK" | "CRYPTO" | "GOLD" | "BOND" | "FUND" | "CASH" | "COMMODITY"; currency?: "USD" | "EUR" | "TRY"; exchange?: string; sector?: string; country?: string; platform?: string; isin?: string; customGroup?: string; nextEarningsDate?: Date | null }) {
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

        await prisma.asset.update({
            where: { id: assetId },
            data: {
                quantity: validated.data.quantity,
                buyPrice: validated.data.buyPrice,
                ...(validated.data.name && { name: validated.data.name }),
                ...(validated.data.symbol && { symbol: validated.data.symbol }),
                ...(validated.data.type && { type: validated.data.type }),
                ...(validated.data.currency && { currency: validated.data.currency }),
                ...(validated.data.exchange !== undefined && { exchange: validated.data.exchange || null }),
                ...(validated.data.sector !== undefined && { sector: validated.data.sector || null }),
                ...(validated.data.country !== undefined && { country: validated.data.country || null }),
                ...(validated.data.platform !== undefined && { platform: validated.data.platform || null }),
                ...(validated.data.isin !== undefined && { isin: validated.data.isin || null }),
                ...(validated.data.customGroup !== undefined && { customGroup: validated.data.customGroup }),
                ...(validated.data.nextEarningsDate !== undefined && { nextEarningsDate: validated.data.nextEarningsDate }),
            }
        });

        return { success: true };
    } catch (error) {
        console.error("Update asset error:", error);
        return { error: "Failed to update" };
    }
}

// Reorder Assets Action
const ReorderSchema = z.array(z.object({
    id: z.string(),
    rank: z.number()
}));

export async function reorderAssets(items: { id: string; rank: number }[]) {
    // debugLog(`Action triggered. Items: ${items.length}`); // Removed for Vercel
    console.log("[Reorder] Action triggered. Items count:", items.length);

    const session = await auth();
    if (!session?.user?.email) {
        console.error("[Reorder] Auth failed: No session or email");
        return { error: "Not authenticated" };
    }
    console.log("[Reorder] Auth success for:", session.user.email);

    const validated = ReorderSchema.safeParse(items);
    if (!validated.success) {
        console.error("[Reorder] Validation failed:", validated.error);
        return { error: "Invalid data" };
    }
    console.log("[Reorder] Validation success");

    try {
        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            include: {
                portfolio: {
                    include: { assets: { select: { id: true } } }
                }
            }
        });

        if (!user?.portfolio) {
            console.error("[Reorder] User has no portfolio");
            return { error: "Unauthorized" };
        }

        // Verify all item IDs belong to the user's portfolio
        const userAssetIds = new Set(user.portfolio.assets.map(a => a.id));
        const invalidIds = validated.data.filter(item => !userAssetIds.has(item.id));

        if (invalidIds.length > 0) {
            console.error("Attempted to reorder unauthorized assets:", invalidIds);
            return { error: "Unauthorized asset modification" };
        }

        // Execute updates sequentially to ensure order and avoid potential race conditions
        // Execute updates sequentially to ensure order and avoid potential race conditions
        console.log(`[Reorder] Processing ${validated.data.length} items for user ${user.username}`);
        for (const item of validated.data) {
            // console.log(`[Reorder] Updating asset ${item.id} to rank ${item.rank}`);
            await prisma.asset.update({
                where: { id: item.id },
                data: { rank: item.rank }
            });
        }
        console.log("[Reorder] Update complete");

        // Revalidate specific username page to ensure fresh data
        revalidatePath(`/${user.username}`);
        revalidatePath('/');

        return { success: true };
    } catch (error) {
        // debugLog(`Reorder error: ${error}`);
        console.error("Reorder error:", error);

        return { error: `Failed to reorder: ${error instanceof Error ? error.message : String(error)}` };
    }
}

export async function refreshPortfolioPrices() {
    const session = await auth();
    if (!session?.user?.id) return { error: "Not authenticated" };

    try {
        const userWithAssets = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { assets: true }
        });

        if (!userWithAssets) return { error: "User not found" };

        const { getPortfolioMetrics } = await import('@/lib/portfolio');
        await getPortfolioMetrics(userWithAssets.assets, undefined, true);

        revalidatePath(`/${userWithAssets.username}`);
        return { success: true };
    } catch (error) {
        console.error("Refresh prices error:", error);
        return { error: "Failed to refresh prices" };
    }
}
