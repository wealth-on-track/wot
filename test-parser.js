// Test parseEuropeanNumber function
const testCases = [
    { input: '"79005,6400"', expected: 79005.64, description: 'BTC price from DeGiro' },
    { input: '"1,6500"', expected: 1.65, description: 'XRP price from DeGiro' },
    { input: '"2599,7600"', expected: 2599.76, description: 'ETH price from DeGiro' },
    { input: '"184,4300"', expected: 184.43, description: 'Netflix buy price' },
    { input: '"180,0000"', expected: 180.00, description: 'Netflix sell price' },
    { input: '"1.234,56"', expected: 1234.56, description: 'European format with thousands' },
    { input: '2000', expected: 2000, description: 'Simple number' },
    { input: '"15850"', expected: 15850, description: 'Number in quotes' },
];

function parseEuropeanNumber(value) {
    if (value === undefined || value === null || value === '') return 0;
    const str = String(value).trim();
    if (str === '') return 0;

    // Remove quotes
    let cleaned = str.replace(/^[\"']|[\"']$/g, '');

    // DeGiro: comma is ALWAYS decimal, dot is ALWAYS thousands
    const hasComma = cleaned.includes(',');

    if (hasComma) {
        // Remove dots (thousands), replace comma with dot (decimal)
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
        // No comma: remove commas (US thousands)
        cleaned = cleaned.replace(/,/g, '');
    }

    // Remove non-numeric except . and -
    cleaned = cleaned.replace(/[^\d.\-]/g, '');

    const result = parseFloat(cleaned);
    return isNaN(result) ? 0 : result;
}

console.log('Testing parseEuropeanNumber function:\n');
let allPassed = true;

testCases.forEach(({ input, expected, description }) => {
    const result = parseEuropeanNumber(input);
    const passed = Math.abs(result - expected) < 0.001;
    allPassed = allPassed && passed;

    console.log(`${passed ? '✅' : '❌'} ${description}`);
    console.log(`   Input: ${input}`);
    console.log(`   Expected: ${expected}`);
    console.log(`   Got: ${result}`);
    console.log('');
});

console.log(allPassed ? '\n🎉 ALL TESTS PASSED!' : '\n❌ SOME TESTS FAILED!');
process.exit(allPassed ? 0 : 1);
