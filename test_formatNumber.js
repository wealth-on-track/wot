const { formatNumber } = require('./src/lib/numberFormat.ts');

console.log('=== Testing formatNumber with API-like values ===\n');

// Test typical API responses
const testCases = [
    { value: 170.5, minDec: 2, maxDec: 6, expected: '170,50' },
    { value: 0.089545, minDec: 2, maxDec: 6, expected: '0,089545' },
    { value: 1234.56, minDec: 2, maxDec: 6, expected: '1.234,56' },
    { value: '170.5', minDec: 2, maxDec: 6, expected: '170,50' },
    { value: '0.089545', minDec: 2, maxDec: 6, expected: '0,089545' },
    { value: 1, minDec: 2, maxDec: 6, expected: '1,00' },
    { value: '1', minDec: 2, maxDec: 6, expected: '1,00' },
];

testCases.forEach(({ value, minDec, maxDec, expected }) => {
    const result = formatNumber(value, minDec, maxDec);
    const status = result === expected ? '✅' : '❌';
    console.log(`${status} formatNumber(${value}, ${minDec}, ${maxDec})`);
    console.log(`   Expected: "${expected}"`);
    console.log(`   Got:      "${result}"`);
    if (result !== expected) {
        console.log(`   MISMATCH!`);
    }
    console.log('');
});
