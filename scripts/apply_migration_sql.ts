import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyMigration() {
  console.log('🔧 Applying SQL migration...\n');

  try {
    // Check if enum already exists
    const enumExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'AssetCategory'
      ) as exists;
    `;

    console.log('Checking if AssetCategory enum exists:', enumExists);

    // Create enum if it doesn't exist
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "AssetCategory" AS ENUM ('BIST', 'TEFAS', 'US_MARKETS', 'EU_MARKETS', 'CRYPTO', 'COMMODITIES', 'FX', 'CASH');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    console.log('✅ Enum created or already exists');

    // Check if column already exists
    const columnExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Asset' AND column_name = 'category'
      ) as exists;
    `;

    console.log('Checking if category column exists:', columnExists);

    // Add column if it doesn't exist
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        ALTER TABLE "Asset" ADD COLUMN "category" "AssetCategory" NOT NULL DEFAULT 'US_MARKETS';
      EXCEPTION
        WHEN duplicate_column THEN null;
      END $$;
    `);

    console.log('✅ Column added or already exists');

    console.log('\n✨ Migration applied successfully!\n');

  } catch (error) {
    console.error('💥 Error applying migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
