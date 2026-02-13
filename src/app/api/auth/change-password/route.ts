import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { apiMiddleware, AUTH_RATE_LIMIT } from "@/lib/api-security";

// Password validation regex patterns
const PASSWORD_MIN_LENGTH = 12;
const HAS_UPPERCASE = /[A-Z]/;
const HAS_LOWERCASE = /[a-z]/;
const HAS_NUMBER = /[0-9]/;

function validatePassword(password: string): { valid: boolean; error?: string } {
    if (password.length < PASSWORD_MIN_LENGTH) {
        return { valid: false, error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` };
    }
    if (!HAS_UPPERCASE.test(password)) {
        return { valid: false, error: 'Password must contain at least one uppercase letter' };
    }
    if (!HAS_LOWERCASE.test(password)) {
        return { valid: false, error: 'Password must contain at least one lowercase letter' };
    }
    if (!HAS_NUMBER.test(password)) {
        return { valid: false, error: 'Password must contain at least one number' };
    }
    return { valid: true };
}

export async function POST(request: NextRequest) {
    // Apply rate limiting for auth operations
    const middlewareResult = await apiMiddleware(request, { rateLimit: AUTH_RATE_LIMIT });
    if (middlewareResult) return middlewareResult;

    try {
        // Check authentication
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        // Parse request body
        const { currentPassword, newPassword } = await request.json();

        // Validate inputs
        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { error: 'Current password and new password are required' },
                { status: 400 }
            );
        }

        // Validate password strength
        const validation = validatePassword(newPassword);
        if (!validation.valid) {
            return NextResponse.json(
                { error: validation.error },
                { status: 400 }
            );
        }

        // Get user from database
        const user = await prisma.user.findUnique({
            where: { email: session.user.email }
        });

        if (!user || !user.password) {
            return NextResponse.json(
                { error: 'User not found or password not set' },
                { status: 404 }
            );
        }

        // Verify current password
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return NextResponse.json(
                { error: 'Current password is incorrect' },
                { status: 400 }
            );
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password in database
        await prisma.user.update({
            where: { email: session.user.email },
            data: { password: hashedPassword }
        });

        return NextResponse.json(
            { message: 'Password changed successfully' },
            { status: 200 }
        );
    } catch (error) {
        console.error('Password change error:', error);
        return NextResponse.json(
            { error: 'An error occurred while changing password' },
            { status: 500 }
        );
    }
}
