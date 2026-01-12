/**
 * Update Existing COMMODITIES Assets Metadata
 *
 * Sets all COMMODITIES assets to:
 * - country: 'Global'
 * - sector: 'Commodity'
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateCommoditiesMetadata() {
  console.log('🔄 Updating COMMODITIES metadata...\n');

  try {
    // Find all COMMODITIES assets
    const commodities = await prisma.asset.findMany({
      where: { category: 'COMMODITIES' },
      select: {
        id: true,
        symbol: true,
        country: true,
        sector: true
      }
    });

    console.log(`Found ${commodities.length} COMMODITIES assets:\n`);

    commodities.forEach(asset => {
      console.log(`  ${asset.symbol.padEnd(12)} | Country: ${(asset.country || 'NULL').padEnd(12)} | Sector: ${asset.sector || 'NULL'}`);
    });

    console.log('\n📝 Updating to: country="Global", sector="Commodity"\n');

    // Update all COMMODITIES assets
    const result = await prisma.asset.updateMany({
      where: { category: 'COMMODITIES' },
      data: {
        country: 'Global',
        sector: 'Commodity'
      }
    });

    console.log(`✅ Updated ${result.count} COMMODITIES assets\n`);

    // Verify the update
    const updated = await prisma.asset.findMany({
      where: { category: 'COMMODITIES' },
      select: {
        symbol: true,
        country: true,
        sector: true
      }
    });

    console.log('📊 Verification:\n');
    updated.forEach(asset => {
      console.log(`  ${asset.symbol.padEnd(12)} | Country: ${asset.country.padEnd(12)} | Sector: ${asset.sector}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateCommoditiesMetadata();
