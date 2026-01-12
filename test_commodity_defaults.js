/**
 * Test script to verify commodity metadata defaults
 * Tests that GAUTRY, XAGTRY, and other commodities get correct metadata
 */

const { getAssetCategory, getCategoryDefaults } = require('./src/lib/assetCategories.ts');

console.log('=== Testing Commodity Metadata Defaults ===\n');

// Test GAUTRY (Gram Gold)
console.log('1. GAUTRY (Gram Gold):');
const gautryCategory = getAssetCategory('GOLD', 'Commodity', 'GAUTRY');
const gautryDefaults = getCategoryDefaults(gautryCategory, 'GAUTRY');
console.log(`   Category: ${gautryCategory}`);
console.log(`   Country: ${gautryDefaults.country} ${gautryDefaults.country === 'Global' ? '✅' : '❌ Expected: Global'}`);
console.log(`   Currency: ${gautryDefaults.currency} ${gautryDefaults.currency === 'TRY' ? '✅' : '❌ Expected: TRY'}`);
console.log(`   Sector: ${gautryDefaults.sector} ${gautryDefaults.sector === 'Commodity' ? '✅' : '❌ Expected: Commodity'}`);

// Test XAGTRY (Gram Silver)
console.log('\n2. XAGTRY (Gram Silver):');
const xagtryCategory = getAssetCategory('COMMODITY', 'Commodity', 'XAGTRY');
const xagtryDefaults = getCategoryDefaults(xagtryCategory, 'XAGTRY');
console.log(`   Category: ${xagtryCategory}`);
console.log(`   Country: ${xagtryDefaults.country} ${xagtryDefaults.country === 'Global' ? '✅' : '❌ Expected: Global'}`);
console.log(`   Currency: ${xagtryDefaults.currency} ${xagtryDefaults.currency === 'TRY' ? '✅' : '❌ Expected: TRY'}`);
console.log(`   Sector: ${xagtryDefaults.sector} ${xagtryDefaults.sector === 'Commodity' ? '✅' : '❌ Expected: Commodity'}`);

// Test XAU (Gold Ounce)
console.log('\n3. XAU (Gold Ounce):');
const xauCategory = getAssetCategory('GOLD', 'Commodity', 'XAU');
const xauDefaults = getCategoryDefaults(xauCategory, 'XAU');
console.log(`   Category: ${xauCategory}`);
console.log(`   Country: ${xauDefaults.country} ${xauDefaults.country === 'Global' ? '✅' : '❌ Expected: Global'}`);
console.log(`   Currency: ${xauDefaults.currency} ${xauDefaults.currency === 'XAU' ? '✅' : '❌ Expected: XAU'}`);
console.log(`   Sector: ${xauDefaults.sector} ${xauDefaults.sector === 'Commodity' ? '✅' : '❌ Expected: Commodity'}`);

// Test XAG (Silver Ounce)
console.log('\n4. XAG (Silver Ounce):');
const xagCategory = getAssetCategory('COMMODITY', 'Commodity', 'XAG');
const xagDefaults = getCategoryDefaults(xagCategory, 'XAG');
console.log(`   Category: ${xagCategory}`);
console.log(`   Country: ${xagDefaults.country} ${xagDefaults.country === 'Global' ? '✅' : '❌ Expected: Global'}`);
console.log(`   Currency: ${xagDefaults.currency} ${xagDefaults.currency === 'XAG' ? '✅' : '❌ Expected: XAG'}`);
console.log(`   Sector: ${xagDefaults.sector} ${xagDefaults.sector === 'Commodity' ? '✅' : '❌ Expected: Commodity'}`);

// Test generic commodity (should use USD)
console.log('\n5. CL=F (Oil Futures):');
const oilCategory = getAssetCategory('COMMODITY', 'NYMEX', 'CL=F');
const oilDefaults = getCategoryDefaults(oilCategory, 'CL=F');
console.log(`   Category: ${oilCategory}`);
console.log(`   Country: ${oilDefaults.country} ${oilDefaults.country === 'Global' ? '✅' : '❌ Expected: Global'}`);
console.log(`   Currency: ${oilDefaults.currency} ${oilDefaults.currency === 'USD' ? '✅' : '❌ Expected: USD'}`);
console.log(`   Sector: ${oilDefaults.sector} ${oilDefaults.sector === 'Commodity' ? '✅' : '❌ Expected: Commodity'}`);

console.log('\n=== Summary ===');
console.log('All commodities should have:');
console.log('  - Country: Global (always)');
console.log('  - Sector: Commodity (always)');
console.log('  - Currency: TRY for GAUTRY/XAGTRY, XAU/XAG for ounce-based, USD for others');
console.log('  - Exchange: Commodity (default)');
