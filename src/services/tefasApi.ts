
export interface TefasFund {
    code: string;
    title: string;
    price: number;
    lastUpdated?: string;
}

export async function getTefasFundInfo(code: string): Promise<TefasFund | null> {
    try {
        const cleanCode = code.toUpperCase().trim();
        if (cleanCode.length !== 3) return null;

        const response = await fetch(`https://www.tefas.gov.tr/FonAnaliz.aspx?FonKod=${cleanCode}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            next: { revalidate: 300 } // Cache for 5 mins
        });

        if (!response.ok) return null;

        const html = await response.text();

        // Basic parsing using Regex (Cheerio is better but might not be available)
        // Look for Title
        // <span id="MainContent_LabelFonAdi">TACİRLER PORTFÖY DEĞIŞKEN FON</span>
        const titleMatch = html.match(/<span id="MainContent_LabelFonAdi">([^<]+)<\/span>/);
        const title = titleMatch ? titleMatch[1].trim() : null;

        if (!title) return null;

        // Look for Price
        // <ul class="top-list"> ... <span>Son Fiyat (TL)</span> ... <span id="MainContent_LabelSonFiyat">37,076155</span>
        const priceMatch = html.match(/<span id="MainContent_LabelSonFiyat">([\d.,]+)<\/span>/);
        let price = 0;

        if (priceMatch && priceMatch[1]) {
            // Replace Turkish decimal comma with dot
            const priceStr = priceMatch[1].replace(/\./g, '').replace(',', '.');
            price = parseFloat(priceStr);
        }

        if (!price) return null;

        return {
            code: cleanCode,
            title,
            price,
            lastUpdated: new Date().toLocaleTimeString()
        };

    } catch (error) {
        console.error("Error feching TEFAS data:", error);
        return null;
    }
}
