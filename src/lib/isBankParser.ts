/**
 * İş Bank TXT Parser
 * Handles: Portfolio snapshots (PORTFÖY) and transaction history (EKSTRE)
 * 
 * File Structure:
 * - Page 1: PORTFÖY (Current holdings)
 * - Page 2+: EKSTRE (Transaction history)
 */

import { ParsedRow, ParsedTransaction, TransactionType } from './importParser';

// Unified threshold for quantity comparisons
const QUANTITY_THRESHOLD = 0.000001;

/**
 * Turkish character mapping for encoding issues
 * The file may contain special characters that need normalization
 */
const TURKISH_CHAR_MAP: Record<string, string> = {
    'È': '', '›': 'İ', 'ﬁ': 'Ş', '˝': 'ı', 'ˆ': 'ö',
    '¸': 'ü', '˛': 'ş', '–': 'ğ', '÷': 'Ö', 'ﬂ': 'Ş',
    '«': 'Ç', '»': '"', '‹': 'Ü'
};

/**
 * Normalize Turkish characters in text
 */
function normalizeTurkishChars(text: string): string {
    let normalized = text;
    for (const [encoded, decoded] of Object.entries(TURKISH_CHAR_MAP)) {
        normalized = normalized.replace(new RegExp(encoded, 'g'), decoded);
    }
    return normalized;
}

/**
 * Detect if the content is from İş Bank
 */
export function detectIsBank(content: string): boolean {
    // Only check the first 2000 characters for speed
    const head = content.slice(0, 2000);
    const normalized = normalizeTurkishChars(head);

    return normalized.includes('TÜRKİYE İŞ BANKASI') &&
        normalized.includes('YATIRIM HESABI');
}

/**
 * Parse Number (US Format mostly used in this file: 1,234.56 or 1234.56)
 */
function parseTurkishNumber(value: string | number | undefined | null): number {
    if (value === undefined || value === null || value === '') return 0;
    const str = String(value).trim();
    if (str === '' || str === '-' || str === '--') return 0;

    // Remove quotes
    let cleaned = str.replace(/^["']|["']$/g, '');

    // File format seems to be US-style: 1,234.56
    // Remove commas (thousands separator)
    cleaned = cleaned.replace(/,/g, '');

    // Remove non-numeric except . and -
    cleaned = cleaned.replace(/[^\d.\-]/g, '');

    // Check if multiple dots exist (unlikely in US format but possible in bad OCR)
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount > 1) {
        // Fallback: keep only last dot
        const parts = cleaned.split('.');
        const dec = parts.pop();
        cleaned = parts.join('') + '.' + dec;
    }

    const result = parseFloat(cleaned);
    return isNaN(result) ? 0 : result;
}

/**
 * Parse Turkish date format (DD/MM/YY) to Date object
 */
function parseTurkishDate(dateStr: string): Date {
    if (!dateStr || dateStr.trim() === '') return new Date();

    const parts = dateStr.trim().split('/');
    if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // JS months are 0-indexed
        let year = parseInt(parts[2]);

        // Handle 2-digit year (25 -> 2025)
        if (year < 100) {
            year += 2000;
        }

        // Handle 4-digit year if present
        if (year > 2000) {
            // Already full year
        }

        return new Date(year, month, day);
    }

    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Detect transaction type from İş Bank transaction code and description
 */
function detectTransactionType(code: string, description: string): TransactionType {
    const desc = description.toUpperCase();

    // Transaction code mapping
    switch (code.toUpperCase()) {
        case 'QH': // YATIRIM HESABI AÇMA
            return 'DEPOSIT';
        case 'QN': // KIYMET GİRİŞİ
            return 'BUY';
        case 'IX': // SATIŞ TALİMATI (order placed) - SKIP in parsing usually
            return 'SELL';
        case 'MN': // TALİMAT SONUCU (execution)
            if (desc.includes('SATIŞ') || desc.includes('SATI')) {
                return 'SELL';
            }
            if (desc.includes('ALIŞ') || desc.includes('ALI')) {
                return 'BUY';
            }
            return 'SELL'; // Default for MN
        case 'VG': // STOPAJ (tax/fee)
            return 'FEE';
        case 'QP': // VİRMANI (transfer)
            return 'WITHDRAWAL';
        default:
            // Fallback to description analysis
            if (desc.includes('SATIŞ') || desc.includes('SATI')) return 'SELL';
            if (desc.includes('ALIŞ') || desc.includes('ALI')) return 'BUY';
            if (desc.includes('STOPAJ') || desc.includes('FEE')) return 'FEE';
            if (desc.includes('VİRMAN') || desc.includes('VIRMAN')) return 'WITHDRAWAL';
            if (desc.includes('GİRİŞ') || desc.includes('GIRIS')) return 'BUY';
            return 'BUY'; // Default
    }
}

/**
 * Infer asset type from İş Bank asset code
 */
function inferTypeFromCode(code: string, name: string): string {
    const upper = name.toUpperCase();

    // Code-based detection
    if (code.startsWith('822')) return 'FUND'; // İş Bank funds
    if (code.startsWith('617')) return 'BOND'; // Bonds
    if (code.startsWith('XS')) return 'BOND'; // International bonds
    if (code.startsWith('US')) return 'BOND'; // US bonds

    // Name-based detection
    if (upper.includes('FONU') || upper.includes('FUND')) return 'FUND';
    if (upper.includes('ALTIN') || upper.includes('GOLD')) return 'COMMODITY';
    if (upper.includes('TAHVIL') || upper.includes('BOND')) return 'BOND';

    return 'STOCK';
}

/**
 * Parse PORTFÖY (Portfolio) section
 * Fixed-width format with columns
 */
function parsePortfolioSection(lines: string[]): ParsedRow[] {
    const rows: ParsedRow[] = [];

    // Find the start of asset list (after header)
    let startIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        // Normalization produces: KIYMET TANIMI ...
        if (lines[i].includes('KIYMET TANIMI')) {
            // Found header. The data starts after the separator line
            // Header is usually 2 lines, then separator line.
            // We need to look ahead for the separator line '----'
            for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                if (lines[j].includes('----')) {
                    startIdx = j + 1;
                    break;
                }
            }
            if (startIdx === -1) startIdx = i + 3; // Fallback
            break;
        }
    }

    if (startIdx === -1) return rows;

    // Parse each asset line until we hit TOPLAM or end
    for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();

        // Stop at totals or empty lines
        if (!line || line.startsWith('TOPLAM') || line.startsWith('---') || line.startsWith('===')) {
            continue;
        }
        if (line.includes('TOPLAM :')) break;

        // Parse fixed-width columns
        // Pattern: [Name] [Code] [Nominal] [Blocked] [MaturityValue] [UnitCost] [CurrentValue]
        // Note: Sample has strange spacing. Let's try flexible whitespace split.
        const parts = line.split(/\s{2,}/); // Split on 2+ spaces

        if (parts.length < 2) continue;

        const name = parts[0].trim();
        let code = parts[1]?.trim();

        // Valid code check
        if (!code || code === '--') {
            // Check if name absorbed code? Unlikely given columns.
            continue;
        }

        // Sometimes Name might be empty? No.

        // Find nominal value (usually 3rd or 4th column)
        let nominal = 0;
        let unitCost = 0;

        // Loop through remaining parts to find 2 main numbers: Nominal and Cost
        for (let j = 2; j < parts.length; j++) {
            const val = parseTurkishNumber(parts[j]);
            if (val > 0) {
                if (nominal === 0) {
                    nominal = val;
                } else if (unitCost === 0 && val < nominal) {
                    unitCost = val;
                }
            }
        }

        if (nominal === 0) continue; // Skip if no quantity

        const type = inferTypeFromCode(code, name);

        rows.push({
            symbol: code,
            name: name,
            quantity: nominal,
            buyPrice: unitCost,
            currency: 'TRY',
            type,
            platform: 'İş Bank',
            rawRow: { code, name, nominal, unitCost, line },
            confidence: 90,
            warnings: []
        });
    }

    return rows;
}

/**
 * Parse EKSTRE (Transaction History) section
 */
function parseTransactionSection(lines: string[]): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];

    // Find the start of transaction list
    let startIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        const normalized = lines[i].toUpperCase();

        // Check for header keywords: ISLEM, FIS NO
        if ((normalized.includes('ISLEM') || normalized.includes('IŞLEM') || normalized.includes('İŞLEM')) &&
            (normalized.includes('FIS NO') || normalized.includes('FIŞ NO') || normalized.includes('FİŞ NO'))) {

            // Look for separation line
            for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                if (lines[j].includes('====') || lines[j].includes('----')) {
                    startIdx = j + 1;
                    break;
                }
            }
            if (startIdx === -1) startIdx = i + 2;
            break;
        }
    }

    if (startIdx === -1) return transactions;

    // Parse each transaction line
    for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();

        // Stop at page break or end
        if (!line || line.startsWith('===') || line.startsWith('SAYFA')) {
            continue;
        }

        // Parse transaction line
        const parts = line.split(/\s+/);

        if (parts.length < 5) continue;

        if (!parts[0].includes('/')) continue;

        const dateStr = parts[0];
        const branch = parts[1];
        const receiptNo = parts[2];
        const txCode = parts[3];
        let assetCode = parts[4];

        // Skip Order Placing transactions (IX) - Wait for MN (Execution)
        if (txCode === 'IX') continue;

        if (assetCode === '-' || assetCode === '--') assetCode = '';

        let price = 0;
        let quantity = 0;
        let amount = 0;
        let description = '';

        // Scan for numbers starting from index 5
        const numericValues: number[] = [];
        let descParts: string[] = [];

        for (let j = 5; j < parts.length; j++) {
            const part = parts[j];
            // Check if it's a number
            if (/^[+\-]?[\d.,]+$/.test(part) && /\d/.test(part)) {
                const val = parseTurkishNumber(part);
                numericValues.push(val);
            } else if (part !== '-') {
                descParts.push(part);
            }
        }

        description = descParts.join(' ').trim();
        const date = parseTurkishDate(dateStr);
        const type = detectTransactionType(txCode, description);

        // Assign numeric values based on type heuristics
        if (type === 'FEE') {
            amount = numericValues.find(v => v < 0) || numericValues[0] || 0;
        } else if (type === 'BUY' || type === 'SELL') {
            if (numericValues.length >= 2) {
                price = Math.abs(numericValues[0]);
                quantity = Math.abs(numericValues[1]);
            } else if (numericValues.length === 1) {
                quantity = Math.abs(numericValues[0]);
            }
        } else {
            // Deposit/Withdrawal
            if (numericValues.length > 0) {
                quantity = Math.abs(numericValues[0]);
            }
        }

        transactions.push({
            symbol: assetCode || 'CASH',
            name: description || assetCode,
            type,
            quantity: Math.abs(quantity),
            price: Math.abs(price),
            currency: 'TRY',
            date,
            originalDateStr: dateStr,
            platform: 'İş Bank',
            externalId: JSON.stringify({
                receiptNo,
                branch,
                txCode,
                assetCode,
                description,
                rawLine: line
            }),
            fee: type === 'FEE' ? Math.abs(amount) : 0
        });
    }

    return transactions;
}

/**
 * Main entry point: Parse İş Bank TXT file
 */
export function parseIsBankTXT(content: string): {
    rows: ParsedRow[];
    transactions: ParsedTransaction[];
    processedCount: number;
    closedPositionCount: number;
} {
    // Normalize Turkish characters
    const normalized = normalizeTurkishChars(content);

    // Split into lines
    const lines = normalized.split('\n');

    // Parse both sections
    const portfolioRows = parsePortfolioSection(lines);
    const transactions = parseTransactionSection(lines);

    // Aggregate transactions by asset code
    const transactionsByAsset: Record<string, {
        buys: { quantity: number; price: number }[];
        sells: { quantity: number; price: number }[];
        name: string;
    }> = {};

    for (const tx of transactions) {
        if (tx.type !== 'BUY' && tx.type !== 'SELL') continue;
        if (!tx.symbol || tx.symbol === 'CASH') continue;

        if (!transactionsByAsset[tx.symbol]) {
            transactionsByAsset[tx.symbol] = {
                buys: [],
                sells: [],
                name: tx.name || tx.symbol
            };
        }

        if (tx.type === 'BUY') {
            transactionsByAsset[tx.symbol].buys.push({
                quantity: tx.quantity,
                price: tx.price
            });
        } else {
            transactionsByAsset[tx.symbol].sells.push({
                quantity: tx.quantity,
                price: tx.price
            });
        }
    }

    // Calculate closed positions from transaction history
    let closedPositionCount = 0;
    const closedPositions: ParsedRow[] = [];

    for (const [symbol, data] of Object.entries(transactionsByAsset)) {
        // Only if NOT currently in portfolio (to avoid double counting)
        const inPortfolio = portfolioRows.some(r => r.symbol === symbol);

        const totalBought = data.buys.reduce((sum, t) => sum + t.quantity, 0);
        const totalSold = data.sells.reduce((sum, t) => sum + t.quantity, 0);
        const netQuantity = totalBought - totalSold;

        if (!inPortfolio && totalBought > 0 && netQuantity <= QUANTITY_THRESHOLD) {
            closedPositionCount++;

            const totalBuyCost = data.buys.reduce((sum, t) => sum + (t.quantity * t.price), 0);
            const avgBuyPrice = totalBought > 0 ? totalBuyCost / totalBought : 0;

            closedPositions.push({
                symbol,
                name: data.name,
                quantity: 0, // Closed position
                buyPrice: avgBuyPrice,
                currency: 'TRY',
                type: 'FUND',
                platform: 'İş Bank',
                rawRow: { symbol, totalBought, totalSold },
                confidence: 95,
                warnings: [`Closed position: ${totalBought.toFixed(4)} bought, ${totalSold.toFixed(4)} sold`]
            });
        }
    }

    // Combine portfolio rows with closed positions
    const allRows = [...portfolioRows, ...closedPositions];

    // Sort transactions by date
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
        rows: allRows,
        transactions,
        processedCount: transactions.length,
        closedPositionCount
    };
}
