import re

def parse_turkish_float(val_str):
    """
    Parses a string like '4.688,28' or '450,00' into a float.
    Removes thousands separator '.', replaces decimal separator ',' with '.'.
    """
    if not val_str:
        return 0.0
    clean_str = val_str.replace('.', '').replace(',', '.')
    return float(clean_str)

def analyze_funds(filepath):
    """
    Parses the fund data file and calculates holdings.
    """
    
    # Regex designed to capture:
    # 1. Date (DD.MM.YYYY)
    # 2. Type (Fon Alışı / Fon Satışı)
    # 3. Fund Name (everything up to the quantity)
    # 4. Quantity (number that might end with "Adet")
    # 5. Amount (number that might end with "TL")
    
    # The text is unstructured, so we iterate line by line looking for transaction patterns.
    # Common pattern in text: 
    # Date Type Fund Name QuantityAdet Amount TL ...
    
    # We will refine regex to be flexible.
    # Fund codes are usually in parentheses like (AET), (AH2).
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split into potential transaction chunks
    # Since newlines might be missing, we look for Date patterns to split or identify start of records.
    # But text seems to have some structure. Let's try to tokenizing by "Tamamlandı" which ends a transaction mostly?
    # Or just regex search for all occurrences.

    # Regex explanation:
    # (\d{2}\.\d{2}\.\d{4})        -> Date
    # \s+
    # (Fon Alışı|Fon Satışı)       -> Type
    # \s+
    # (.*?)\s+                     -> Fund Name (lazy match)
    # ([\d\.,]+)\s*Adet            -> Quantity (capture number before Adet)
    # \s*
    # ([\d\.,]+)\s*(?:TL)?         -> Amount (capture number before TL)
    
    # Robust Regex:
    # Enforces that the Fund Name ends with a Code in parentheses, e.g. "(AH2)".
    # This prevents the name capture from "eating" the quantity numbers.
    # Structure: Date, Type, NamePrefix, (Code), zero-or-more-space, Qty, [Adet], zero-or-more-space, Amt, [TL]
    
    # We use [\s\S]*? to match across lines if needed, but usually . matches everything except newline. 
    # With re.DOTALL, . matches newline.
    
    pattern = re.compile(
        r'(\d{2}\.\d{2}\.\d{4})\s+(Fon Alışı|Fon Satışı)\s+(.*?) \(([A-Z0-9]+)\)\s*([\d\.,]+)(?:\s*Adet)?\s*([\d\.,]+)(?:\s*TL)?',
        re.DOTALL | re.MULTILINE
    )

    transactions = pattern.findall(content)
    
    holdings = {} # {FundCode: {name, net_qty}}
    latest_prices = {} # {FundCode: price}

    print(f"Found {len(transactions)} transactions.")

    # Groups: 0:Date, 1:Type, 2:NamePrefix, 3:Code, 4:Qty, 5:Amt
    for date, tx_type, name_prefix, fund_code, qty_str, amount_str in transactions:
        
        # Clean fund name
        clean_name = f"{name_prefix.strip()} ({fund_code})"
        clean_name = clean_name.replace('\n', ' ').strip()

        qty = parse_turkish_float(qty_str)
        amount = parse_turkish_float(amount_str)
        
        # Determine sign
        if tx_type == "Fon Alışı":
            sign = 1
        elif tx_type == "Fon Satışı":
            sign = -1
        else:
            sign = 0
            
        # Update holdings
        if fund_code not in holdings:
            holdings[fund_code] = {'name': clean_name, 'net_qty': 0.0}
            
        holdings[fund_code]['net_qty'] += sign * qty
        
        # Latest price logic
        if fund_code not in latest_prices and qty > 0 and amount > 0:
            latest_prices[fund_code] = amount / qty

    # Calculate Totals
    total_portfolio_value = 0.0
    fund_reports = []
    
    # Define a custom sort order or grouping if desired, but value desc is fine.
    
    for code, data in holdings.items():
        net_qty = data['net_qty']
        
        # Get latest price, default to 0
        price = latest_prices.get(code, 0.0)
        
        estimated_value = net_qty * price
        
        if net_qty > 0.01: # Filter out closed positions
            total_portfolio_value += estimated_value
            fund_reports.append({
                'code': code,
                'name': data['name'],
                'qty': net_qty,
                'price': price,
                'value': estimated_value
            })

    # Sort by value desc
    fund_reports.sort(key=lambda x: x['value'], reverse=True)

    # Print Table
    print("\n| Fon Kodu | Fon Adı | Net Adet | Güncel Fiyat (Tahmini) | Toplam Değer (Tahmini) | Portföy Oranı |")
    print("|---|---|---|---|---|---|")
    
    for fund in fund_reports:
        percentage = (fund['value'] / total_portfolio_value) * 100 if total_portfolio_value else 0
        print(f"| {fund['code']} | {fund['name']} | {fund['qty']:,.2f} | {fund['price']:,.4f} TL | {fund['value']:,.2f} TL | %{percentage:.2f} |")

    print(f"\n**Toplam Tahmini Portföy Değeri:** {total_portfolio_value:,.2f} TL")

if __name__ == "__main__":
    analyze_funds("fund_data.txt")
