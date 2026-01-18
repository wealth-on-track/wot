// Test RABO quantity calculation
const testQuantity = 15850;
const isin = 'XS1002121454';

let quantity = Math.abs(testQuantity);

// DeGiro special case: Bonds/Certificates (ISIN starting with XS)
if (isin && isin.startsWith('XS')) {
    quantity = quantity / 100;
}

console.log('Original quantity:', testQuantity);
console.log('ISIN:', isin);
console.log('Adjusted quantity:', quantity);
console.log('Formatted (de-DE):', quantity.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 8 }));
console.log('Expected: 158,5');
console.log('Match:', quantity === 158.5 ? '✅ CORRECT' : '❌ WRONG');
