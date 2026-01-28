
const { searchYahoo } = require('./src/lib/yahoo-finance');

async function test() {
    console.log("Searching for US88160R1014...");
    const results = await searchYahoo("US88160R1014");
    console.log("Results:", JSON.stringify(results, null, 2));
}

test();
