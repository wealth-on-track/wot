
import { getLogoUrl } from './src/lib/logos';

async function checkUrl(url: string) {
    try {
        console.log(`Checking: ${url}`);
        const response = await fetch(url, { method: 'HEAD' });
        console.log(`Status: ${response.status} ${response.statusText}`);
        if (!response.ok) {
            const response2 = await fetch(url);
            console.log(`GET Status: ${response2.status}`);
        }
    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

async function run() {
    const url = getLogoUrl('EUR', 'CASH');
    console.log(`Generated URL for EUR: ${url}`);
    if (url) await checkUrl(url);

    const url2 = getLogoUrl('USD', 'CASH');
    console.log(`Generated URL for USD: ${url2}`);
    if (url2) await checkUrl(url2);
}

run();
