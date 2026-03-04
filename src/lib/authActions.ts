"use server";

import { headers } from "next/headers";
import { signOut } from "@/auth";

export async function handleSignOut() {
    // Force same-origin redirect (prevents accidental localhost callback in production)
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto = h.get("x-forwarded-proto") || "https";
    const redirectTo = host ? `${proto}://${host}/` : "/";

    await signOut({ redirectTo });
}
