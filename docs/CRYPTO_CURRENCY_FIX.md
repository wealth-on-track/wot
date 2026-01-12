# Crypto Currency Fix

## Problem
Crypto pairs like XRP-EUR, BTC-EUR, ETH-EUR were incorrectly getting currency='USD' instead of extracting the quote currency from the symbol.

## Root Cause

**Two places** had hardcoded USD for crypto:

1. **[/src/lib/assetCategories.ts](../src/lib/assetCategories.ts)** - Category defaults (used when importing manually)
```typescript
case 'CRYPTO':
  return { sector: 'Crypto', country: 'Global', currency: 'USD' }; // ❌ Always USD
```

2. **[/src/app/actions/search.ts](../src/app/actions/search.ts)** - Search results currency
```typescript
function getCurrencyFromExchange(exchange?: string): string {
    // ... only looked at exchange, not symbol
    return 'USD'; // ❌ Always USD for crypto
}
```

## Fix Applied

### 1. Fixed assetCategories.ts (Lines 271-281)

```typescript
case 'CRYPTO':
  // Crypto pairs: BTC-USD, ETH-EUR, etc.
  // Extract quote currency from symbol (e.g., BTC-EUR -> EUR)
  let cryptoCurrency = 'USD'; // Default
  if (symbol && symbol.includes('-')) {
    const parts = symbol.split('-');
    if (parts.length === 2) {
      cryptoCurrency = parts[1]; // Quote currency (USD, EUR, etc.)
    }
  }
  return { sector: 'Crypto', country: 'Global', currency: cryptoCurrency };
```

### 2. Fixed search.ts getCurrencyFromExchange (Lines 250-275)

```typescript
function getCurrencyFromExchange(exchange?: string, symbol?: string, type?: string): string {
    // CRYPTO: Extract quote currency from symbol (BTC-EUR -> EUR, XRP-GBP -> GBP)
    if (type === 'CRYPTO' && symbol && symbol.includes('-')) {
        const parts = symbol.split('-');
        if (parts.length === 2) {
            return parts[1]; // Quote currency (USD, EUR, GBP, etc.)
        }
    }

    // ... rest of exchange-based logic for stocks
}
```

And updated the call site (Line 36):
```typescript
currency: getCurrencyFromExchange(item.exchange, item.symbol, assetType),
```

## Systematic Solution

The fix automatically extracts the **quote currency** (second part) from ANY crypto pair symbol:

```
Symbol Pattern: {BASE}-{QUOTE}
Currency: {QUOTE}
```

This works for **all** currency pairs without hardcoding specific currencies.

## Testing

Created test: [test_crypto_currency.js](../test_crypto_currency.js)

All tests pass ✅:
- BTC-USD → currency: USD
- BTC-EUR → currency: EUR
- BTC-GBP → currency: GBP
- ETH-EUR → currency: EUR
- ETH-TRY → currency: TRY
- ETH-USD → currency: USD
- XRP-EUR → currency: EUR
- XRP-JPY → currency: JPY

**And automatically works for any other pairs:**
- ADA-CAD → currency: CAD
- SOL-AUD → currency: AUD
- Any future crypto-fiat pair

## Impact

### New Crypto Imports
When users add crypto pairs:
- ✅ BTC-EUR will correctly show EUR currency
- ✅ ETH-EUR will correctly show EUR currency
- ✅ XRP-EUR will correctly show EUR currency
- ✅ All -USD pairs continue to work correctly

### Existing Assets
Any existing crypto assets with incorrect currency can be fixed by:
1. Edit the asset
2. The currency will auto-correct based on the symbol

## Files Modified

1. [/src/lib/assetCategories.ts](../src/lib/assetCategories.ts) - Lines 271-281
2. [/src/app/actions/search.ts](../src/app/actions/search.ts) - Lines 36, 250-275
