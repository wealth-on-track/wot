// Test price update service with new TEFAS filter
import { updateAllPrices } from './src/services/priceUpdateService.ts';

console.log('Testing price update service...\n');

updateAllPrices()
  .then(result => {
    console.log('\nResult:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
