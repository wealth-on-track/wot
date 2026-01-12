
const { getTefasFundInfo } = require('./src/services/tefasApi');

async function testTefas() {
    console.log("Testing TEFAS for TI2...");
    try {
        const result = await getTefasFundInfo('TI2');
        console.log("Result:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

testTefas();
