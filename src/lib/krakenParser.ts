/**
 * Kraken CSV Parser
 * Handles: trades (paired rows), deposits, withdrawals, staking rewards
 * Ignores: auto-allocation (internal wallet transfers)
 */

import { ParsedRow, ParsedTransaction } from './importParser';
import { CRYPTO_ASSET_NAMES } from '@/lib/cryptoNames';

// Unified threshold for quantity comparisons (positions with qty <= this are considered closed)
const QUANTITY_THRESHOLD = 0.000001;


function parseEuropeanNumber(value: string | number | undefined | null): number {
    if (value === undefined || value === null || value === '') return 0;
    const str = String(value).trim();
    if (str === '') return 0;

    let cleaned = str.replace(/^[\"']|[\"']$/g, '');
    const hasComma = cleaned.includes(',');

    if (hasComma) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
        cleaned = cleaned.replace(/,/g, '');
    }

    cleaned = cleaned.replace(/[^\d.\-eE]/g, '');
    const result = parseFloat(cleaned);
    return isNaN(result) ? 0 : result;
}

function parseDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
}

function normalizeKrakenTicker(ticker: string): string {
    // 1. Handle Legacy ISO 4217 codes (X for crypto, Z for fiat)
    if (ticker === 'XXBT' || ticker === 'XBT') return 'BTC';
    if (ticker === 'XETH') return 'ETH';
    if (ticker === 'XXRP') return 'XRP';
    if (ticker === 'XLTC') return 'LTC';
    if (ticker === 'XXLM') return 'XLM';
    if (ticker === 'XXDG') return 'DOGE'; // Doge legacy
    if (ticker === 'ZEUR') return 'EUR';
    if (ticker === 'ZUSD') return 'USD';
    if (ticker === 'ZGBP') return 'GBP';
    if (ticker === 'ZJPY') return 'JPY';
    if (ticker === 'ZCAD') return 'CAD';

    // 2. Handle Staking/Earn prefixes and suffixes
    // Kraken uses .S (Staking), .M (Margin?), 2 (ETH2)
    // Remove .S, .M suffixes
    let clean = ticker;
    if (clean.endsWith('.S')) clean = clean.slice(0, -2);
    else if (clean.endsWith('.M')) clean = clean.slice(0, -2);

    // Handle ETH2 -> ETH
    if (clean === 'ETH2') return 'ETH';

    return clean;
}

export function parseKrakenTransactions(data: Record<string, any>[]): { rows: ParsedRow[], transactions: ParsedTransaction[], processedCount: number, closedPositionCount: number } {
    const transactions: ParsedTransaction[] = [];
    let processedCount = 0;

    // Track final balances per asset (use LAST transaction's balance)
    const assetBalances: Record<string, {
        balance: number;
        lastTransactionDate: Date;
        avgBuyPrice: number;
        totalBuyCost: number;
        totalBoughtQty: number;
    }> = {};

    // Track trade pairs by refid
    const tradesByRefId: Record<string, any[]> = {};

    // First pass: group trades by refid
    for (const row of data) {
        const type = String(row['type'] || '').trim().toLowerCase();
        const subtype = String(row['subtype'] || '').trim().toLowerCase();
        const refid = String(row['refid'] || '').trim();

        if (type === 'trade' && subtype === 'tradespot' && refid) {
            if (!tradesByRefId[refid]) {
                tradesByRefId[refid] = [];
            }
            tradesByRefId[refid].push(row);
        }
    }

    // Second pass: process all transactions and track balances
    for (const row of data) {
        const txid = String(row['txid'] || '').trim();
        const refid = String(row['refid'] || '').trim();
        const timeStr = String(row['time'] || '');
        const type = String(row['type'] || '').trim().toLowerCase();
        const subtype = String(row['subtype'] || '').trim().toLowerCase();

        const assetRaw = String(row['asset'] || '').trim().toUpperCase();
        const asset = normalizeKrakenTicker(assetRaw);

        const amount = parseEuropeanNumber(row['amount']);
        const fee = parseEuropeanNumber(row['fee']);
        const balance = parseEuropeanNumber(row['balance']); // ✅ USE BALANCE COLUMN

        const date = parseDate(timeStr);

        // Skip empty rows
        if (!txid || !asset) continue;

        // Update balance tracking (always use latest balance for each asset)
        if (!assetBalances[asset]) {
            assetBalances[asset] = {
                balance: 0,
                lastTransactionDate: new Date(0),
                avgBuyPrice: 0,
                totalBuyCost: 0,
                totalBoughtQty: 0
            };
        }

        // Update to latest balance if this transaction is newer
        if (date >= assetBalances[asset].lastTransactionDate) {
            const oldBalance = assetBalances[asset].balance;
            assetBalances[asset].balance = balance;
            assetBalances[asset].lastTransactionDate = date;
            if (asset === 'XRP' || asset === 'EUR' || asset === 'BTC' || asset === 'ETH') {
                console.log(`[Kraken] ${asset} balance update: ${oldBalance} -> ${balance} (date: ${date.toISOString()})`);
            }
        }

        // FILTER: Skip low value Fiat transactions (< 1 EUR)
        const isFiat = asset === 'EUR' || asset === 'USD' || asset === 'TRY' || asset === 'GBP';

        if (type !== 'trade' && isFiat && Math.abs(amount) < 1.0) continue;

        // 1. DEPOSITS
        if (type === 'deposit') {
            processedCount++;
            transactions.push({
                symbol: asset,
                name: 'Deposit-Withdrawal',
                type: 'DEPOSIT',
                quantity: Math.abs(amount),
                price: 1,
                currency: asset,
                date,
                originalDateStr: timeStr,
                platform: 'Kraken',
                externalId: txid,
                fee: 0
            });
            continue;
        }

        // 2. WITHDRAWALS
        if (type === 'withdrawal') {
            processedCount++;
            transactions.push({
                symbol: asset,
                name: 'Deposit-Withdrawal',
                type: 'WITHDRAWAL',
                quantity: Math.abs(amount),
                price: 1,
                currency: asset,
                date,
                originalDateStr: timeStr,
                platform: 'Kraken',
                externalId: txid,
                fee: Math.abs(fee)
            });
            continue;
        }

        // 3. TRADES (Paired rows)
        if (type === 'trade' && subtype === 'tradespot') {
            const tradePair = tradesByRefId[refid];
            if (!tradePair || tradePair.length !== 2) continue;

            const eurRow = tradePair.find(r => String(r['asset']).toUpperCase() === 'EUR');
            const cryptoRow = tradePair.find(r => String(r['asset']).toUpperCase() !== 'EUR');

            if (!eurRow || !cryptoRow) continue;
            if (row !== cryptoRow) continue; // Only process once

            const eurAmount = parseEuropeanNumber(eurRow['amount']);
            const cryptoAmount = parseEuropeanNumber(cryptoRow['amount']);

            // Check Trade Value (EUR Amount) against threshold
            if (Math.abs(eurAmount) < 1.0) continue;

            processedCount++;

            const cryptoFee = parseEuropeanNumber(cryptoRow['fee']);
            const cryptoAsset = String(cryptoRow['asset']).toUpperCase();
            // Use full crypto name (e.g., "Bitcoin" instead of "BTC")
            const cryptoName = CRYPTO_ASSET_NAMES[cryptoAsset] || cryptoAsset;

            const isBuy = cryptoAmount > 0;
            const quantity = Math.abs(cryptoAmount);
            const totalCost = Math.abs(eurAmount);
            const price = quantity > 0 ? totalCost / quantity : 0;

            transactions.push({
                symbol: cryptoAsset,
                name: cryptoName,
                type: isBuy ? 'BUY' : 'SELL',
                quantity,
                price,
                currency: 'EUR',
                date,
                originalDateStr: timeStr,
                platform: 'Kraken',
                externalId: refid,
                fee: Math.abs(cryptoFee)
            });

            // Track buy price for average calculation
            if (isBuy) {
                assetBalances[cryptoAsset].totalBuyCost += totalCost;
                assetBalances[cryptoAsset].totalBoughtQty += quantity;
                assetBalances[cryptoAsset].avgBuyPrice =
                    assetBalances[cryptoAsset].totalBoughtQty > 0
                        ? assetBalances[cryptoAsset].totalBuyCost / assetBalances[cryptoAsset].totalBoughtQty
                        : 0;
            }
            continue;
        }

        // 4. STAKING REWARDS
        if (type === 'earn' && subtype === 'reward') {
            processedCount++;
            // Use full crypto name (e.g., "Bitcoin" instead of "BTC")
            const assetName = CRYPTO_ASSET_NAMES[asset] || asset;
            transactions.push({
                symbol: asset,
                name: assetName,
                type: 'STAKING', // Changed from DIVIDEND to STAKING
                quantity: Math.abs(amount),
                price: 0,
                currency: asset,
                date,
                originalDateStr: timeStr,
                platform: 'Kraken',
                externalId: txid,
                fee: Math.abs(fee)
            });
            continue;
        }

        // 5. IGNORE: Auto-allocation, allocation, deallocation (internal transfers)
        if (type === 'earn' && (subtype === 'autoallocation' || subtype === 'allocation' || subtype === 'deallocation')) {
            continue;
        }
    }

    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Clean up small fiat balances (< €10) before aggregation
    for (const [asset, data] of Object.entries(assetBalances)) {
        const isFiat = asset === 'EUR' || asset === 'USD' || asset === 'TRY' || asset === 'GBP';
        if (isFiat && Math.abs(data.balance) > 0 && Math.abs(data.balance) < 10) {
            // Add cleanup transaction
            transactions.push({
                symbol: asset,
                name: `Clean-up (${asset})`,
                type: 'WITHDRAWAL',
                quantity: Math.abs(data.balance),
                price: 1,
                currency: asset,
                date: data.lastTransactionDate,
                originalDateStr: data.lastTransactionDate.toISOString(),
                platform: 'Kraken',
                externalId: `CLEANUP-${asset}`,
                fee: 0
            });
            // Zero out the balance
            assetBalances[asset].balance = 0;
        }
    }

    // Re-sort after adding cleanup transactions
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Aggregate to rows using BALANCE column (not manual calculation)
    const rows: ParsedRow[] = [];
    let closedPositionCount = 0;

    for (const [asset, data] of Object.entries(assetBalances)) {
        // Determine if it is Fiat
        const isFiat = asset === 'EUR' || asset === 'USD' || asset === 'TRY' || asset === 'GBP';

        let netQuantity = data.balance; // ✅ USE KRAKEN'S BALANCE
        const avgBuyPrice = data.avgBuyPrice;

        // Calculate estimated value in EUR
        let estimatedValueEUR = 0;
        if (asset === 'EUR') {
            estimatedValueEUR = netQuantity;
        } else if (asset === 'USD') {
            estimatedValueEUR = netQuantity * 0.92;
        } else if (asset === 'TRY') {
            estimatedValueEUR = netQuantity * 0.027;
        } else {
            estimatedValueEUR = netQuantity * avgBuyPrice;
        }

        // Asset type
        let type = isFiat ? 'CASH' : 'CRYPTO';

        // DUST HANDLING:
        // - Crypto: If value < €5, mark as closed and zero out.
        // - Fiat: If value < €0.01, mark as closed (ignore).
        let isDust = false;

        if (type === 'CRYPTO') {
            isDust = Math.abs(estimatedValueEUR) < 5;
        } else {
            isDust = Math.abs(estimatedValueEUR) < 0.01;
        }

        let isClosed = netQuantity <= QUANTITY_THRESHOLD || isDust;

        if (isDust && netQuantity > 0) {
            netQuantity = 0;
        }

        if (isClosed) closedPositionCount++;

        // Map symbols to full names
        const names: Record<string, string> = {
            // Fiat
            'EUR': 'Euro',
            'USD': 'US Dollar',
            'TRY': 'Turkish Lira',
            'GBP': 'British Pound',
            // Crypto (Imported from shared source)
            ...CRYPTO_ASSET_NAMES
        };

        let outputName = names[asset] || asset;
        let outputSymbol = asset;

        // Custom Display for Fiat/Cash
        if (isFiat) {
            outputName = 'Deposit-Withdrawal';
            // Symbol must remain unique (EUR, USD) for persistence
            // Display 'Cash | Kraken' will be handled in UI
        }

        rows.push({
            symbol: asset, // Keep original symbol unique!
            name: outputName,
            quantity: netQuantity,
            buyPrice: avgBuyPrice,
            currency: 'EUR',
            type,
            exchange: isFiat ? undefined : 'CCC',
            category: isFiat ? 'CASH' : 'CRYPTO',
            country: isFiat ? 'Europe' : 'Crypto',
            sector: isFiat ? 'Cash' : 'Crypto',
            platform: 'Kraken',
            rawRow: { asset, finalBalance: data.balance },
            confidence: 100,
            warnings: isDust && netQuantity === 0 ? ['Dust balance zeroed out'] : []
        });
    }

    // Post-process: Consolidate Rewards by Month
    const consolidatedTransactions = consolidateRewards(transactions);

    return { rows, transactions: consolidatedTransactions, processedCount, closedPositionCount };
}

/**
 * Helper to group tiny staking rewards into monthly aggregates
 */
function consolidateRewards(transactions: ParsedTransaction[]): ParsedTransaction[] {
    const rewards = transactions.filter(t => t.type === 'STAKING');
    const others = transactions.filter(t => t.type !== 'STAKING');

    if (rewards.length === 0) return transactions;

    const groups: Record<string, ParsedTransaction[]> = {};

    for (const tx of rewards) {
        // Key: SYMBOL-YEAR-MONTH (e.g. DOT-2024-5)
        const key = `${tx.symbol}-${tx.date.getFullYear()}-${tx.date.getMonth()}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(tx);
    }

    const aggregatedRewards: ParsedTransaction[] = [];

    for (const group of Object.values(groups)) {
        // If only 1 transaction, keep it as is
        if (group.length === 1) {
            aggregatedRewards.push(group[0]);
            continue;
        }

        // Aggregate
        const totalQty = group.reduce((sum, t) => sum + t.quantity, 0);
        const totalFee = group.reduce((sum, t) => sum + t.fee, 0);

        // Use the date of the LAST reward in the month
        const lastTx = group[group.length - 1];

        aggregatedRewards.push({
            ...lastTx,
            quantity: totalQty,
            fee: totalFee,
            name: lastTx.name, // Use the full name from the last transaction (e.g., "Bitcoin" not "BTC")
            externalId: `AGG-${lastTx.symbol}-${lastTx.date.getFullYear()}-${lastTx.date.getMonth()}`, // Unique ID
        });
    }

    // Merge and re-sort
    return [...others, ...aggregatedRewards].sort((a, b) => a.date.getTime() - b.date.getTime());
}
