# Cache Country Detection Fix - Summary

## Problem
Previously searched European stocks (ING Groep, ABN AMRO, BBVA) were not showing country information even after implementing exchange-based country detection.

## Root Cause
**Cache Bypass Issue**: The exchange-based fallback logic was only applied during fresh API calls, NOT when returning cached data.

### Code Flow Before Fix:
```
User searches for "ING Groep" (INGA.AS)
    ↓
getMarketPrice() checks cache (line 119)
    ↓
Cache found with country: null or ""
    ↓
Returns cached data immediately WITHOUT applying fallback
    ↓
Result: country: "N/A" ❌
```

### Why New Searches Worked:
When searching for a stock NOT in cache:
- Yahoo API call is made
- Exchange-based fallback runs (lines 308-318)
- Cache is saved WITH derived country
- Result: country: "Netherlands" ✅

### Why Cached Searches Failed:
When searching for a previously cached stock:
- Cache is returned immediately (lines 119-136)
- Exchange-based fallback NEVER runs
- Empty country field is returned as-is
- Result: country: "N/A" ❌

## Solution
Modified cache retrieval logic in [src/services/marketData.ts](src/services/marketData.ts) (lines 121-136):

```typescript
// Apply exchange-based fallback if country is missing
let countryValue = cached.country;
if (!countryValue || countryValue.trim() === '') {
    const { getCountryFromExchange } = await import('@/lib/exchangeToCountry');
    const derivedCountry = getCountryFromExchange(exchange, symbol);
    if (derivedCountry) {
        console.log(`[MarketData] Derived country "${derivedCountry}" from exchange for cached ${symbol}`);
        countryValue = derivedCountry;

        // Update cache with derived country
        await prisma.priceCache.update({
            where: { symbol },
            data: { country: derivedCountry }
        });
    }
}
```

## Benefits

✅ **Self-Healing Cache**: Cached assets with empty country are automatically updated
✅ **No Manual Intervention**: Users don't need to manually refresh or re-add assets
✅ **Persistent Fix**: Once updated, cache contains correct country forever
✅ **Performance**: Only runs on first access after fix, then uses updated cache
✅ **Backward Compatible**: Doesn't affect assets that already have country data

## Testing

### Before Fix:
```bash
# Search for ING Groep (INGA.AS) - cached
Result: country: "N/A" ❌

# Search for ABN AMRO (ABN.AS) - cached
Result: country: "N/A" ❌

# Search for BBVA (BBVA.MC) - cached
Result: country: "N/A" ❌
```

### After Fix:
```bash
# Search for ING Groep (INGA.AS)
Result: country: "Netherlands" ✅
Cache updated: ✅

# Search for ABN AMRO (ABN.AS)
Result: country: "Netherlands" ✅
Cache updated: ✅

# Search for BBVA (BBVA.MC)
Result: country: "Spain" ✅
Cache updated: ✅
```

## Affected Stocks

This fix automatically resolves country detection for:
- 🇳🇱 **Dutch stocks**: ING Groep (INGA.AS), ABN AMRO (ABN.AS), Philips (PHIA.AS)
- 🇫🇷 **French stocks**: LVMH (MC.PA), Sanofi (SAN.PA)
- 🇩🇪 **German stocks**: Adidas (ADS.DE), Siemens (SIE.DE)
- 🇪🇸 **Spanish stocks**: BBVA (BBVA.MC), Santander (SAN.MC)
- 🇮🇹 **Italian stocks**: Stellantis (STLA.MI), Eni (ENI.MI)
- And all other stocks with exchange suffixes or exchange names in our mapping

## TEFAS Fund Country Detection (Added)

### Problem
TEFAS funds (Turkish mutual funds) with currency TRY were not automatically getting country set to Turkey.

### Solution
Added automatic country detection for TEFAS funds in two places:

1. **Fresh TEFAS data** ([src/services/marketData.ts:166-188](src/services/marketData.ts#L166-L188))
   - When fetching from TEFAS API, set `country: 'Turkey'` in cache
   - Return `country: 'Turkey'` in result

2. **Cached TEFAS data** ([src/services/marketData.ts:124-131](src/services/marketData.ts#L124-L131))
   - Check if `source === 'TEFAS'` and `currency === 'TRY'`
   - Auto-derive country as Turkey
   - Update cache with country

### Result
All TEFAS funds now automatically show:
- 🇹🇷 Country: Turkey
- 💰 Currency: TRY
- No manual input required

## Build Status

```bash
✓ TypeScript compilation successful
✓ All 20 tests passing
✓ Production build successful
```

## Console Logs

When a cached asset with empty country is accessed, you'll see:

**For exchange-based detection:**
```
[MarketData] Derived country "Netherlands" from exchange for cached INGA.AS
```

**For TEFAS funds:**
```
[MarketData] Derived country "Turkey" from TEFAS source for cached MAC
```

This indicates the cache is being updated with the derived country.

## Implementation Files

1. **[src/services/marketData.ts](src/services/marketData.ts)** - Lines 121-136
   - Cache retrieval with exchange-based fallback
   - Automatic cache update

2. **[src/lib/exchangeToCountry.ts](src/lib/exchangeToCountry.ts)**
   - Exchange → Country mapping
   - Unchanged from previous implementation

3. **[test-country-detection.md](test-country-detection.md)**
   - Updated with v2 fix information

## Next Steps

Users can now:
1. Search for any previously cached European stock
2. Country will automatically populate from exchange
3. Cache will be updated permanently
4. No manual intervention required

---

**Fixed**: January 9, 2026
**Version**: v2 (Cache Auto-Update)
