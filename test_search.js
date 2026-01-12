
const { searchYahoo } = require('./src/services/yahooApi');

async function test() {
    console.log("Searching for MAC...");
    const results = await searchYahoo("MAC");
    console.log(JSON.stringify(results, null, 2));

    console.log("Searching for NNF...");
    const results2 = await searchYahoo("NNF");
    console.log(JSON.stringify(results2, null, 2));
}

test();
