/**
 * Environment Variables Validation
 * Validates required environment variables at build/runtime
 */

interface EnvConfig {
  // Database
  DATABASE_URL: string;
  POSTGRES_PRISMA_URL?: string;
  POSTGRES_URL_NON_POOLING?: string;

  // Auth
  AUTH_SECRET: string;
  NEXTAUTH_URL?: string;

  // External APIs (Optional)
  ALPHA_VANTAGE_API_KEY?: string;
  FINNHUB_API_KEY?: string;

  // Cron Secret
  CRON_SECRET?: string;
}

function validateEnv(): EnvConfig {
  const required = ['DATABASE_URL', 'AUTH_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file.'
    );
  }

  // Warn about optional but recommended keys
  const recommended = ['ALPHA_VANTAGE_API_KEY', 'FINNHUB_API_KEY', 'CRON_SECRET'];
  const missingRecommended = recommended.filter(key => !process.env[key]);

  if (missingRecommended.length > 0 && process.env.NODE_ENV !== 'test') {
    console.warn(
      `⚠️  Warning: Missing recommended environment variables: ${missingRecommended.join(', ')}\n` +
      'Some features may be limited.'
    );
  }

  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL,
    POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING,
    AUTH_SECRET: process.env.AUTH_SECRET!,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    ALPHA_VANTAGE_API_KEY: process.env.ALPHA_VANTAGE_API_KEY,
    FINNHUB_API_KEY: process.env.FINNHUB_API_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
  };
}

// Validate on module load (build time and runtime)
export const env = validateEnv();

// Export helper to check if external APIs are configured
export const hasExternalApis = () => {
  return !!(env.ALPHA_VANTAGE_API_KEY || env.FINNHUB_API_KEY);
};

// Export cron auth helper
export const validateCronRequest = (authHeader: string | null) => {
  if (!env.CRON_SECRET) return true; // Allow if not configured
  return authHeader === `Bearer ${env.CRON_SECRET}`;
};
