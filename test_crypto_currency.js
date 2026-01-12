/**
 * Test crypto currency logic
 */

const { getAssetCategory, getCategoryDefaults } = require('./src/lib/assetCategories.ts');

console.log('=== Testing Crypto Currency Logic ===\n');

// Test BTC-USD
console.log('1. BTC-USD:');
const btcUsdCategory = getAssetCategory('CRYPTO', undefined, 'BTC-USD');
const btcUsdDefaults = getCategoryDefaults(btcUsdCategory, 'BTC-USD');
console.log(`   Category: ${btcUsdCategory}`);
console.log(`   Currency: ${btcUsdDefaults.currency} ${btcUsdDefaults.currency === 'USD' ? '✅' : '❌ Expected: USD'}`);

// Test BTC-EUR
console.log('\n2. BTC-EUR:');
const btcEurCategory = getAssetCategory('CRYPTO', undefined, 'BTC-EUR');
const btcEurDefaults = getCategoryDefaults(btcEurCategory, 'BTC-EUR');
console.log(`   Category: ${btcEurCategory}`);
console.log(`   Currency: ${btcEurDefaults.currency} ${btcEurDefaults.currency === 'EUR' ? '✅' : '❌ Expected: EUR'}`);

// Test ETH-EUR
console.log('\n3. ETH-EUR:');
const ethEurCategory = getAssetCategory('CRYPTO', undefined, 'ETH-EUR');
const ethEurDefaults = getCategoryDefaults(ethEurCategory, 'ETH-EUR');
console.log(`   Category: ${ethEurCategory}`);
console.log(`   Currency: ${ethEurDefaults.currency} ${ethEurDefaults.currency === 'EUR' ? '✅' : '❌ Expected: EUR'}`);

// Test XRP-EUR
console.log('\n4. XRP-EUR:');
const xrpEurCategory = getAssetCategory('CRYPTO', undefined, 'XRP-EUR');
const xrpEurDefaults = getCategoryDefaults(xrpEurCategory, 'XRP-EUR');
console.log(`   Category: ${xrpEurCategory}`);
console.log(`   Currency: ${xrpEurDefaults.currency} ${xrpEurDefaults.currency === 'EUR' ? '✅' : '❌ Expected: EUR'}`);

// Test ETH-USD
console.log('\n5. ETH-USD:');
const ethUsdCategory = getAssetCategory('CRYPTO', undefined, 'ETH-USD');
const ethUsdDefaults = getCategoryDefaults(ethUsdCategory, 'ETH-USD');
console.log(`   Category: ${ethUsdCategory}`);
console.log(`   Currency: ${ethUsdDefaults.currency} ${ethUsdDefaults.currency === 'USD' ? '✅' : '❌ Expected: USD'}`);

// Test BTC-GBP
console.log('\n6. BTC-GBP:');
const btcGbpCategory = getAssetCategory('CRYPTO', undefined, 'BTC-GBP');
const btcGbpDefaults = getCategoryDefaults(btcGbpCategory, 'BTC-GBP');
console.log(`   Category: ${btcGbpCategory}`);
console.log(`   Currency: ${btcGbpDefaults.currency} ${btcGbpDefaults.currency === 'GBP' ? '✅' : '❌ Expected: GBP'}`);

// Test ETH-TRY
console.log('\n7. ETH-TRY:');
const ethTryCategory = getAssetCategory('CRYPTO', undefined, 'ETH-TRY');
const ethTryDefaults = getCategoryDefaults(ethTryCategory, 'ETH-TRY');
console.log(`   Category: ${ethTryCategory}`);
console.log(`   Currency: ${ethTryDefaults.currency} ${ethTryDefaults.currency === 'TRY' ? '✅' : '❌ Expected: TRY'}`);

// Test XRP-JPY
console.log('\n8. XRP-JPY:');
const xrpJpyCategory = getAssetCategory('CRYPTO', undefined, 'XRP-JPY');
const xrpJpyDefaults = getCategoryDefaults(xrpJpyCategory, 'XRP-JPY');
console.log(`   Category: ${xrpJpyCategory}`);
console.log(`   Currency: ${xrpJpyDefaults.currency} ${xrpJpyDefaults.currency === 'JPY' ? '✅' : '❌ Expected: JPY'}`);

console.log('\n=== Summary ===');
console.log('Crypto pairs should extract quote currency from symbol:');
console.log('  - BTC-USD → USD');
console.log('  - BTC-EUR → EUR');
console.log('  - BTC-GBP → GBP');
console.log('  - ETH-EUR → EUR');
console.log('  - ETH-TRY → TRY');
console.log('  - XRP-EUR → EUR');
console.log('  - XRP-JPY → JPY');
console.log('\nThis works for ANY currency pair automatically!');
