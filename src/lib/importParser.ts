/**
 * Smart Import Parser
 * Handles CSV/Excel parsing with fuzzy column matching
 * Supports: Generic CSV, DeGiro Transactions, Interactive Brokers, etc.
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// Known column name variations for fuzzy matching
const COLUMN_ALIASES: Record<string, string[]> = {
    symbol: ['symbol', 'ticker', 'code', 'sembol', 'kod', 'hisse', 'stock'],
    isin: ['isin'],
    name: ['name', 'company', 'şirket', 'isim', 'ad', 'firma', 'description', 'product'],
    quantity: ['quantity', 'qty', 'amount', 'adet', 'miktar', 'lot', 'shares', 'units'],
    buyPrice: ['buyprice', 'buy_price', 'cost', 'price', 'fiyat', 'maliyet', 'alış', 'alis', 'avg_cost', 'average'],
    currency: ['currency', 'cur', 'para birimi', 'doviz', 'döviz', 'ccy'],
    type: ['type', 'asset_type', 'category', 'tip', 'tür', 'tur', 'kategori'],
    platform: ['platform', 'broker', 'exchange', 'borsa', 'aracı kurum', 'araci'],
    localValue: ['local value', 'localvalue', 'value', 'total', 'wert', 'betrag', 'gesamtwert', 'tutar'],
    valueEur: ['value eur', 'valueeur', 'total eur', 'totaleur'],
    date: ['date', 'tarih', 'transaction date'],
    description: ['description', 'omschrijving', 'beschreibung'],
    change: ['change', 'mutatie', 'veraenderung', 'veränderung'],
    balance: ['balance', 'saldo', 'bestand'],
    orderid: ['orderid', 'order id', 'order-id', 'auftragsnummer'],
};

// ISIN to Symbol mapping for common securities
// This will be extended by Yahoo API lookups
const ISIN_TO_SYMBOL: Record<string, { symbol: string; name: string; type: string }> = {
    // US Stocks
    'US88160R1014': { symbol: 'TSLA', name: 'Tesla Inc', type: 'STOCK' },
    'US67066G1040': { symbol: 'NVDA', name: 'NVIDIA Corporation', type: 'STOCK' },
    'US0378331005': { symbol: 'AAPL', name: 'Apple Inc', type: 'STOCK' },
    'US5949181045': { symbol: 'MSFT', name: 'Microsoft Corporation', type: 'STOCK' },
    'US02079K3059': { symbol: 'GOOGL', name: 'Alphabet Inc', type: 'STOCK' },
    'US0231351067': { symbol: 'AMZN', name: 'Amazon.com Inc', type: 'STOCK' },
    'US30303M1027': { symbol: 'META', name: 'Meta Platforms Inc', type: 'STOCK' },
    'US7170811035': { symbol: 'PFE', name: 'Pfizer Inc', type: 'STOCK' },
    'US8552441094': { symbol: 'SBUX', name: 'Starbucks Corporation', type: 'STOCK' },
    'US64110L1061': { symbol: 'NFLX', name: 'Netflix Inc', type: 'STOCK' },
    'US38268T1034': { symbol: 'GPRO', name: 'GoPro Inc', type: 'STOCK' },
    'US9001112047': { symbol: 'TKC', name: 'Turkcell ADR', type: 'STOCK' },
    'US69608A1088': { symbol: 'PLTR', name: 'Palantir Technologies', type: 'STOCK' },
    'US15961R1059': { symbol: 'CHPT', name: 'ChargePoint Holdings', type: 'STOCK' },
    'KYG8990D1253': { symbol: 'TPGY', name: 'TPG Pace Beneficial', type: 'STOCK' },
    // German Stocks
    'DE0007500001': { symbol: 'TKA.DE', name: 'ThyssenKrupp AG', type: 'STOCK' },
    // ETFs
    'IE00B5BMR087': { symbol: 'CSPX.L', name: 'iShares Core S&P 500 UCITS ETF', type: 'FUND' },
    'IE00B53SZB19': { symbol: 'CNDX.L', name: 'iShares NASDAQ 100 UCITS ETF', type: 'FUND' },
    'IE00BK5BQT80': { symbol: 'VWCE.DE', name: 'Vanguard FTSE All-World UCITS ETF', type: 'FUND' },
    'IE00B3RBWM25': { symbol: 'VWRL.AS', name: 'Vanguard FTSE All-World UCITS ETF', type: 'FUND' },
    'DE000A0Q4R85': { symbol: 'IBZL.DE', name: 'iShares MSCI Brazil UCITS ETF', type: 'FUND' },
    'IE00BLRPRJ20': { symbol: 'PHAU.L', name: 'WisdomTree Physical Gold', type: 'FUND' },
    'IE00BLRPRL42': { symbol: 'PHAG.L', name: 'WisdomTree Physical Silver', type: 'FUND' },
    'IE00BMC38736': { symbol: 'SMH.L', name: 'VanEck Semiconductor UCITS ETF', type: 'FUND' },
    'IE00BJXRZJ40': { symbol: 'CYBR.L', name: 'Rize Cybersecurity ETF', type: 'FUND' },
    'IE00BF0M2Z96': { symbol: 'BATG.L', name: 'L&G Battery Value-Chain ETF', type: 'FUND' },
    'IE00BYPLS672': { symbol: 'ISPY.L', name: 'L&G Cyber Security ETF', type: 'FUND' },
    'IE00BLCHJN13': { symbol: 'LIT.L', name: 'Global X Lithium & Battery Tech ETF', type: 'FUND' },
    'IE000GA3D489': { symbol: 'ARKK.L', name: 'ARK Innovation UCITS ETF', type: 'FUND' },
    'IE000O5M6XO1': { symbol: 'ARKG.L', name: 'ARK Genomic Revolution UCITS ETF', type: 'FUND' },
    'IE0003A512E4': { symbol: 'ARKQ.L', name: 'ARK AI & Robotics UCITS ETF', type: 'FUND' },
    'GB00BLD4ZM24': { symbol: 'ETHE.L', name: 'CoinShares Physical Staked Ethereum', type: 'CRYPTO' },
    // Bonds / Certificates
    'XS1002121454': { symbol: 'RABO.AS', name: 'Rabobank Certificate', type: 'BOND' },
    // Crypto (DeGiro specific ISINs)
    'XFC000A2YY6Q': { symbol: 'BTC-EUR', name: 'Bitcoin', type: 'CRYPTO' },
    'XFC000A2YY6X': { symbol: 'ETH-EUR', name: 'Ethereum', type: 'CRYPTO' },
    'XFC000A402FE': { symbol: 'XRP-EUR', name: 'XRP', type: 'CRYPTO' },
};

export interface ParsedTransaction {
    symbol: string;
    name?: string;
    type: TransactionType;
    quantity: number;
    price: number;
    currency: string;
    date: Date;
    originalDateStr?: string;
    exchange?: string;
    platform: string;
    externalId?: string;
    fee: number;
}

export type TransactionType = 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAWAL' | 'DIVIDEND' | 'COUPON' | 'INTEREST' | 'FEE' | 'FX';

export interface ParsedRow {
    symbol: string;
    name?: string;
    quantity: number;
    buyPrice: number;
    currency: string;
    type?: string;
    platform?: string;
    isin?: string;
    rawRow: Record<string, any>;
    confidence: number; // 0-100 how confident we are about this row
    warnings: string[];
}

export interface ParseResult {
    success: boolean;
    rows: ParsedRow[];
    transactions: ParsedTransaction[];
    detectedColumns: Record<string, string>; // our field -> their column name
    unmappedColumns: string[];
    errors: string[];
    totalRows: number;
    skippedRows: number;
    closedPositionCount?: number;
    detectedFormat?: 'generic' | 'degiro' | 'ibkr';
}

/**
 * Normalize a string for comparison (lowercase, remove spaces/special chars)
 */
function normalize(str: string): string {
    return str
        .toLowerCase()
        .replace(/[_\-\s]/g, '')
        .replace(/[şŞ]/g, 's')
        .replace(/[ıİ]/g, 'i')
        .replace(/[üÜ]/g, 'u')
        .replace(/[öÖ]/g, 'o')
        .replace(/[çÇ]/g, 'c')
        .replace(/[ğĞ]/g, 'g');
}

/**
 * Clean and unique headers for PapaParse
 */
function uniqueHeaders(header: string, index: number): string {
    const clean = header.trim();
    return clean || `__EMPTY_${index}`;
}

/**
 * Parse European number format (1.234,56 or 1234,56) to standard float
 */
function parseEuropeanNumber(value: string | number | undefined | null): number {
    if (value === undefined || value === null || value === '') return 0;
    const str = String(value).trim();
    if (str === '') return 0;

    // Remove quotes
    let cleaned = str.replace(/^["']|["']$/g, '');

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

/**
 * Find best matching column for a field using fuzzy matching
 */
function findBestMatch(columns: string[], field: string): string | null {
    const aliases = COLUMN_ALIASES[field] || [field];

    for (const alias of aliases) {
        const normalizedAlias = normalize(alias);

        // Exact match (after normalization)
        const exactMatch = columns.find(col => normalize(col) === normalizedAlias);
        if (exactMatch) return exactMatch;

        // Starts with match
        const startsMatch = columns.find(col => normalize(col).startsWith(normalizedAlias));
        if (startsMatch) return startsMatch;

        // Contains match
        const containsMatch = columns.find(col => normalize(col).includes(normalizedAlias));
        if (containsMatch) return containsMatch;
    }

    return null;
}

/**
 * Detect if this is a DeGiro transaction export
 */
function isDeGiroFormat(columns: string[]): boolean {
    const normalized = columns.map(c => normalize(c));
    // DeGiro has: Date, Time, Product, ISIN, Reference exchange, Venue, Quantity, Price, etc.
    return normalized.includes('isin') &&
        normalized.includes('product') &&
        (normalized.includes('referenceexchange') || normalized.includes('venue'));
}

/**
 * Detect if this is a DeGiro Account Statement (Cash Report)
 * Characterized by: Description, Change, Balance, and missing 'Venue' usually
 */
function isDeGiroAccountStatementFormat(columns: string[]): boolean {
    const normalized = columns.map(c => normalize(c));
    // Must have Description, Change, Balance, Order Id (or their Dutch/German equivalents)
    // We can use findBestMatch to check existence efficiently against aliases

    const hasDescription = findBestMatch(normalized, 'description');
    const hasChange = findBestMatch(normalized, 'change');
    const hasBalance = findBestMatch(normalized, 'balance');
    const hasOrderId = findBestMatch(normalized, 'orderid');

    return !!(hasDescription && hasChange && hasBalance && hasOrderId);
}

/**
 * Auto-detect column mappings from header row
 */
function detectColumnMappings(columns: string[], isDeGiro: boolean = false): Record<string, string> {
    const mappings: Record<string, string> = {};
    const usedColumns = new Set<string>();

    // Priority order depends on format
    const fieldOrder = isDeGiro
        ? ['isin', 'name', 'quantity', 'buyPrice', 'currency', 'localValue', 'valueEur', 'date']
        : ['symbol', 'isin', 'quantity', 'buyPrice', 'currency', 'name', 'type', 'platform', 'date'];

    for (const field of fieldOrder) {
        const match = findBestMatch(
            columns.filter(c => !usedColumns.has(c)),
            field
        );
        if (match) {
            mappings[field] = match;
            usedColumns.add(match);
        }
    }

    return mappings;
}

/**
 * Resolve ISIN to symbol using our mapping table
 */
function resolveISIN(isin: string): { symbol: string; name: string; type: string } | null {
    const upperIsin = isin.toUpperCase().trim();
    return ISIN_TO_SYMBOL[upperIsin] || null;
}

/**
 * Infer asset type from product name
 */
function inferTypeFromName(name: string): string {
    const upper = name.toUpperCase();
    if (upper.includes('BITCOIN') || upper.includes('BTC')) return 'CRYPTO';
    if (upper.includes('ETHEREUM') || upper.includes('ETH')) return 'CRYPTO';
    if (upper.includes('XRP') || upper.includes('RIPPLE')) return 'CRYPTO';
    if (upper.includes('COINSHARES') || upper.includes('CRYPTO')) return 'CRYPTO';
    if (upper.includes('ETF') || upper.includes('UCITS')) return 'FUND';
    if (upper.includes('ISHARES') || upper.includes('VANGUARD') || upper.includes('WISDOMTREE')) return 'FUND';
    if (upper.includes('ARK ')) return 'FUND';
    if (upper.includes('CERTIF') || upper.includes('BOND')) return 'BOND';
    return 'STOCK';
}

/**
 * Parse date string to Date object
 * Supports DD-MM-YYYY, YYYY-MM-DD, etc.
 */
function parseDate(dateStr: string): Date {
    if (!dateStr) return new Date();

    // DeGiro uses DD-MM-YYYY
    const parts = dateStr.split(/[-/.]/);
    if (parts.length === 3) {
        // Guess format based on year position
        if (parts[2].length === 4) {
            // DD-MM-YYYY
            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        } else if (parts[0].length === 4) {
            // YYYY-MM-DD
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
    }

    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Parse DeGiro transaction rows and aggregate by ISIN
 */
function parseDeGiroTransactions(data: Record<string, any>[], mappings: Record<string, string>): { rows: ParsedRow[], transactions: ParsedTransaction[], processedCount: number, closedPositionCount: number } {
    // Group transactions by ISIN for Asset Snapshot
    const transactionsByIsin: Record<string, {
        isin: string;
        name: string;
        buys: { quantity: number; price: number; value: number }[];
        sells: { quantity: number; price: number; value: number }[];
        currency: string;
    }> = {};

    const transactions: ParsedTransaction[] = [];
    let processedCount = 0;

    const isinCol = mappings['isin'];
    const nameCol = mappings['name'];
    const qtyCol = mappings['quantity'];
    const priceCol = mappings['buyPrice'];
    const dateCol = mappings['date'];

    // Possible columns for IDs
    const idAliases = ['orderid', 'id', 'ref', 'reference'];

    // Find currency column - might be empty header before "Local value"
    // In DeGiro, look for the column that contains EUR/USD values
    const columns = Object.keys(data[0] || {});

    // Track external IDs to handle duplicates (partial fills sharing same Order ID)
    const externalIdCounts = new Map<string, number>();

    for (const row of data) {
        const isin = isinCol ? String(row[isinCol] || '').trim() : '';
        if (!isin || isin.length < 5) continue; // Skip invalid ISINs

        // Assuming this row is valid enough to attempt processing
        processedCount++;

        const name = nameCol ? String(row[nameCol] || '').trim() : '';

        // Parse basic numeric fields
        let quantity = qtyCol ? parseEuropeanNumber(row[qtyCol]) : 0;
        const price = priceCol ? parseEuropeanNumber(row[priceCol]) : 0;
        const dateStr = dateCol ? String(row[dateCol] || '') : '';
        const date = parseDate(dateStr);

        // Find External ID (Order ID)
        let externalId = '';
        for (const col of columns) {
            const normal = normalize(col);
            if (idAliases.some(alias => normal === alias || normal.endsWith(alias))) {
                // If found, check value
                const val = String(row[col] || '').trim();
                // DeGiro uses UUIDs usually
                if (val && val.length > 5) {
                    externalId = val;
                    break;
                }
            }
        }

        // Make external ID unique for partial fills (same Order ID serves multiple rows)
        if (externalId) {
            const count = externalIdCounts.get(externalId) || 0;
            externalIdCounts.set(externalId, count + 1);
            if (count > 0) {
                externalId = `${externalId}-${count}`;
            }
        }

        // If no explicit ID column found by name, try looking at the very last column if unlabeled?
        // But DeGiro has "Order ID" explicitly. The normalize logic should catch it.

        // For crypto (empty quantity), calculate from value / price
        // Look for "Local value" or "Value EUR" columns
        let localValue = 0;
        for (const col of columns) {
            const normalCol = normalize(col);
            const isLocalValueCol = COLUMN_ALIASES.localValue.some(alias => normalCol.includes(normalize(alias)));

            if (isLocalValueCol || (normalCol === '' && columns.indexOf(col) > columns.indexOf(priceCol || ''))) {
                const val = parseEuropeanNumber(row[col]);
                if (val !== 0) {
                    localValue = val;
                    break;
                }
            }
        }

        // If quantity is 0 but we have price and value, calculate quantity
        if (quantity === 0 && price > 0 && localValue !== 0) {
            quantity = Math.abs(localValue) / price;
        }

        // Determine if buy or sell from value sign or quantity sign
        const isSell = localValue > 0 || quantity < 0;
        quantity = Math.abs(quantity);

        // DeGiro special case: Bonds/Certificates (ISIN starting with XS) are reported in nominal value
        // Real quantity = nominal / 100
        if (isin && isin.startsWith('XS')) {
            quantity = quantity / 100;
        }

        if (quantity === 0) continue; // Skip if still no quantity

        // Detect currency from the row
        let currency = 'EUR'; // Default for DeGiro
        for (const col of columns) {
            const val = String(row[col] || '').trim().toUpperCase();
            if (val === 'USD' || val === 'EUR' || val === 'TRY') {
                currency = val;
                break;
            }
        }

        // Resolve Symbol for Transaction History
        const resolved = resolveISIN(isin);
        const symbol = resolved?.symbol || isin;
        let exchange = '';

        // Try to find exchange/venue
        for (const col of columns) {
            const normal = normalize(col);
            if (normal.includes('exchange') || normal.includes('venue')) {
                const val = String(row[col] || '');
                if (val) exchange = val;
            }
        }

        // 1. Add to Transaction History
        transactions.push({
            symbol,
            name: name || resolved?.name,
            type: isSell ? 'SELL' : 'BUY',
            quantity,
            price,
            currency,
            date,
            originalDateStr: dateStr,
            exchange,
            platform: 'DeGiro',
            externalId,
            fee: 0 // Fee parsing could be added (AutoFX, etc column)
        });

        // 2. Add to Aggregation for Asset Snapshot
        if (!transactionsByIsin[isin]) {
            transactionsByIsin[isin] = {
                isin,
                name: name || isin,
                buys: [],
                sells: [],
                currency
            };
        }

        const transaction = { quantity, price, value: Math.abs(localValue) };
        if (isSell) {
            transactionsByIsin[isin].sells.push(transaction);
        } else {
            transactionsByIsin[isin].buys.push(transaction);
        }
    }

    // Sort transactions by date (Oldest first)
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Now aggregate each ISIN into a single row for Asset Snapshot
    const rows: ParsedRow[] = [];
    let closedPositionCount = 0;

    for (const [isin, data] of Object.entries(transactionsByIsin)) {
        // Calculate net position
        const totalBought = data.buys.reduce((sum, t) => sum + t.quantity, 0);
        const totalSold = data.sells.reduce((sum, t) => sum + t.quantity, 0);
        const netQuantity = totalBought - totalSold;

        // Check if position is closed (net quantity <= 0)
        // Ensure we handle floating point errors
        const isClosed = netQuantity <= 0.000001;

        if (isClosed) {
            closedPositionCount++;
            // We DO want to return closed positions as rows now, so they can be reviewed and imported as history
            // continue; <--- REMOVED THIS SKIP
        }

        // Calculate weighted average buy price
        // Simple logic: Total Cost / Total Units Bought (First In First Out is implied or Avg Cost)
        // For net position, we often just use avg buy price of *remaining* units, 
        // but simple Avg Buy Cost of all buys is often used for simplicity in imports if not tracking lots.
        // Let's stick to Weighted Avg of ALL buys for now as a safe proxy.
        // For closed positions, avgBuyPrice is still relevant for historical analysis
        const totalBuyCost = data.buys.reduce((sum, t) => sum + (t.quantity * t.price), 0);
        const avgBuyPrice = totalBought > 0 ? totalBuyCost / totalBought : 0;

        // Resolve ISIN to symbol
        const resolved = resolveISIN(isin);
        const symbol = resolved?.symbol || isin; // Fallback to ISIN if not found
        const type = resolved?.type || inferTypeFromName(data.name);

        const warnings: string[] = [];
        let confidence = resolved ? 100 : 85;

        // Better symbol resolution for common big tech if not in map
        let resolvedName = resolved?.name || data.name;

        if (!resolved) {
            // If ISIN not in map, maybe we can extract from name (e.g. "APPLE INC" -> AAPL is hard, but we can warn)
            // Or keep ISIN as symbol
            if (symbol === isin) {
                warnings.push(`Used ISIN ${isin} as symbol. Please verify.`);
                confidence -= 10;
            }
        }

        if (totalSold > 0) {
            warnings.push(`Calculated from history: ${totalBought.toFixed(4)} bought, ${totalSold.toFixed(4)} sold`);
        }

        rows.push({
            symbol,
            name: resolvedName,
            quantity: netQuantity,
            buyPrice: avgBuyPrice,
            currency: data.currency,
            type,
            platform: 'DeGiro',
            isin,
            rawRow: { isin, transactions: data.buys.length + data.sells.length },
            confidence,
            warnings
        });
    }

    return { rows, transactions, processedCount, closedPositionCount };
}

/**
 * Parse DeGiro Account Statement (Cash Report)
 * Extracts transaction info from "Description" column e.g. "Koop 10 @ 100 EUR"
 */
function parseDeGiroAccountStatement(data: Record<string, any>[], mappings: Record<string, string>, columns: string[]): { rows: ParsedRow[], transactions: ParsedTransaction[], processedCount: number, closedPositionCount: number } {
    // 1. Identify specific columns for Value/Amount
    // In this format, "Change" is the currency column, and the column AFTER it is the value
    // "Balance" is currency, column AFTER is balance value
    // We renamed empty columns to __EMPTY_${index}

    // Find index of 'Change' column
    const headerRow = columns; // Assuming data keys match these if processed correctly? 
    // PapaParse keys come from the transformHeader.
    // We need to find the key that corresponds to the empty column after Change.

    // Actually, `mappings` contains our standard fields mapping. 
    // But 'Change' isn't a standard field in our generic map. 
    // Let's rely on the specific keys generated.

    // Find the key for "Change" (Currency) if not mapped yet (though we use findBestMatch below)
    // We need to identify the VALUE column associated with Change.
    // In DeGiro CSVs, often: "Mutatie" (header) -> "EUR" (value in row? No, "Mutatie" column contains currency? Wait)
    // Actually, in the supplied CSV structure (implied):
    // Header: ..., Mutatie, ...
    // Row: ..., "EUR", -100.00 (in NEXT column)
    // OR: Row: ..., -100.00, ... (if Mutatie is value)

    // Let's assume the passed data uses the header name as key.
    // If "Mutatie" is the key, `row['Mutatie']` gives the value.
    // However, the prompt/comments suggest "Change" is Currency and next col is val?
    // Let's look at `uniqueHeaders`. Empty headers become `__EMPTY_X`.

    // Strategy: Find the 'Change' column. If its value is 'EUR'/'USD', then look at next column.
    // If its value is numeric, then it IS the value.

    const keys = Object.keys(data[0] || {});

    const transactionsByIsin: Record<string, {
        isin: string;
        name: string;
        buys: { quantity: number; price: number; value: number }[];
        sells: { quantity: number; price: number; value: number }[];
        currency: string;
    }> = {};

    const transactions: ParsedTransaction[] = [];
    let processedCount = 0;

    const isinCol = mappings['isin'] || findBestMatch(keys, 'isin');

    // Explicitly look for Statement columns using our new aliases
    const descCol = mappings['description'] || findBestMatch(keys, 'description');
    const orderIdCol = mappings['orderid'] || findBestMatch(keys, 'orderid');
    const productCol = mappings['product'] || findBestMatch(keys, 'product') || mappings['name']; // Product is Name
    const dateCol = mappings['date'] || findBestMatch(keys, 'date');
    const changeColKey = mappings['change'] || findBestMatch(keys, 'change');
    const balanceColKey = mappings['balance'] || findBestMatch(keys, 'balance');

    // Regex for parsing Description
    const tradeRegex = /(Koop|Buy|Verkauf|Kauf|Verkoop|Sell)\s+([\d.,]+)\s+(@|at)\s+([\d.,]+)\s+([A-Z]{3})/i;
    const dividendRegex = /(Dividend|Coupon|Kupon|Temettü)/i;
    const interestRegex = /(Rente|Interest)/i;
    const feeRegex = /(Transactiekosten|Aansluitingskosten|Kosten|Fee|Tax|Belasting)/i; // Aansluitingskosten = Connection fee
    const depositRegex = /(Deposit|Storting|Einzahlung)/i;
    const withdrawalRegex = /(Withdrawal|Terugstorting|Auszahlung)/i;
    const transferRegex = /(Overboeking|Transfer|Überweisung)/i; // Ambiguous, check sign
    const fxRegex = /(Valuta|FX)/i;
    const reservationRegex = /(Reservation|Reservering)/i; // Ignore these usually? User said ignore/categorize but don't show.

    for (const row of data) {
        const isin = isinCol ? String(row[isinCol] || '').trim() : '';
        const description = descCol ? String(row[descCol] || '').trim() : '';
        const dateStr = dateCol ? String(row[dateCol] || '') : '';
        const date = parseDate(dateStr);
        const orderId = orderIdCol ? String(row[orderIdCol] || '').trim() : '';
        const product = productCol ? String(row[productCol] || '').trim() : '';

        // Value/Amount parsing
        // Value/Amount parsing
        // Check if changeColKey holds a currency string (EUR/USD) or a number
        let changeAmount = 0;
        let changeCurrency = 'EUR'; // Default

        if (changeColKey) {
            const val = row[changeColKey];
            const isCurrency = val && (val === 'EUR' || val === 'USD' || val === 'TRY' || val.length === 3);

            if (isCurrency) {
                // The 'Change' column is the Currency column
                changeCurrency = val;
                // The amount is in the NEXT header (which might be __EMPTY_X)
                // We need to find the key that corresponds to the index of changeColKey + 1
                const idx = keys.indexOf(changeColKey);
                if (idx !== -1 && idx + 1 < keys.length) {
                    const amtKey = keys[idx + 1];
                    changeAmount = parseEuropeanNumber(row[amtKey]);
                }
            } else {
                // The 'Change' column IS the amount (e.g. Dutch 'Mutatie' often has the amount directly if currency is elsewhere, OR it behaves as above)
                // Let's check if there is an empty column next to it that looks numeric?
                // Actually, standard behavior: 
                // Col matches 'Mutatie'. Row value: '-100,00'.
                changeAmount = parseEuropeanNumber(val);

                // Try to find currency elsewhere?
                // Often 'Mutatie' is amount, and there isn't a specific currency col for it, 
                // but the Account has a base currency (EUR).
                // Or looking at 'Saldo' (Balance) column logic?
                // Let's stick to EUR default if not found.
            }
        }

        // --- Categorization ---

        // 0. Skip Reservations / Cash Sweep (intermediate)
        if (reservationRegex.test(description)) continue;
        // Cash Sweep is usually internal noise, unless user wants it. 
        // "Degiro Cash Sweep Transfer" -> usually we ignore, we care about "Deposit" or "Withdrawal" or "Overboeking"
        // But "Overboeking van/naar" matches Transfer.
        // Let's filter strictly.
        if (description.includes('Degiro Cash Sweep')) continue;

        // 1. TRADES (Buy/Sell)
        const tradeMatch = description.match(tradeRegex);
        if (tradeMatch && isin) {
            processedCount++;
            const actionStr = tradeMatch[1].toLowerCase();
            const isSell = actionStr.startsWith('v') || actionStr.startsWith('s');

            const quantity = parseEuropeanNumber(tradeMatch[2]);
            const price = parseEuropeanNumber(tradeMatch[4]); // Group 4 is Price
            const currency = tradeMatch[5].toUpperCase(); // Group 5 is Currency

            // Resolve Symbol
            const resolved = resolveISIN(isin);
            const symbol = resolved?.symbol || isin;
            const name = resolved?.name || product || isin;

            transactions.push({
                symbol,
                name,
                type: isSell ? 'SELL' : 'BUY',
                quantity,
                price,
                currency,
                date,
                originalDateStr: dateStr,
                platform: 'DeGiro',
                externalId: orderId,
                fee: 0
            });

            // Add to Aggregation (Snapshot/Open Positions)
            if (!transactionsByIsin[isin]) {
                transactionsByIsin[isin] = { isin, name, buys: [], sells: [], currency };
            }
            if (isSell) transactionsByIsin[isin].sells.push({ quantity, price, value: quantity * price });
            else transactionsByIsin[isin].buys.push({ quantity, price, value: quantity * price });

            continue; // Done with this row
        }

        // 2. FEES (Moved before Income to catch "Dividend Tax")
        if (feeRegex.test(description)) {
            processedCount++;
            transactions.push({
                symbol: 'FEES',
                name: 'Trading Fees',
                type: 'FEE' as any,
                quantity: 0,
                price: changeAmount, // usually negative
                currency: changeCurrency,
                date,
                originalDateStr: dateStr,
                platform: 'DeGiro',
                externalId: orderId || `FEE-${dateStr}-${changeAmount}`,
                fee: Math.abs(changeAmount)
            });
            continue;
        }

        // 3. INCOME (Dividends/Coupons/Interest)
        // Check for Dividend/Coupon
        if (dividendRegex.test(description)) {
            processedCount++;
            const isCoupon = /Coupon/i.test(description);

            // Resolve Asset
            let symbol = 'UNKNOWN';
            let name = 'Unknown Asset';
            if (isin) {
                const resolved = resolveISIN(isin);
                symbol = resolved?.symbol || isin;
                name = resolved?.name || product || isin;
            }

            transactions.push({
                symbol,
                name,
                type: isCoupon ? 'COUPON' : 'DIVIDEND' as any, // Cast to any if strict typing complains, but we added type above
                quantity: 0, // No qty change
                price: Math.abs(changeAmount), // Value
                currency: changeCurrency,
                date,
                originalDateStr: dateStr,
                platform: 'DeGiro',
                externalId: orderId || `DIV-${dateStr}-${Math.abs(changeAmount)}`,
                fee: 0
            });
            continue;
        }

        // Check for Interest
        if (interestRegex.test(description)) {
            processedCount++;
            transactions.push({
                symbol: 'EUR', // Linked to Cash
                name: 'Interest Income',
                type: 'INTEREST' as any,
                quantity: 0,
                price: changeAmount,
                currency: changeCurrency,
                date,
                originalDateStr: dateStr,
                platform: 'DeGiro',
                externalId: `INT-${dateStr}-${changeAmount}`,
                fee: 0
            });
            continue;
        }

        // 4. CASH (Deposits/Withdrawals)
        if (depositRegex.test(description) || (transferRegex.test(description) && changeAmount > 0)) {
            processedCount++;
            transactions.push({
                symbol: 'EUR',
                name: 'Cash Deposit',
                type: 'DEPOSIT' as any,
                quantity: Math.abs(changeAmount),
                price: 1, // 1:1
                currency: changeCurrency,
                date,
                originalDateStr: dateStr,
                platform: 'DeGiro',
                externalId: `DEP-${dateStr}-${changeAmount}`,
                fee: 0
            });
            continue;
        }

        if (withdrawalRegex.test(description) || (transferRegex.test(description) && changeAmount < 0)) {
            processedCount++;
            transactions.push({
                symbol: 'EUR',
                name: 'Cash Withdrawal',
                type: 'WITHDRAWAL' as any,
                quantity: Math.abs(changeAmount),
                price: 1,
                currency: changeCurrency,
                date,
                originalDateStr: dateStr,
                platform: 'DeGiro',
                externalId: `WTH-${dateStr}-${changeAmount}`,
                fee: 0
            });
            continue;
        }

        // 5. FX (Valuta) - Import but maybe hide? User said "categorize import but dont show"
        if (fxRegex.test(description)) {
            // We skip adding to main transactions list to avoid clutter? 
            // Or add with type 'FX' so backend handles it?
            transactions.push({
                symbol: isin ? (resolveISIN(isin)?.symbol || isin) : 'FX',
                name: 'FX Conversion',
                type: 'FX' as any,
                quantity: 0,
                price: changeAmount,
                currency: changeCurrency,
                date,
                originalDateStr: dateStr,
                platform: 'DeGiro',
                externalId: orderId,
                fee: 0
            });
            continue;
        }
    }

    // Aggregate to Rows (Snapshot)
    // Only trades affect "Rows" (Open/Closed Positions) logic significantly for the preview table
    // However, the user wants CASH and FEES as closed positions.

    // Sort transactions by date (Oldest first)
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    const rows: ParsedRow[] = [];
    let closedPositionCount = 0;

    // Add Cash Position Check
    const cashTx = transactions.filter(t => t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL' || t.type === 'INTEREST');
    if (cashTx.length > 0) {
        // Calculate net cash input (Deposits - Withdrawals + Interest)
        const netCash = cashTx.reduce((sum, t) => {
            if (t.type === 'DEPOSIT') return sum + t.quantity;
            if (t.type === 'INTEREST') return sum + t.price; // Interest amount is stored in price
            if (t.type === 'WITHDRAWAL') return sum - t.quantity;
            return sum;
        }, 0);

        if (Math.abs(netCash) > 0.01) {
            rows.push({
                symbol: 'EUR',
                name: 'Cash (EUR)',
                quantity: netCash,
                buyPrice: 1,
                currency: 'EUR',
                type: 'CASH',
                platform: 'DeGiro',
                isin: 'EUR-CASH',
                rawRow: { isin: 'EUR-CASH', transactions: cashTx.length },
                confidence: 100,
                warnings: []
            });
        }
    }

    // ... existing Trade Aggregation loop ...


    for (const [isin, data] of Object.entries(transactionsByIsin)) {
        const totalBought = data.buys.reduce((sum, t) => sum + t.quantity, 0);
        const totalSold = data.sells.reduce((sum, t) => sum + t.quantity, 0);
        const netQuantity = totalBought - totalSold;

        if (netQuantity <= 0.000001) {
            closedPositionCount++;
            continue;
        }

        const totalBuyCost = data.buys.reduce((sum, t) => sum + (t.quantity * t.price), 0);
        const avgBuyPrice = totalBought > 0 ? totalBuyCost / totalBought : 0;

        const resolved = resolveISIN(isin);
        const symbol = resolved?.symbol || isin;
        const type = resolved?.type || inferTypeFromName(data.name);

        let confidence = resolved ? 100 : 85;
        const warnings: string[] = [];

        if (totalSold > 0) {
            warnings.push(`Calculated from history: ${totalBought.toFixed(4)} bought, ${totalSold.toFixed(4)} sold`);
        }

        rows.push({
            symbol,
            name: data.name,
            quantity: netQuantity,
            buyPrice: avgBuyPrice,
            currency: data.currency,
            type,
            platform: 'DeGiro',
            isin,
            rawRow: { isin, transactions: data.buys.length + data.sells.length },
            confidence,
            warnings
        });
    }

    return { rows, transactions, processedCount, closedPositionCount };
}

/**
 * Parse a single row using detected mappings (generic format)
 */
function parseRow(
    row: Record<string, any>,
    mappings: Record<string, string>,
    rowIndex: number
): ParsedRow | null {
    const warnings: string[] = [];
    let confidence = 100;

    // Try to get symbol from ISIN first, then symbol column
    let symbol = '';
    let resolvedData: { symbol: string; name: string; type: string } | null = null;

    const isinCol = mappings['isin'];
    if (isinCol && row[isinCol]) {
        const isin = String(row[isinCol]).trim();
        resolvedData = resolveISIN(isin);
        if (resolvedData) {
            symbol = resolvedData.symbol;
        }
    }

    // If no ISIN resolution, try symbol column
    if (!symbol) {
        const symbolCol = mappings['symbol'];
        const rawSymbol = symbolCol ? row[symbolCol] : null;
        if (!rawSymbol || String(rawSymbol).trim() === '') {
            return null; // Skip rows without symbol
        }
        symbol = String(rawSymbol).trim().toUpperCase();
    }

    // Get quantity (required)
    const qtyCol = mappings['quantity'];
    let quantity = 0;
    if (qtyCol && row[qtyCol] !== undefined && row[qtyCol] !== '') {
        quantity = parseEuropeanNumber(row[qtyCol]);
        if (quantity <= 0) {
            warnings.push('Invalid quantity, defaulted to 0');
            confidence -= 20;
        }
    } else {
        warnings.push('Missing quantity');
        confidence -= 30;
    }

    // Get buy price (required for P/L calculation)
    const priceCol = mappings['buyPrice'];
    let buyPrice = 0;
    if (priceCol && row[priceCol] !== undefined && row[priceCol] !== '') {
        buyPrice = parseEuropeanNumber(row[priceCol]);
        if (buyPrice < 0) {
            warnings.push('Invalid price');
            confidence -= 15;
        }
    } else {
        warnings.push('Missing buy price - will need to be set');
        confidence -= 20;
    }

    // Get currency (optional, default to USD)
    const currCol = mappings['currency'];
    let currency = 'USD';
    if (currCol && row[currCol]) {
        const cur = String(row[currCol]).trim().toUpperCase();
        if (['USD', 'EUR', 'TRY'].includes(cur)) {
            currency = cur;
        } else if (cur.includes('TL') || cur.includes('₺') || cur.includes('TRY')) {
            currency = 'TRY';
        } else if (cur.includes('€') || cur.includes('EUR')) {
            currency = 'EUR';
        } else if (cur.includes('$') || cur.includes('USD')) {
            currency = 'USD';
        } else {
            // Try to infer from symbol
            if (symbol.endsWith('.IS') || symbol.includes('BIST')) {
                currency = 'TRY';
            }
        }
    } else {
        // Infer from symbol
        if (symbol.endsWith('.IS') || symbol.includes('XU')) {
            currency = 'TRY';
        }
        confidence -= 5;
    }

    // Get name (optional)
    const nameCol = mappings['name'];
    const name = resolvedData?.name || (nameCol ? String(row[nameCol] || '').trim() : undefined);

    // Get type (optional)
    let type: string | undefined = resolvedData?.type;
    if (!type) {
        const typeCol = mappings['type'];
        if (typeCol && row[typeCol]) {
            const t = String(row[typeCol]).toUpperCase();
            if (t.includes('CRYPTO') || t.includes('BTC') || t.includes('ETH')) type = 'CRYPTO';
            else if (t.includes('FUND') || t.includes('ETF')) type = 'FUND';
            else if (t.includes('GOLD') || t.includes('ALTIN')) type = 'GOLD';
            else if (t.includes('BOND') || t.includes('TAHVIL')) type = 'BOND';
            else if (t.includes('CASH') || t.includes('NAKIT')) type = 'CASH';
            else type = 'STOCK';
        }
    }

    // Get platform (optional)
    const platformCol = mappings['platform'];
    const platform = platformCol ? String(row[platformCol] || '').trim() || undefined : undefined;

    // Get ISIN if available
    const isin = isinCol ? String(row[isinCol] || '').trim() || undefined : undefined;

    return {
        symbol,
        name: name || undefined,
        quantity,
        buyPrice,
        currency,
        type,
        platform,
        isin,
        rawRow: row,
        confidence: Math.max(0, confidence),
        warnings
    };
}

/**
 * Parse CSV content
 */
export function parseCSV(content: string): ParseResult {
    const errors: string[] = [];

    const parseResult = Papa.parse(content, {
        header: true,
        skipEmptyLines: 'greedy', // Handle lines with only delimiters
        transformHeader: uniqueHeaders, // Ensure unique headers for empty columns
    });

    if (parseResult.errors.length > 0) {
        errors.push(...parseResult.errors.map(e => `Row ${e.row}: ${e.message}`));
    }

    const data = parseResult.data as Record<string, any>[];
    if (data.length === 0) {
        return {
            success: false,
            rows: [],
            transactions: [],
            detectedColumns: {},
            unmappedColumns: [],
            errors: ['No data found in file'],
            totalRows: 0,
            skippedRows: 0
        };
    }

    // Detect columns from first row
    const columns = Object.keys(data[0]);
    const isDeGiro = isDeGiroFormat(columns);
    const isDeGiroStatement = isDeGiroAccountStatementFormat(columns);
    const mappings = detectColumnMappings(columns, isDeGiro || isDeGiroStatement);

    // DEGIRO Handlers
    if (isDeGiro || isDeGiroStatement) {
        if (isDeGiroStatement) {
            const { rows, transactions, processedCount, closedPositionCount } = parseDeGiroAccountStatement(data, mappings, columns);
            return {
                success: true,
                rows,
                transactions,
                closedPositionCount,
                detectedColumns: mappings,
                unmappedColumns: [],
                errors,
                totalRows: data.length,
                skippedRows: data.length - processedCount,
                detectedFormat: 'degiro' // Same UI treatment
            };
        }

        if (!mappings['isin']) {
            return {
                success: false,
                rows: [],
                transactions: [],
                detectedColumns: mappings,
                unmappedColumns: columns.filter(c => !Object.values(mappings).includes(c)),
                errors: ['Could not detect ISIN column in DeGiro export.'],
                totalRows: data.length,
                skippedRows: data.length,
                detectedFormat: 'degiro'
            };
        }

        // Parse and aggregate DeGiro transactions
        const { rows, transactions, processedCount, closedPositionCount } = parseDeGiroTransactions(data, mappings);

        return {
            success: true,
            rows,
            transactions,
            closedPositionCount,
            detectedColumns: mappings,
            unmappedColumns: columns.filter(c => !Object.values(mappings).includes(c)),
            errors,
            totalRows: data.length,
            skippedRows: data.length - processedCount,
            detectedFormat: 'degiro'
        };
    }

    // Generic Format
    // Check required mappings
    if (!mappings['symbol'] && !mappings['isin']) {
        return {
            success: false,
            rows: [],
            transactions: [],
            detectedColumns: mappings,
            unmappedColumns: columns.filter(c => !Object.values(mappings).includes(c)),
            errors: ['Could not detect symbol or ISIN column. Please ensure your file has a column for ticker symbols or ISINs.'],
            totalRows: data.length,
            skippedRows: data.length,
            detectedFormat: 'generic'
        };
    }

    // Parse rows (generic format)
    const rows: ParsedRow[] = [];
    let skippedRows = 0;

    for (let i = 0; i < data.length; i++) {
        const parsed = parseRow(data[i], mappings, i);
        if (parsed) {
            rows.push(parsed);
        } else {
            skippedRows++;
        }
    }

    return {
        success: true,
        rows,
        transactions: [], // Generic format doesn't support transaction history yet
        detectedColumns: mappings,
        unmappedColumns: columns.filter(c => !Object.values(mappings).includes(c)),
        errors,
        totalRows: data.length,
        skippedRows,
        detectedFormat: 'generic'
    };
}


/**
 * Parse Excel content (ArrayBuffer)
 */
export function parseExcel(buffer: ArrayBuffer): ParseResult {
    try {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];

        // Convert to CSV and use CSV parser
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        return parseCSV(csv);
    } catch (error) {
        return {
            success: false,
            rows: [],
            transactions: [],
            detectedColumns: {},
            unmappedColumns: [],
            errors: [`Failed to parse Excel file: ${error}`],
            totalRows: 0,
            skippedRows: 0
        };
    }
}

/**
 * Detect file type and parse accordingly
 */
export async function parseFile(file: File): Promise<ParseResult> {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'csv' || extension === 'txt') {
        const content = await file.text();
        return parseCSV(content);
    } else if (extension === 'xlsx' || extension === 'xls') {
        const buffer = await file.arrayBuffer();
        return parseExcel(buffer);
    } else {
        return {
            success: false,
            rows: [],
            transactions: [],
            detectedColumns: {},
            unmappedColumns: [],
            errors: [`Unsupported file type: .${extension}. Please use CSV or Excel files.`],
            totalRows: 0,
            skippedRows: 0
        };
    }
}
