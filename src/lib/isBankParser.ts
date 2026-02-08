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
 * İş Bank files are often encoded in Windows-1254/ISO-8859-9 but read as UTF-8
 * This causes mojibake (garbled characters) that we need to fix
 *
 * Common patterns:
 * - Mac Roman / Windows-1252 misread characters
 * - Windows-1254 (Turkish) read as UTF-8
 * - Latin-9 read as UTF-8
 */
const TURKISH_CHAR_MAP: Record<string, string> = {
    // Uppercase Turkish letters
    '›': 'İ',      // İ (I with dot) - very common
    '‹': 'Ü',      // Ü (U umlaut)
    'Ü': 'Ü',      // Sometimes preserved
    '÷': 'Ö',      // Ö (O umlaut)
    'ﬁ': 'Ş',      // Ş (S cedilla) - ligature fi misread
    'ﬂ': 'Ş',      // Ş (S cedilla) - ligature fl misread
    'Ţ': 'Ş',      // Ş (S cedilla) - T cedilla misread
    '˜': 'Ğ',      // Ğ (G breve)
    'Û': 'Û',      // Sometimes preserved
    'Ç': 'Ç',      // Usually preserved
    'Ă': 'Ğ',      // Ğ (G breve) - Romanian A breve

    // Lowercase Turkish letters
    '˝': 'ı',      // ı (dotless i)
    'ˆ': 'ö',      // ö (o umlaut)
    '¸': 'ü',      // ü (u umlaut)
    '˛': 'ş',      // ş (s cedilla)
    '–': 'ğ',      // ğ (g breve) - en-dash misread
    '—': 'ğ',      // ğ (g breve) - em-dash misread
    '‚': 'ü',      // ü (u umlaut)
    '‡': 'ç',      // ç (c cedilla)
    'ţ': 'ş',      // ş (s cedilla) - t cedilla
    'ă': 'ğ',      // ğ (g breve) - Romanian a breve

    // Ç variations
    '«': 'Ç',      // Ç (C cedilla) - left guillemet
    'Ã': 'Ç',      // Ç (C cedilla) - A tilde
    'Â': 'Ç',      // Ç (C cedilla) - A circumflex

    // İ variations (uppercase I with dot)
    '…': 'İ',      // ellipsis misread
    'Œ': 'İ',      // OE ligature misread
    'œ': 'İ',      // oe ligature misread
    'Ý': 'İ',      // Y acute (Windows-1254 İ is 0xDD)
    'İ': 'İ',      // Sometimes preserved

    // Garbage/separator characters to remove
    'È': '',       // E grave - often garbage at start

    // Quote characters
    '»': '"',      // Right guillemet to quote

    // Additional Windows-1254 specific mappings
    'ý': 'ı',      // y acute (Windows-1254 ı is 0xFD)
    'þ': 'ş',      // thorn (Windows-1254 ş is 0xFE)
    'Þ': 'Ş',      // Thorn (Windows-1254 Ş is 0xDE)
    'ð': 'ğ',      // eth (similar to ğ)
    'Ð': 'Ğ',      // Eth (similar to Ğ)

    // Extended Latin characters that might appear
    'ª': 'a',      // feminine ordinal
    'º': 'o',      // masculine ordinal
    '¹': '1',      // superscript 1
    '²': '2',      // superscript 2
    '³': '3',      // superscript 3
};

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize Turkish characters in text
 */
function normalizeTurkishChars(text: string): string {
    let normalized = text;
    for (const [encoded, decoded] of Object.entries(TURKISH_CHAR_MAP)) {
        const escapedKey = escapeRegExp(encoded);
        normalized = normalized.replace(new RegExp(escapedKey, 'g'), decoded);
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

    // Relaxed detection: Look for "YATIRIM HESABI"
    // The "TÜRKİYE İŞ BANKASI" part might be garbled differently
    return normalized.includes('YATIRIM HESABI') ||
        (normalized.includes('PORTFOY') && (normalized.includes('BANKASI') || normalized.includes('ISLEM') || normalized.includes('IŞLEM')));
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
    if (code.startsWith('822')) return 'TEFAS'; // İş Bank funds (TEFAS)
    if (code.startsWith('818')) return 'TEFAS'; // Other funds
    if (code.startsWith('617')) return 'BOND'; // Bonds
    if (code.startsWith('XS')) return 'BOND'; // International bonds
    if (code.startsWith('US')) return 'BOND'; // US bonds

    // Name-based detection
    if (upper.includes('FONU') || upper.includes('FUND')) return 'TEFAS';
    if (upper.includes('ALTIN') || upper.includes('GOLD')) return 'COMMODITY';
    if (upper.includes('TAHVIL') || upper.includes('BOND')) return 'BOND';

    return 'STOCK';
}

/**
 * Clean up common encoding/OCR errors in İş Bank asset names
 */
function cleanIsBankName(name: string): string {
    let cleaned = name;

    // Fix "Altn" -> "Altın"
    // Use simple global replace as "Altn" is distinct enough typo
    cleaned = cleaned.replace(/Altn/gi, 'Altın');

    // Fix "Is" -> "İş" at start
    cleaned = cleaned.replace(/^Is\s+/gi, 'İş ');
    cleaned = cleaned.replace(/^\s+Is\s+/gi, ' İş ');

    // Fix empty start " Altn" -> "İş Altın" (Specific heuristic for user case)
    // After replace, it acts on "Altın Fonu"
    if (cleaned.trim().startsWith('Altın Fonu')) {
        cleaned = 'İş ' + cleaned.trim();
    }

    // Common typo: "Yatrm" -> "Yatırım"
    cleaned = cleaned.replace(/Yatrm/gi, 'Yatırım');

    return cleaned.trim();
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

        let name = parts[0].trim();
        let code = parts[1]?.trim();

        // Valid code check
        if (!code || code === '--') {
            // Check if name absorbed code? Unlikely given columns.
            continue;
        }

        // Clean up name
        name = cleanIsBankName(name);

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

        description = cleanIsBankName(descParts.join(' ').trim());
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

        if (!inPortfolio && totalBought > 0) {
            const isClosed = netQuantity <= QUANTITY_THRESHOLD;
            if (isClosed) {
                closedPositionCount++;
            }

            const totalBuyCost = data.buys.reduce((sum, t) => sum + (t.quantity * t.price), 0);
            const avgBuyPrice = totalBought > 0 ? totalBuyCost / totalBought : 0;

            closedPositions.push({
                symbol,
                name: data.name,
                quantity: isClosed ? 0 : netQuantity, // 0 if closed, actual quantity if open
                buyPrice: avgBuyPrice,
                currency: 'TRY',
                type: 'FUND',
                platform: 'İş Bank',
                rawRow: { symbol, totalBought, totalSold },
                confidence: 95,
                warnings: isClosed
                    ? [`Closed position: ${totalBought.toFixed(4)} bought, ${totalSold.toFixed(4)} sold`]
                    : [`Inferred open position from transactions: ${netQuantity.toFixed(4)}`]
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

/**
 * Detect if the content is an İş Bank Precious Metals Account Statement (HESAP ÖZETI)
 * This is different from the investment account format (YATIRIM HESABI)
 * Works with both TXT (line-based) and PDF (continuous text) formats
 */
export function detectIsBankPreciousMetals(content: string): 'XAU' | 'XPT' | false {
    const head = content.slice(0, 5000);
    const normalized = normalizeTurkishChars(head).toUpperCase();

    // Look for HESAP ÖZETI - may or may not have space between words
    const hasHesapOzeti = normalized.includes('HESAP ÖZETI') ||
                          normalized.includes('HESAP OZETI') ||
                          normalized.includes('HESAPÖZETI') ||
                          normalized.includes('HESAPOZETI') ||
                          (normalized.includes('HESAP') && normalized.includes('ÖZETI'));

    // İş Bank indicators - relaxed matching
    const hasIsBankIndicator = normalized.includes('BANKASI') ||
                               normalized.includes('IBAN') ||
                               normalized.includes('TR') && /TR\s*\d{2}/.test(normalized) || // IBAN pattern
                               normalized.includes('MUSTERI') ||
                               normalized.includes('MÜŞTERİ');

    // Date format DD/MM/YYYY-HH:MM:SS is unique to this format
    const hasDateFormat = /\d{2}\/\d{2}\/\d{4}-\d{2}:\d{2}:\d{2}/.test(normalized);

    // For PDF, we might not find HESAP ÖZETI together but we can detect the unique format
    if (!hasHesapOzeti && !hasDateFormat) return false;
    if (!hasIsBankIndicator && !hasDateFormat) return false;

    // Detect metal type from currency/balance info
    // XAU = Gold, XPT = Platinum
    // Check for various indicators (spacing might vary in PDF)
    const isGold = normalized.includes('XAU') ||
                   normalized.includes('ALTIN ALIS') ||
                   normalized.includes('ALTINALIS') ||
                   normalized.includes('ALTIN ALIMI') ||
                   normalized.includes('ALTINALIMI') ||
                   (normalized.includes('ALTIN') && (normalized.includes('ALIS') || normalized.includes('ALIM')));

    const isPlatinum = normalized.includes('XPT') ||
                       normalized.includes('PLATIN ALIS') ||
                       normalized.includes('PLATINALIS') ||
                       normalized.includes('PLATIN ALIMI') ||
                       normalized.includes('PLATINALIMI') ||
                       (normalized.includes('PLATIN') && (normalized.includes('ALIS') || normalized.includes('ALIM')));

    if (isGold) return 'XAU';
    if (isPlatinum) return 'XPT';

    return false;
}

/**
 * Parse Turkish number format (uses comma as decimal separator)
 * Also handles mixed formats from İş Bank PDFs:
 * - 1,51 -> 1.51 (comma as decimal)
 * - 234,54 -> 234.54 (comma as decimal)
 * - 2874,0709000 -> 2874.0709 (comma as decimal, many digits after)
 * - 3764.3119000 -> 3764.3119 (dot as decimal when 4+ digits after)
 * - 1.234,56 -> 1234.56 (dot as thousands, comma as decimal)
 */
function parseTurkishDecimal(value: string): number {
    if (!value || value.trim() === '' || value === '-' || value === '--') return 0;

    let cleaned = value.trim();

    // Handle negative sign
    const isNegative = cleaned.startsWith('-');
    if (isNegative) cleaned = cleaned.substring(1);

    const hasComma = cleaned.includes(',');
    const hasDot = cleaned.includes('.');

    if (hasComma && hasDot) {
        // Both present: Turkish format - dot is thousands, comma is decimal
        // e.g., 1.234,56 → 1234.56
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
        // Only comma: it's the decimal separator
        // e.g., 2874,0709 → 2874.0709
        cleaned = cleaned.replace(',', '.');
    } else if (hasDot) {
        // Only dot: check if it's decimal or thousands separator
        const dotIndex = cleaned.indexOf('.');
        const afterDot = cleaned.substring(dotIndex + 1);

        if (afterDot.length >= 4) {
            // 4+ digits after dot = definitely decimal (e.g., 3764.3119000)
            // Keep as is, already correct format
        } else if (afterDot.length === 3 && /^\d+$/.test(afterDot)) {
            // Exactly 3 digits after dot could be thousands separator
            // But in our context (unit prices), treat as decimal
            // Keep as is
        }
        // else: keep as is (it's already a decimal like 3.14)
    }
    // else: no comma or dot, just a plain integer

    const result = parseFloat(cleaned);
    if (isNaN(result)) return 0;

    return isNegative ? -result : result;
}

/**
 * Parse İş Bank Precious Metals Account Statement
 * Format: Date/Time | Channel | Amount | Balance | Code | Type | Description
 *
 * Works with both TXT (line-based) and PDF (continuous text) formats
 *
 * Supports:
 * - XAU (Gold) → GAUTRY symbol
 * - XPT (Platinum) → XPTTRY symbol
 */
export function parseIsBankPreciousMetals(content: string, metalType: 'XAU' | 'XPT'): {
    rows: ParsedRow[];
    transactions: ParsedTransaction[];
    processedCount: number;
    closedPositionCount: number;
} {
    const normalized = normalizeTurkishChars(content);

    const transactions: ParsedTransaction[] = [];
    let processedCount = 0;

    // Map metal type to our symbols
    const symbolMap: Record<string, string> = {
        'XAU': 'GAUTRY',
        'XPT': 'XPTTRY'
    };
    const nameMap: Record<string, string> = {
        'XAU': 'Gold (GR)',
        'XPT': 'Platinum (GR)'
    };

    const symbol = symbolMap[metalType];
    const name = nameMap[metalType];

    // Track totals for aggregation
    let totalBought = 0;
    let totalSold = 0;
    let totalBuyCost = 0;
    let currentBalance = 0;

    // Use regex to find all transaction entries by date pattern
    // Date format: DD/MM/YYYY-HH:MM:SS
    // This works for both line-based (TXT) and continuous (PDF) text
    const globalDateRegex = /(\d{2})\/(\d{2})\/(\d{4})-(\d{2}):(\d{2}):(\d{2})/g;

    // Find all dates and their positions
    const dateMatches: Array<{ match: RegExpMatchArray; index: number }> = [];
    let match;
    while ((match = globalDateRegex.exec(normalized)) !== null) {
        dateMatches.push({ match, index: match.index });
    }

    console.log('[isBankParser] Found', dateMatches.length, 'date matches for', metalType);

    // ========================================
    // FIRST PASS: Collect DÖVIZ KURU (exchange rates) from 0-amount transactions
    // These are often on separate lines from the actual buy transactions
    // ========================================
    const exchangeRates: Map<string, number> = new Map(); // timestamp -> unit price

    for (let i = 0; i < dateMatches.length; i++) {
        const { match: dateMatch, index: startIndex } = dateMatches[i];
        const endIndex = i + 1 < dateMatches.length ? dateMatches[i + 1].index : normalized.length;
        const transactionText = normalized.substring(startIndex + dateMatch[0].length, endIndex).trim();

        // Build timestamp key (without seconds for flexibility)
        const timestampKey = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}-${dateMatch[4]}:${dateMatch[5]}`;

        // Look for DÖVIZ KURU pattern
        // Examples: "DÖVIZ KURU* 3764.3119000" or "DÖVIZ KURU 2874,0709"
        const dovizKuruMatch = transactionText.match(/D[ÖO]V[İI]Z\s*KURU\*?\s*([\d.,]+)/i);
        if (dovizKuruMatch) {
            const rate = parseTurkishDecimal(dovizKuruMatch[1]);
            if (rate > 100 && rate < 100000) { // Reasonable TRY/gram range
                exchangeRates.set(timestampKey, rate);
                console.log(`[isBankParser] FIRST PASS: Found DÖVIZ KURU at ${timestampKey}: ${rate.toFixed(4)} TL/gram`);
            }
        }

        // Also check for standalone large numbers that could be unit prices (backup)
        // Pattern: numericParts where one value is in 1000-50000 range and amount is 0
        const parts = transactionText.split(/\s+/).filter(p => p.trim() && p.length < 50);
        const numericParts: number[] = [];
        for (const part of parts) {
            if (/^-?[\d]+[,.][\d]+$/.test(part) || /^-?[\d]+$/.test(part) || /^-?[\d.]+,[\d]+$/.test(part)) {
                const num = parseTurkishDecimal(part);
                numericParts.push(num);
            }
        }

        // If first number is 0 (zero-amount transaction) and there's a large number, it might be exchange rate
        if (numericParts.length >= 1 && numericParts[0] === 0) {
            for (const num of numericParts.slice(1)) {
                if (num >= 1000 && num <= 50000 && !exchangeRates.has(timestampKey)) {
                    exchangeRates.set(timestampKey, num);
                    console.log(`[isBankParser] FIRST PASS: Inferred exchange rate at ${timestampKey}: ${num.toFixed(4)} TL/gram (from 0-amount tx)`);
                    break;
                }
            }
        }
    }

    console.log(`[isBankParser] FIRST PASS complete: Found ${exchangeRates.size} exchange rates`);

    // ========================================
    // SECOND PASS: Process actual transactions
    // ========================================
    for (let i = 0; i < dateMatches.length; i++) {
        const { match: dateMatch, index: startIndex } = dateMatches[i];

        // Get the text from this date to the next date (or end of content)
        const endIndex = i + 1 < dateMatches.length
            ? dateMatches[i + 1].index
            : normalized.length;

        const transactionText = normalized.substring(startIndex + dateMatch[0].length, endIndex).trim();

        // Parse date
        const day = parseInt(dateMatch[1]);
        const month = parseInt(dateMatch[2]) - 1;
        const year = parseInt(dateMatch[3]);
        const hour = parseInt(dateMatch[4]);
        const minute = parseInt(dateMatch[5]);
        const second = parseInt(dateMatch[6]);
        const date = new Date(year, month, day, hour, minute, second);
        const dateStr = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}`;
        const timestampKey = `${dateMatch[1]}/${dateMatch[2]}/${dateMatch[3]}-${dateMatch[4]}:${dateMatch[5]}`;

        // Parse transaction content
        // Split by whitespace (handles both TXT with multiple spaces and PDF with single spaces)
        const parts = transactionText.split(/\s+/).filter(p => p.trim() && p.length < 50);

        if (parts.length < 2) continue;

        // Parse each part to identify amount, balance, and description
        const numericParts: number[] = [];
        const textParts: string[] = [];

        for (const part of parts) {
            // Turkish number format: 1,51 or -1,00 (comma is decimal)
            // Also handle large numbers with dots as thousand separators: 2.874,0709
            if (/^-?[\d]+[,.][\d]+$/.test(part) || /^-?[\d]+$/.test(part) || /^-?[\d.]+,[\d]+$/.test(part)) {
                const num = parseTurkishDecimal(part);
                if (num !== 0 || part === '0' || part === '0,00') {
                    numericParts.push(num);
                } else {
                    textParts.push(part);
                }
            } else {
                textParts.push(part);
            }
        }

        // First numeric is usually the amount (change), second is balance
        let amount = 0;
        let balance = 0;

        if (numericParts.length >= 2) {
            amount = numericParts[0];
            balance = numericParts[1];
        } else if (numericParts.length === 1) {
            amount = numericParts[0];
        }

        const description = textParts.join(' ');

        // Skip zero-amount transactions (account opening, etc.)
        if (amount === 0) continue;

        // Determine transaction type from description
        const upperDesc = description.toUpperCase();

        // BUY indicators
        const isBuy = upperDesc.includes('ALIS') ||
                      upperDesc.includes('ALIM') ||
                      upperDesc.includes('ALIMI') ||
                      (amount > 0 && !upperDesc.includes('SATIS') && !upperDesc.includes('SATI'));

        // SELL indicators
        const isSell = upperDesc.includes('SATIS') ||
                       upperDesc.includes('SATI') ||
                       amount < 0;

        let txType: TransactionType = 'BUY';
        let txCost = 0;  // Total cost for this transaction
        let needsCostInput = false;

        // ========================================
        // EXTRACT UNIT PRICE from description (works for both BUY and SELL)
        // Format: "INTERNETTEN ALTIN SATIS/ DAB NO: 00000514 / 2981.65 TL"
        // Format: "ALTIN ALIS 2874.0709 TL"
        // ========================================
        const qty = Math.abs(amount);

        // Pattern 1: Find "XXXX.XX TL" or "XXXX,XX TL" in the description
        const tlMatches = transactionText.matchAll(/([\d.,]+)\s*TL/gi);
        const possibleUnitPrices: number[] = [];

        for (const costMatch of tlMatches) {
            const price = parseTurkishDecimal(costMatch[1]);
            if (price > 0) {
                possibleUnitPrices.push(price);
                console.log(`[isBankParser] TL match: "${costMatch[1]}" → ${price.toFixed(2)} TL`);
            }
        }

        // Find valid unit price in reasonable range (1000-50000 TL/gram for gold/platinum)
        let extractedUnitPrice = 0;
        for (const possiblePrice of possibleUnitPrices) {
            if (possiblePrice >= 1000 && possiblePrice <= 50000) {
                extractedUnitPrice = possiblePrice;
                console.log(`[isBankParser] Found valid unit price from description: ${extractedUnitPrice.toFixed(2)} TL/gram`);
                break;
            }
        }

        // Pattern 2: Third number in numeric parts might be unit price
        if (extractedUnitPrice === 0 && numericParts.length >= 3) {
            const thirdNum = numericParts[2];
            if (thirdNum >= 1000 && thirdNum <= 50000) {
                extractedUnitPrice = thirdNum;
                console.log(`[isBankParser] Found unit price from numeric parts: ${extractedUnitPrice.toFixed(2)} TL/gram`);
            }
        }

        // Pattern 3: Look up exchange rate from FIRST PASS (DÖVIZ KURU on separate line)
        if (extractedUnitPrice === 0) {
            const lookupRate = exchangeRates.get(timestampKey);
            if (lookupRate) {
                extractedUnitPrice = lookupRate;
                console.log(`[isBankParser] Found unit price from FIRST PASS exchange rates: ${extractedUnitPrice.toFixed(4)} TL/gram`);
            }
        }

        if (isSell) {
            txType = 'SELL';
            totalSold += Math.abs(amount);
            // For sells, we still want to record the unit price if found
            if (extractedUnitPrice > 0) {
                txCost = extractedUnitPrice * qty;
                console.log(`[isBankParser] SELL: Using extracted unit price ${extractedUnitPrice.toFixed(2)} TL/gram × ${qty} = ${txCost.toFixed(2)} TL`);
            }
        } else if (isBuy) {
            txType = 'BUY';
            totalBought += Math.abs(amount);

            // Use the already extracted unit price
            if (extractedUnitPrice > 0) {
                txCost = extractedUnitPrice * qty;
                totalBuyCost += txCost;
                console.log(`[isBankParser] BUY: Using extracted unit price ${extractedUnitPrice.toFixed(2)} TL/gram × ${qty} = ${txCost.toFixed(2)} TL`);
            } else {
                // If no cost found for this BUY transaction, flag it for manual input
                needsCostInput = true;
                console.log(`[isBankParser] BUY: No unit price found, flagging for manual input`);
            }
        } else {
            // Transfer or other - treat as buy if positive
            if (amount > 0) {
                txType = 'BUY';
                totalBought += Math.abs(amount);

                // Use already extracted unit price
                if (extractedUnitPrice > 0) {
                    txCost = extractedUnitPrice * qty;
                    totalBuyCost += txCost;
                    console.log(`[isBankParser] Transfer: Using extracted unit price ${extractedUnitPrice.toFixed(2)} TL/gram × ${qty} = ${txCost.toFixed(2)} TL`);
                } else {
                    // Transfers without cost need manual input
                    needsCostInput = true;
                }
            } else {
                txType = 'WITHDRAWAL';
            }
        }

        // Update current balance
        currentBalance = balance;

        // Create transaction
        const unitPrice = txCost > 0 ? txCost / Math.abs(amount) : 0;
        console.log(`[isBankParser] TX: ${dateStr} ${txType} qty=${Math.abs(amount).toFixed(4)}g, txCost=${txCost.toFixed(2)}, unitPrice=${unitPrice.toFixed(2)}, needsCostInput=${needsCostInput}`);

        transactions.push({
            symbol,
            name,
            type: txType,
            quantity: Math.abs(amount),
            price: unitPrice, // Unit price (TL per gram)
            currency: 'TRY',
            date,
            originalDateStr: dateStr,
            platform: 'IsBank',
            externalId: `ISBANK-${metalType}-${date.getTime()}-${Math.abs(amount)}`,
            fee: 0,
            totalCost: txCost,
            needsCostInput
        });

        processedCount++;
    }

    console.log('[isBankParser] Processed', processedCount, 'transactions, totalBought:', totalBought, 'totalSold:', totalSold);

    // Calculate average buy price
    const netQuantity = totalBought - totalSold;
    const avgBuyPrice = totalBought > 0 && totalBuyCost > 0
        ? totalBuyCost / totalBought
        : 0;

    // Sort transactions by date (oldest first)
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Use netQuantity as the authoritative source since it's calculated correctly
    const finalQuantity = netQuantity;

    // Create summary row
    const rows: ParsedRow[] = [];

    if (finalQuantity > QUANTITY_THRESHOLD) {
        const warnings: string[] = [];
        if (totalSold > 0) {
            warnings.push(`İşlem geçmişinden hesaplandı: ${totalBought.toFixed(4)} alım, ${totalSold.toFixed(4)} satım`);
        }
        if (avgBuyPrice === 0) {
            warnings.push('Ortalama maliyet hesaplanamadı - TRY tutarları bulunamadı');
        }

        rows.push({
            symbol,
            name,
            quantity: finalQuantity,
            buyPrice: avgBuyPrice,
            currency: 'TRY',
            type: 'COMMODITY',
            platform: 'IsBank',
            rawRow: { metalType, totalBought, totalSold, currentBalance, totalBuyCost },
            confidence: avgBuyPrice > 0 ? 90 : 70,
            warnings
        });
    }

    const closedPositionCount = netQuantity <= QUANTITY_THRESHOLD && totalBought > 0 ? 1 : 0;

    return {
        rows,
        transactions,
        processedCount,
        closedPositionCount
    };
}
