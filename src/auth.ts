import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { trackActivity } from "@/services/telemetry";

async function getUser(email: string) {
    try {
        const user = await prisma.user.findUnique({ where: { email } });
        return user;
    } catch (error) {
        console.error("Failed to fetch user:", error);
        throw new Error("Failed to fetch user.");
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                // SECURITY: Minimum 8 characters for stronger password security
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(8) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;
                    const user = await getUser(email);
                    if (!user) return null;

                    const passwordsMatch = await bcrypt.compare(password, user.password);
                    if (passwordsMatch) {
                        // Track successful login
                        await trackActivity('AUTH', 'LOGIN', {
                            userId: user.id,
                            username: user.username,
                            details: { email: user.email }
                        });

                        return {
                            id: user.id,
                            name: user.username,
                            email: user.email,
                        };
                    }

                    // Track failed login attempt
                    await trackActivity('AUTH', 'LOGIN', {
                        username: email,
                        status: 'ERROR',
                        errorMessage: 'Invalid password',
                        details: { email }
                    });
                }

                console.log("Invalid credentials");
                return null;
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user && token.id) {
                session.user.id = token.id as string;
            }
            return session;
        }
    },
    // AUTH_SECRET is required - no fallback for security
    secret: process.env.AUTH_SECRET,
});
