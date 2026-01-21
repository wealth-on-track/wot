
import { describe, it, expect } from 'vitest';
import { parseCSV } from '../src/lib/importParser';

describe('DeGiro Account Statement Import', () => {
    it('should parse DeGiro Account Statement correctly', () => {
        const csvContent = `Datum,Tijd,Valutadatum,Product,ISIN,Omschrijving,FX,Mutatie,Saldo,Order Id
01-01-2023,10:00,01-01-2023,,,"Deposit",,1000.00,1000.00,
02-01-2023,14:30,02-01-2023,Apple Inc,US0378331005,"Koop 10 @ 150 USD",, -1400.00, -400.00, ord-1
03-01-2023,10:00,03-01-2023,,,"Dividend Tax",,-15.00,-415.00,
04-01-2023,12:00,04-01-2023,Apple Inc,US0378331005,"Dividend",, 100.00, -315.00,
05-01-2023,16:00,05-01-2023,Apple Inc,US0378331005,"Verkoop 5 @ 160 USD",, 750.00, 435.00, ord-2
06-01-2023,10:00,06-01-2023,,,"Transactiekosten",, -2.00, 433.00,
`;

        const result = parseCSV(csvContent);

        console.log('Success:', result.success);
        console.log('Detected Format:', result.detectedFormat);
        console.log('Rows (Snapshot) Count:', result.rows.length);
        result.rows.forEach(r => {
            console.log(` - ${r.symbol}: Qty=${r.quantity}, Price=${r.buyPrice}, Type=${r.type}`);
        });

        console.log('Transactions Count:', result.transactions.length);
        result.transactions.forEach(t => {
            console.log(` - ${t.date.toISOString().split('T')[0]} ${t.type} ${t.symbol} Qty=${t.quantity} Price=${t.price} Curr=${t.currency} Fee=${t.fee}`);
        });

        expect(result.success).toBe(true);
        expect(result.detectedFormat).toBe('degiro');

        // Check Trades
        const appleRow = result.rows.find(r => r.isin === 'US0378331005');
        expect(appleRow).toBeDefined();
        // Bought 10, Sold 5 -> Net 5
        expect(appleRow?.quantity).toBe(5);

        // Check Transactions
        const deposits = result.transactions.filter(t => t.type === 'DEPOSIT');
        expect(deposits.length).toBe(1);
        expect(deposits[0].quantity).toBe(1000);

        const dividends = result.transactions.filter(t => t.type === 'DIVIDEND');
        expect(dividends.length).toBe(1);
        expect(dividends[0].price).toBe(100);

        const fees = result.transactions.filter(t => t.type === 'FEE');
        // Transactiekosten + Dividend Tax = 2
        expect(fees.length).toBe(2);
        expect(fees.some(f => f.fee === 15)).toBe(true);
        expect(fees.some(f => f.fee === 2)).toBe(true);

        // Check if Cash is in rows?
        // This is what we want to verify. Currently it probably ISN'T.
        const cashRow = result.rows.find(r => r.type === 'CASH' || r.symbol === 'EUR');
        console.log('Cash Row:', cashRow);
    });
});
