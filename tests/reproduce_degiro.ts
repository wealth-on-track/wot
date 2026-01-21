
import { parseCSV } from '../src/lib/importParser';
import * as fs from 'fs';
import * as path from 'path';

const csvContent = `Datum,Tijd,Valutadatum,Product,ISIN,Omschrijving,FX,Mutatie,Saldo,Order Id
01-01-2023,10:00,01-01-2023,,,"Deposit",,1000.00,1000.00,
02-01-2023,14:30,02-01-2023,Apple Inc,US0378331005,"Koop 10 @ 150 USD",, -1400.00, -400.00, ord-1
03-01-2023,10:00,03-01-2023,,,"Dividend Tax",,-15.00,-415.00,
04-01-2023,12:00,04-01-2023,Apple Inc,US0378331005,"Dividend",, 100.00, -315.00,
05-01-2023,16:00,05-01-2023,Apple Inc,US0378331005,"Verkoop 5 @ 160 USD",, 750.00, 435.00, ord-2
06-01-2023,10:00,06-01-2023,,,"Transactiekosten",, -2.00, 433.00,
`;

// Note: 
// 1. "Koop 10 @ 150 USD" -> Cost 1500 USD. If EUR/USD is involved, "Mutatie" (Change) would be in EUR.
// Let's assume the account is in EUR.
// "Mutatie" for the buy is -1400.00 (approx 1500 USD).
// "Mutatie" for the sell is 750.00.

const result = parseCSV(csvContent);

console.log('Success:', result.success);
console.log('Detected Format:', result.detectedFormat);
console.log('Rows (Snapshot):', result.rows.length);
result.rows.forEach(r => {
    console.log(` - ${r.symbol}: Qty=${r.quantity}, Price=${r.buyPrice}, Type=${r.type}`);
});

console.log('Transactions:', result.transactions.length);
result.transactions.forEach(t => {
    console.log(` - ${t.date.toISOString().split('T')[0]} ${t.type} ${t.symbol} Qty=${t.quantity} Price=${t.price} Curr=${t.currency} Fee=${t.fee}`);
});
