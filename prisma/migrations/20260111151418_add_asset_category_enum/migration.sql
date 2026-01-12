-- CreateEnum
CREATE TYPE "AssetCategory" AS ENUM ('BIST', 'TEFAS', 'US_MARKETS', 'EU_MARKETS', 'CRYPTO', 'COMMODITIES', 'FX', 'CASH');

-- AlterTable: Add category column with default value
ALTER TABLE "Asset" ADD COLUMN "category" "AssetCategory" NOT NULL DEFAULT 'US_MARKETS';

-- Note: Data migration will be done separately via migrate_to_8_categories.ts script
