// Quick test to see what searchSymbolsAction returns for GAUTRY
const { searchSymbolsAction } = require('./src/app/actions/search.ts');

(async () => {
    const results = await searchSymbolsAction('GAU');
    console.log('Search results for GAU:');
    console.log(JSON.stringify(results.find(r => r.symbol === 'GAUTRY'), null, 2));
})();
