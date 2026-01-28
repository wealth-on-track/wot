
import { searchYahoo } from './src/services/yahooApi';

async function test() {
    console.log("--- DEBUG START ---");
    console.log("Testing Yahoo Search for 'TESLA INC'...");
    try {
        const results = await searchYahoo("TESLA INC");
        console.log("Search Results:", JSON.stringify(results, null, 2));
    } catch (e) {
        console.error("Search Error:", e);
    }
    console.log("--- DEBUG END ---");
}

test();
