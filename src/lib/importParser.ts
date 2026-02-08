/**
 * Smart Import Parser
 *
 * STRUCTURAL DESIGN PRINCIPLE:
 * ============================
 * This parser does ONE thing: Extract raw data from CSV files.
 * It does NOT resolve ISINs to symbols - that's the job of import.ts
 *
 * Data Flow:
 * 1. Parser extracts: { isin, productName, quantity, price, ... }
 * 2. Parser outputs symbol = ISIN (as identifier, not ticker)
 * 3. import.ts resolves ISIN → ticker via Yahoo API
 * 4. import.ts validates Yahoo result against productName
 *
 * This ensures 100% correct imports because:
 * - No hardcoded mappings that can become stale or wrong
 * - Yahoo API is the single source of truth for ticker symbols
 * - Product name from CSV validates the Yahoo result
 */

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { parseKrakenTransactions } from './krakenParser';
import { parseIsBankTXT, detectIsBank, detectIsBankPreciousMetals, parseIsBankPreciousMetals } from './isBankParser';

// Unified threshold for quantity comparisons (positions with qty <= this are considered closed)
const QUANTITY_THRESHOLD = 0.000001;


// Known column name variations for fuzzy matching
const COLUMN_ALIASES: Record<string, string[]> = {
    symbol: ['symbol', 'ticker', 'code', 'sembol', 'kod', 'hisse', 'stock', 'asset'],
    isin: ['isin'],
    name: ['name', 'company', 'şirket', 'isim', 'ad', 'firma', 'description', 'product'],
    quantity: ['quantity', 'qty', 'amount', 'adet', 'miktar', 'lot', 'shares', 'units'],
    buyPrice: ['buyprice', 'buy_price', 'cost', 'price', 'fiyat', 'maliyet', 'alış', 'alis', 'avg_cost', 'average'],
    currency: ['currency', 'cur', 'para birimi', 'doviz', 'döviz', 'ccy'],
    type: ['type', 'asset_type', 'category', 'tip', 'tür', 'tur', 'kategori'],
    platform: ['platform', 'broker', 'exchange', 'borsa', 'aracı kurum', 'araci'],
    localValue: ['local value', 'localvalue', 'value', 'total', 'wert', 'betrag', 'gesamtwert', 'tutar'],
    valueEur: ['value eur', 'valueeur', 'total eur', 'totaleur'],
    date: ['date', 'tarih', 'transaction date', 'time'],
    description: ['description', 'omschrijving', 'beschreibung'],
    change: ['change', 'mutatie', 'veraenderung', 'veränderung'],
    balance: ['balance', 'saldo', 'bestand'],
    orderid: ['orderid', 'order id', 'order-id', 'auftragsnummer'],
    // Kraken-specific
    txid: ['txid', 'transaction id', 'tx id'],
    refid: ['refid', 'reference id', 'ref id'],
    wallet: ['wallet'],
    subtype: ['subtype', 'sub type'],
    fee: ['fee', 'fees', 'commission'],
};

export interface ParsedTransaction {
    symbol: string;      // ISIN or raw identifier (NOT resolved ticker)
    name?: string;       // Product name from CSV (used for validation in import.ts)
    type: TransactionType;
    quantity: number;
    price: number;       // Unit price per item (0 if unknown)
    currency: string;
    date: Date;
    originalDateStr?: string;
    exchange?: string;
    platform: string;
    externalId?: string;
    fee: number;
    isin?: string;       // ISIN for resolution in import.ts
    needsCostInput?: boolean;  // True if this BUY transaction needs manual cost input
    totalCost?: number;        // Total cost for this transaction (for avg calculation)
    // Price validation (populated after Yahoo comparison)
    priceValidation?: {
        yahooPrice: number;      // Price from Yahoo Finance for this date
        deviation: number;       // Percentage deviation (positive = parsed higher, negative = parsed lower)
        isWarning: boolean;      // True if deviation > 15%
        isCritical: boolean;     // True if deviation > 30%
    };
}

export type TransactionType = 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAWAL' | 'DIVIDEND' | 'COUPON' | 'INTEREST' | 'FEE' | 'FX' | 'STAKING';

export interface ParsedRow {
    symbol: string;      // ISIN or raw identifier (NOT resolved ticker)
    name?: string;       // Product name from CSV (used for validation in import.ts)
    quantity: number;
    buyPrice: number;
    currency: string;
    type?: string;
    platform?: string;
    isin?: string;       // ISIN for resolution in import.ts
    exchange?: string;   // Exchange from CSV
    category?: string;   // Added
    country?: string;    // Added
    sector?: string;     // Added
    rawRow: Record<string, any>;
    confidence: number;  // 0-100 how confident we are about this row
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
    detectedFormat?: 'generic' | 'degiro' | 'ibkr' | 'isbank';
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

    const hasDescription = findBestMatch(normalized, 'description');
    const hasChange = findBestMatch(normalized, 'change');
    const hasBalance = findBestMatch(normalized, 'balance');
    const hasOrderId = findBestMatch(normalized, 'orderid');

    return !!(hasDescription && hasChange && hasBalance && hasOrderId);
}

/**
 * Detect if this is a Kraken transaction export
 */
function isKrakenFormat(columns: string[]): boolean {
    const normalized = columns.map(c => normalize(c));
    return normalized.includes('txid') &&
        normalized.includes('refid') &&
        normalized.includes('wallet') &&
        normalized.includes('subtype');
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
 *
 * STRUCTURAL: Parser outputs ISIN as symbol. Resolution happens in import.ts
 */
function parseDeGiroTransactions(data: Record<string, any>[], mappings: Record<string, string>): { rows: ParsedRow[], transactions: ParsedTransaction[], processedCount: number, closedPositionCount: number } {
    // Group transactions by ISIN for Asset Snapshot
    const transactionsByIsin: Record<string, {
        isin: string;
        name: string;
        buys: { quantity: number; price: number; value: number }[];
        sells: { quantity: number; price: number; value: number }[];
        currency: string;
        exchange: string;
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

    const columns = Object.keys(data[0] || {});

    // Track external IDs to handle duplicates (partial fills sharing same Order ID)
    const externalIdCounts = new Map<string, number>();

    for (const row of data) {
        const isin = isinCol ? String(row[isinCol] || '').trim() : '';
        if (!isin || isin.length < 5) continue; // Skip invalid ISINs

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
                const val = String(row[col] || '').trim();
                if (val && val.length > 5) {
                    externalId = val;
                    break;
                }
            }
        }

        // Make external ID unique for partial fills
        if (externalId) {
            const count = externalIdCounts.get(externalId) || 0;
            externalIdCounts.set(externalId, count + 1);
            if (count > 0) {
                externalId = `${externalId}-${count}`;
            }
        }

        // For crypto (empty quantity), calculate from value / price
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
        // DeGiro: Negative localValue = BUY (money out), Positive = SELL (money in)
        const isSell = localValue > 0 || quantity < 0;
        quantity = Math.abs(quantity);

        // DeGiro special case: Bonds/Certificates (ISIN starting with XS) are reported in nominal value
        if (isin && isin.startsWith('XS')) {
            quantity = quantity / 100;
        }

        if (quantity === 0) continue;

        // Detect currency from the row
        let currency = 'EUR'; // Default for DeGiro
        for (const col of columns) {
            const val = String(row[col] || '').trim().toUpperCase();
            if (val === 'USD' || val === 'EUR' || val === 'TRY') {
                currency = val;
                break;
            }
        }

        // Find exchange/venue
        // Priority: "Reference Exchange" > any column with "exchange" > "Venue"
        let exchange = '';
        let venueValue = '';
        for (const col of columns) {
            const normal = normalize(col);
            // Prefer "Reference Exchange" column specifically
            if (normal === 'referenceexchange') {
                const val = String(row[col] || '').trim();
                if (val) {
                    exchange = val;
                    break; // Found the best source, stop looking
                }
            }
            // Track venue as fallback
            else if (normal === 'venue') {
                venueValue = String(row[col] || '').trim();
            }
            // Other exchange columns
            else if (normal.includes('exchange')) {
                const val = String(row[col] || '').trim();
                if (val && !exchange) exchange = val;
            }
        }
        // Use venue as fallback if no exchange found
        if (!exchange && venueValue) {
            exchange = venueValue;
        }

        // STRUCTURAL: Use ISIN as symbol - resolution happens in import.ts
        transactions.push({
            symbol: isin,  // ISIN as identifier
            name: name,    // Product name for validation
            type: isSell ? 'SELL' : 'BUY',
            quantity,
            price,
            currency,
            date,
            originalDateStr: dateStr,
            exchange,
            platform: 'DeGiro',
            externalId,
            fee: 0,
            isin: isin     // Also store ISIN explicitly
        });

        // Add to Aggregation for Asset Snapshot
        if (!transactionsByIsin[isin]) {
            transactionsByIsin[isin] = {
                isin,
                name: name || isin,
                buys: [],
                sells: [],
                currency,
                exchange
            };
        } else if (exchange && !transactionsByIsin[isin].exchange) {
            // Update exchange if we find it later
            transactionsByIsin[isin].exchange = exchange;
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
        const totalBought = data.buys.reduce((sum, t) => sum + t.quantity, 0);
        const totalSold = data.sells.reduce((sum, t) => sum + t.quantity, 0);
        const netQuantity = totalBought - totalSold;

        const isClosed = netQuantity <= QUANTITY_THRESHOLD;

        if (isClosed) {
            closedPositionCount++;
        }

        const totalBuyCost = data.buys.reduce((sum, t) => sum + (t.quantity * t.price), 0);
        const avgBuyPrice = totalBought > 0 ? totalBuyCost / totalBought : 0;

        // STRUCTURAL: Use ISIN as symbol - resolution happens in import.ts
        const type = inferTypeFromName(data.name);

        const warnings: string[] = [];
        // Lower confidence since symbol needs resolution
        let confidence = 80;

        if (totalSold > 0) {
            warnings.push(`Calculated from history: ${totalBought.toFixed(4)} bought, ${totalSold.toFixed(4)} sold`);
        }

        rows.push({
            symbol: isin,      // ISIN as identifier
            name: data.name,   // Product name for validation
            quantity: netQuantity,
            buyPrice: avgBuyPrice,
            currency: data.currency,
            type,
            platform: 'DeGiro',
            isin,              // Explicit ISIN for resolution
            exchange: data.exchange || undefined, // Exchange from CSV (Reference Exchange)
            rawRow: { isin, transactions: data.buys.length + data.sells.length },
            confidence,
            warnings
        });
    }

    return { rows, transactions, processedCount, closedPositionCount };
}

/**
 * Parse DeGiro Account Statement (Cash Report)
 *
 * STRUCTURAL: Parser outputs ISIN as symbol. Resolution happens in import.ts
 */
function parseDeGiroAccountStatement(data: Record<string, any>[], mappings: Record<string, string>, columns: string[]): { rows: ParsedRow[], transactions: ParsedTransaction[], processedCount: number, closedPositionCount: number } {
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
    const descCol = mappings['description'] || findBestMatch(keys, 'description');
    const orderIdCol = mappings['orderid'] || findBestMatch(keys, 'orderid');
    const productCol = mappings['product'] || findBestMatch(keys, 'product') || mappings['name'];
    const dateCol = mappings['date'] || findBestMatch(keys, 'date');
    const changeColKey = mappings['change'] || findBestMatch(keys, 'change');

    // Regex for parsing Description
    const tradeRegex = /(Koop|Buy|Verkauf|Kauf|Verkoop|Sell)\s+([\d.,]+)\s+(@|at)\s+([\d.,]+)\s+([A-Z]{3})/i;
    const dividendRegex = /(Dividend|Coupon|Kupon|Temettü)/i;
    const interestRegex = /(Rente|Interest)/i;
    const feeRegex = /(Transactiekosten|Aansluitingskosten|Kosten|Fee|Tax|Belasting)/i;
    const depositRegex = /(Deposit|Storting|Einzahlung)/i;
    const withdrawalRegex = /(Withdrawal|Terugstorting|Auszahlung)/i;
    const transferRegex = /(Overboeking|Transfer|Überweisung)/i;
    const fxRegex = /(Valuta|FX)/i;
    const reservationRegex = /(Reservation|Reservering)/i;

    for (const row of data) {
        const isin = isinCol ? String(row[isinCol] || '').trim() : '';
        const description = descCol ? String(row[descCol] || '').trim() : '';
        const dateStr = dateCol ? String(row[dateCol] || '') : '';
        const date = parseDate(dateStr);
        const orderId = orderIdCol ? String(row[orderIdCol] || '').trim() : '';
        const product = productCol ? String(row[productCol] || '').trim() : '';

        // Value/Amount parsing
        let changeAmount = 0;
        let changeCurrency = 'EUR';

        if (changeColKey) {
            const val = row[changeColKey];
            const isCurrency = val && (val === 'EUR' || val === 'USD' || val === 'TRY' || val.length === 3);

            if (isCurrency) {
                changeCurrency = val;
                const idx = keys.indexOf(changeColKey);
                if (idx !== -1 && idx + 1 < keys.length) {
                    const amtKey = keys[idx + 1];
                    changeAmount = parseEuropeanNumber(row[amtKey]);
                }
            } else {
                changeAmount = parseEuropeanNumber(val);
            }
        }

        // Skip Reservations / Cash Sweep
        if (reservationRegex.test(description)) continue;
        if (description.includes('Degiro Cash Sweep')) continue;

        // 1. TRADES (Buy/Sell)
        const tradeMatch = description.match(tradeRegex);
        if (tradeMatch && isin) {
            processedCount++;
            const actionStr = tradeMatch[1].toLowerCase();
            const isSell = actionStr.startsWith('v') || actionStr.startsWith('s');

            const quantity = parseEuropeanNumber(tradeMatch[2]);
            const price = parseEuropeanNumber(tradeMatch[4]);
            const currency = tradeMatch[5].toUpperCase();

            // STRUCTURAL: Use ISIN as symbol
            transactions.push({
                symbol: isin,
                name: product,
                type: isSell ? 'SELL' : 'BUY',
                quantity,
                price,
                currency,
                date,
                originalDateStr: dateStr,
                platform: 'DeGiro',
                externalId: orderId,
                fee: 0,
                isin: isin
            });

            // Add to Aggregation
            if (!transactionsByIsin[isin]) {
                transactionsByIsin[isin] = { isin, name: product, buys: [], sells: [], currency };
            }
            if (isSell) transactionsByIsin[isin].sells.push({ quantity, price, value: quantity * price });
            else transactionsByIsin[isin].buys.push({ quantity, price, value: quantity * price });

            continue;
        }

        // 2. FEES
        if (feeRegex.test(description)) {
            processedCount++;
            transactions.push({
                symbol: 'FEES',
                name: 'Trading Fees',
                type: 'FEE' as any,
                quantity: 0,
                price: changeAmount,
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
        if (dividendRegex.test(description)) {
            processedCount++;
            const isCoupon = /Coupon/i.test(description);

            // STRUCTURAL: Use ISIN as symbol
            const symbol = isin || 'UNKNOWN';
            const name = product || 'Unknown Asset';

            transactions.push({
                symbol,
                name,
                type: isCoupon ? 'COUPON' : 'DIVIDEND' as any,
                quantity: 0,
                price: Math.abs(changeAmount),
                currency: changeCurrency,
                date,
                originalDateStr: dateStr,
                platform: 'DeGiro',
                externalId: orderId || `DIV-${dateStr}-${Math.abs(changeAmount)}`,
                fee: 0,
                isin: isin || undefined
            });
            continue;
        }

        // Interest
        if (interestRegex.test(description)) {
            processedCount++;
            transactions.push({
                symbol: 'EUR',
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
                price: 1,
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

        // 5. FX
        if (fxRegex.test(description)) {
            transactions.push({
                symbol: isin || 'FX',
                name: 'FX Conversion',
                type: 'FX' as any,
                quantity: 0,
                price: changeAmount,
                currency: changeCurrency,
                date,
                originalDateStr: dateStr,
                platform: 'DeGiro',
                externalId: orderId,
                fee: 0,
                isin: isin || undefined
            });
            continue;
        }
    }

    // Sort transactions by date
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    const rows: ParsedRow[] = [];
    let closedPositionCount = 0;

    // Add Cash Position
    const cashTx = transactions.filter(t => t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL' || t.type === 'INTEREST');
    if (cashTx.length > 0) {
        const netCash = cashTx.reduce((sum, t) => {
            if (t.type === 'DEPOSIT') return sum + t.quantity;
            if (t.type === 'INTEREST') return sum + t.price;
            if (t.type === 'WITHDRAWAL') return sum - t.quantity;
            return sum;
        }, 0);

        if (Math.abs(netCash) > 0.01) {
            rows.push({
                symbol: 'EUR',
                name: 'Deposit & Withdrawal',
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

    // Trade Aggregation
    for (const [isin, data] of Object.entries(transactionsByIsin)) {
        const totalBought = data.buys.reduce((sum, t) => sum + t.quantity, 0);
        const totalSold = data.sells.reduce((sum, t) => sum + t.quantity, 0);
        const netQuantity = totalBought - totalSold;

        if (netQuantity <= QUANTITY_THRESHOLD) {
            closedPositionCount++;
            continue;
        }

        const totalBuyCost = data.buys.reduce((sum, t) => sum + (t.quantity * t.price), 0);
        const avgBuyPrice = totalBought > 0 ? totalBuyCost / totalBought : 0;

        const type = inferTypeFromName(data.name);

        let confidence = 80;
        const warnings: string[] = [];

        if (totalSold > 0) {
            warnings.push(`Calculated from history: ${totalBought.toFixed(4)} bought, ${totalSold.toFixed(4)} sold`);
        }

        // STRUCTURAL: Use ISIN as symbol
        rows.push({
            symbol: isin,
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
 *
 * STRUCTURAL: If ISIN present, use it as symbol. Resolution happens in import.ts
 */
function parseRow(
    row: Record<string, any>,
    mappings: Record<string, string>,
    rowIndex: number
): ParsedRow | null {
    const warnings: string[] = [];
    let confidence = 100;

    // Get ISIN if available
    const isinCol = mappings['isin'];
    const isin = isinCol ? String(row[isinCol] || '').trim() : undefined;

    // Get product name from CSV
    const nameCol = mappings['name'];
    const csvProductName = nameCol ? String(row[nameCol] || '').trim() : undefined;

    // STRUCTURAL: If ISIN present, use it as symbol
    // Symbol resolution will happen in import.ts via Yahoo API
    let symbol = '';

    if (isin && isin.length > 5) {
        symbol = isin;  // Use ISIN as symbol - will be resolved in import.ts
        confidence = 80; // Lower confidence since it needs resolution
    } else {
        // No ISIN - try symbol column
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
            if (symbol.endsWith('.IS') || symbol.includes('BIST')) {
                currency = 'TRY';
            }
        }
    } else {
        if (symbol.endsWith('.IS') || symbol.includes('XU')) {
            currency = 'TRY';
        }
        confidence -= 5;
    }

    // Get type (optional)
    let type: string | undefined;
    const typeCol = mappings['type'];
    if (typeCol && row[typeCol]) {
        const t = String(row[typeCol]).toUpperCase();
        if (t.includes('CRYPTO') || t.includes('BTC') || t.includes('ETH')) type = 'CRYPTO';
        else if (t.includes('FUND') || t.includes('ETF')) type = 'FUND';
        else if (t.includes('GOLD') || t.includes('ALTIN')) type = 'GOLD';
        else if (t.includes('BOND') || t.includes('TAHVIL')) type = 'BOND';
        else if (t.includes('CASH') || t.includes('NAKIT')) type = 'CASH';
        else type = 'STOCK';
    } else if (csvProductName) {
        type = inferTypeFromName(csvProductName);
    }

    // Get platform (optional)
    const platformCol = mappings['platform'];
    const platform = platformCol ? String(row[platformCol] || '').trim() || undefined : undefined;

    return {
        symbol,             // ISIN or ticker - will be resolved in import.ts
        name: csvProductName,  // Product name for validation
        quantity,
        buyPrice,
        currency,
        type,
        platform,
        isin,               // Explicit ISIN for resolution
        rawRow: row,
        confidence: Math.max(0, confidence),
        warnings
    };
}

/**
 * Parse CSV content
 */
export function parseCSV(content: string, platform?: string): ParseResult {
    // Check for İş Bank Precious Metals format FIRST (HESAP ÖZETI for XAU/XPT)
    const preciousMetalType = detectIsBankPreciousMetals(content);
    if (preciousMetalType) {
        const { rows, transactions, processedCount, closedPositionCount } = parseIsBankPreciousMetals(content, preciousMetalType);
        return {
            success: true,
            rows,
            transactions,
            closedPositionCount,
            detectedColumns: {},
            unmappedColumns: [],
            errors: [],
            totalRows: processedCount,
            skippedRows: 0,
            detectedFormat: 'isbank'
        };
    }

    // Check for İş Bank Investment Account TXT format (PORTFÖY/EKSTRE)
    const isIsBank = detectIsBank(content);

    if (isIsBank || platform?.toLowerCase().includes('is bank')) {
        const { rows, transactions, processedCount, closedPositionCount } = parseIsBankTXT(content);
        return {
            success: true,
            rows,
            transactions,
            closedPositionCount,
            detectedColumns: {},
            unmappedColumns: [],
            errors: [],
            totalRows: rows.length + transactions.length,
            skippedRows: 0,
            detectedFormat: 'isbank'
        };
    }

    const errors: string[] = [];

    const parseResult = Papa.parse(content, {
        header: true,
        skipEmptyLines: 'greedy',
        transformHeader: uniqueHeaders,
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

    // Determine which parser to use based on platform selection or auto-detection
    let useKraken = false;
    let useDeGiro = false;
    let useDeGiroStatement = false;

    if (platform) {
        // User-selected platform takes precedence
        const normalizedPlatform = platform.toLowerCase();

        if (normalizedPlatform.includes('kraken')) {
            useKraken = true;
        } else if (normalizedPlatform.includes('degiro')) {
            // For DeGiro, still need to distinguish between formats
            // Check columns to determine which DeGiro parser to use
            useDeGiroStatement = isDeGiroAccountStatementFormat(columns);
            useDeGiro = !useDeGiroStatement;
        }
    } else {
        // Fallback to auto-detection
        useKraken = isKrakenFormat(columns);
        useDeGiroStatement = isDeGiroAccountStatementFormat(columns);
        useDeGiro = isDeGiroFormat(columns);
    }

    const mappings = detectColumnMappings(columns, useDeGiro || useDeGiroStatement);

    // Kraken Handler
    if (useKraken) {
        const { rows, transactions, processedCount, closedPositionCount } = parseKrakenTransactions(data);
        return {
            success: true,
            rows,
            transactions,
            closedPositionCount,
            detectedColumns: { txid: 'txid', refid: 'refid', asset: 'asset', amount: 'amount' },
            unmappedColumns: [],
            errors,
            totalRows: data.length,
            skippedRows: data.length - processedCount,
            detectedFormat: 'generic'
        };
    }

    // DEGIRO Handlers
    if (useDeGiro || useDeGiroStatement) {
        if (useDeGiroStatement) {
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
                detectedFormat: 'degiro'
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
        transactions: [],
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
export function parseExcel(buffer: ArrayBuffer, platform?: string): ParseResult {
    try {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];

        const csv = XLSX.utils.sheet_to_csv(worksheet);
        return parseCSV(csv, platform);
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
 * Try to read file content with different encodings
 * Turkish bank files often use Windows-1254 encoding
 */
async function readFileWithEncoding(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();

    // First try UTF-8
    const utf8Content = new TextDecoder('utf-8').decode(buffer);

    // Check if this looks like a Turkish bank file with encoding issues
    // These are telltale signs of Windows-1254/ISO-8859-9 being read as UTF-8
    const hasTurkishMojibake = /[›‹˝ˆ¸˛÷ﬁﬂ«»È]/.test(utf8Content.slice(0, 2000));
    const looksLikeTurkishBank = /YATIRIM|PORTF|BANKASI|HESABI|EKSTRE/i.test(utf8Content.slice(0, 3000));

    // If it has Turkish mojibake, try Windows-1254 encoding
    if (hasTurkishMojibake && looksLikeTurkishBank) {
        try {
            // Try Windows-1254 (Turkish) encoding
            const win1254Content = new TextDecoder('windows-1254').decode(buffer);

            // Check if the Windows-1254 version has proper Turkish characters
            const hasProperTurkish = /[İıŞşĞğÜüÖöÇç]/.test(win1254Content.slice(0, 2000));

            if (hasProperTurkish) {
                console.log('[parseFile] Detected Windows-1254 encoded Turkish file, using proper encoding');
                return win1254Content;
            }
        } catch {
            // TextDecoder might not support windows-1254 in some environments
            console.warn('[parseFile] Windows-1254 decoder not available, using UTF-8 with character mapping');
        }
    }

    // Fall back to UTF-8 (character mapping in parser will handle mojibake)
    return utf8Content;
}

/**
 * Parse PDF file via server-side API
 * PDF parsing requires Node.js environment (pdf-parse uses pdfjs-dist worker)
 */
async function parsePDFViaAPI(file: File): Promise<ParseResult> {
    try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/parse-pdf', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            return {
                success: false,
                rows: [],
                transactions: [],
                detectedColumns: {},
                unmappedColumns: [],
                errors: [`PDF API hatası: ${response.statusText}`],
                totalRows: 0,
                skippedRows: 0
            };
        }

        return await response.json();
    } catch (error: any) {
        return {
            success: false,
            rows: [],
            transactions: [],
            detectedColumns: {},
            unmappedColumns: [],
            errors: [`PDF parse hatası: ${error.message}`],
            totalRows: 0,
            skippedRows: 0
        };
    }
}

/**
 * Detect file type and parse accordingly
 */
export async function parseFile(file: File, platform?: string): Promise<ParseResult> {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'csv' || extension === 'txt') {
        const content = await readFileWithEncoding(file);
        return parseCSV(content, platform);
    } else if (extension === 'xlsx' || extension === 'xls') {
        const buffer = await file.arrayBuffer();
        return parseExcel(buffer, platform);
    } else if (extension === 'pdf') {
        // PDF parsing requires server-side processing
        return parsePDFViaAPI(file);
    } else {
        return {
            success: false,
            rows: [],
            transactions: [],
            detectedColumns: {},
            unmappedColumns: [],
            errors: [`Unsupported file type: .${extension}. Please use CSV, Excel, or PDF files.`],
            totalRows: 0,
            skippedRows: 0
        };
    }
}

