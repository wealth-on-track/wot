"use server";


import { z } from "zod";
import fs from "fs";

const LOG_FILE = "/Users/ardaak/Downloads/Projects/PT/server_action.log";
function debugLog(msg: string) {
    try {
        fs.appendFileSync(LOG_FILE, new Date().toISOString() + ": " + msg + "\n");
    } catch (e) {
        // ignore
    }
}



function logToFile(message: string) {
    fs.appendFileSync("server_debug.log", new Date().toISOString() + " - " + message + "\n");
}

import bcrypt from "bcryptjs";
import { signIn, auth } from "@/auth";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAssetName } from "@/services/marketData";



const RegisterSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters").regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and dashes"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function register(prevState: string | undefined, formData: FormData) {
    const needsPortfolio = true; // Always create portfolio for new users

    const rawData = Object.fromEntries(formData.entries());
    const validatedFields = RegisterSchema.safeParse(rawData);

    if (!validatedFields.success) {
        return "Invalid fields. Please check your input.";
    }

    const { email, password, username } = validatedFields.data;

    try {
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { username }],
            },
        });

        if (existingUser) {
            return "User already exists (email or username taken).";
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
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

        // Attempt to sign in immediately?
        // Usually we redirect to login or sign them in.
        // For simplicity, let's redirect to login with a success message or handle it client side.
        // But `signIn` can be called server side.

        // However, signIn with "credentials" on server side is tricky without direct calling.
        // We will just return "success" and let client redirect.
        return "success";

    } catch (error) {
        console.error("Registration error:", error);
        return "Something went wrong.";
    }
}

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        const email = formData.get("email") as string;
        const user = await prisma.user.findUnique({
            where: { email },
            select: { username: true }
        });

        const redirectTo = user ? `/${user.username}` : "/";

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
    customGroup: z.string().optional(),
});

export async function updateAsset(assetId: string, data: { quantity: number; buyPrice: number; name?: string; symbol?: string; customGroup?: string }) {
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
                ...(validated.data.customGroup !== undefined && { customGroup: validated.data.customGroup }),
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
    debugLog(`Action triggered. Items: ${items.length}`);
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
        logToFile(`[Reorder] Processing ${validated.data.length} items for user ${user.username}`);
        for (const item of validated.data) {
            logToFile(`[Reorder] Updating asset ${item.id} to rank ${item.rank}`);
            await prisma.asset.update({
                where: { id: item.id },
                data: { rank: item.rank }
            });
        }
        logToFile("[Reorder] Update complete");

        // Revalidate specific username page to ensure fresh data
        revalidatePath(`/${user.username}`);
        revalidatePath('/');

        return { success: true };
    } catch (error) {
        debugLog(`Reorder error: ${error}`);
        console.error("Reorder error:", error);
        return { error: "Failed to reorder" };
    }
}
