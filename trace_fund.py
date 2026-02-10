import re

def parse_turkish_float(val_str):
    if not val_str: return 0.0
    clean_str = val_str.replace('.', '').replace(',', '.')
    return float(clean_str)

def trace_fund(filepath, target_codes):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex from analyze_funds.py
    pattern = re.compile(
        r'(\d{2}\.\d{2}\.\d{4})\s+(Fon Alışı|Fon Satışı)\s+(.*?) \(([A-Z0-9]+)\)\s*([\d\.,]+)(?:\s*Adet)?\s*([\d\.,]+)(?:\s*TL)?',
        re.DOTALL | re.MULTILINE
    )

    transactions = pattern.findall(content)
    
    # Sort transactions by date (DD.MM.YYYY)
    # But wait, date format is DD.MM.YYYY, standard string sort won't work.
    # We need to reverse date to YYYYMMDD for sorting.
    
    parsed_txs = []
    for date, tx_type, name_prefix, fund_code, qty_str, amount_str in transactions:
        if fund_code in target_codes:
            # Convert date to comparable format
            day, month, year = date.split('.')
            date_obj = f"{year}-{month}-{day}"
            
            qty = parse_turkish_float(qty_str)
            parsed_txs.append({
                'date': date_obj,
                'display_date': date,
                'type': tx_type,
                'code': fund_code,
                'qty': qty
            })

    # Sort by date ascending to trace balance
    parsed_txs.sort(key=lambda x: x['date'])

    balance = {code: 0.0 for code in target_codes}
    
    print(f"Transaction History for {', '.join(target_codes)}:\n")
    print(f"{'Date':<12} | {'Code':<5} | {'Type':<12} | {'Quantity':>12} | {'Balance':>12}")
    print("-" * 65)

    for tx in parsed_txs:
        sign = 1 if tx['type'] == 'Fon Alışı' else -1
        balance[tx['code']] += sign * tx['qty']
        
        print(f"{tx['display_date']:<12} | {tx['code']:<5} | {tx['type']:<12} | {tx['qty']:>12,.2f} | {balance[tx['code']]:>12,.2f}")

if __name__ == "__main__":
    trace_fund("fund_data.txt", ["BGL", "AEA"])
