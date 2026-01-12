# Country Detection Test Scenarios

## Test Cases

### ✅ Expected to Work (After Fix)

1. **LVMH (MC.PA)** - France
   - Exchange: PAR/EPA
   - Suffix: .PA
   - Expected: France

2. **Sanofi (SAN.PA)** - France
   - Exchange: PAR/EPA
   - Suffix: .PA
   - Expected: France

3. **Philips (PHIA.AS)** - Netherlands
   - Exchange: AMS
   - Suffix: .AS
   - Expected: Netherlands

4. **Stellantis NV (STLA.MI or STLAM.MI)** - Italy/France/Netherlands
   - Note: Stellantis has multiple listings
   - STLA.MI (Milan) → Italy
   - STLA.PA (Paris) → France
   - STLA (NYSE) → United States
   - Expected: Depends on which exchange user selects

5. **Adidas (ADS.DE)** - Germany
   - Exchange: XETRA/FRA
   - Suffix: .DE
   - Expected: Germany

6. **BBVA (BBVA.MC)** - Spain
   - Exchange: BME/Madrid
   - Suffix: .MC
   - Expected: Spain

7. **TEFAS Funds (e.g., MAC, TKS, etc.)** - Turkey
   - Type: TEFAS/FON
   - Currency: TRY
   - Source: TEFAS
   - Expected: Turkey

## How to Test

### Manual Testing (Recommended)

1. Start dev server:
   ```bash
   npm run dev
   ```

2. Open browser: http://localhost:3000

3. Login and go to asset search

4. For each stock:
   - Search by company name (e.g., "LVMH")
   - Select the result
   - Check if country field is populated
   - Verify country matches expectation

### Console Logging

The fix includes console.log statements:
```
[MarketData] Derived country "France" from exchange for MC.PA
```

Check browser console (F12) when adding an asset.

### Expected Outcomes

| Stock | Symbol | Exchange | Expected Country | Status |
|-------|--------|----------|------------------|--------|
| LVMH | MC.PA | PAR/EPA | France | ✅ Should work |
| Sanofi | SAN.PA | PAR/EPA | France | ✅ Should work |
| Philips | PHIA.AS | AMS | Netherlands | ✅ Should work |
| Stellantis | STLA.MI | MIL | Italy | ✅ Should work |
| Stellantis | STLA.PA | PAR | France | ✅ Should work |
| Stellantis | STLA | NYSE | United States | ✅ Should work |
| Adidas | ADS.DE | XETRA | Germany | ✅ Should work |
| BBVA | BBVA.MC | BME | Spain | ✅ Should work |
| MAC (TEFAS) | MAC | TEFAS | Turkey | ✅ Should work |
| TKS (TEFAS) | TKS | TEFAS | Turkey | ✅ Should work |

## Edge Cases to Verify

1. **Yahoo provides country** (e.g., AAPL)
   - Should use Yahoo data (not override)
   - Exchange fallback should NOT trigger

2. **No exchange info** (rare)
   - Should remain empty
   - User can manually fill

3. **Unknown exchange**
   - Should remain empty
   - User can manually fill

## What Was Fixed

### Before Fix
- `getMarketPrice()` did not have exchange-based fallback
- Paris stocks (LVMH, Sanofi) showed country: "N/A"
- Only `getAssetMetadata()` had the fallback (but wasn't used by InlineAssetSearch)
- Cached assets with empty country were not updated

### After Fix (v1 - lines 308-318)
- Added exchange-based fallback to `getMarketPrice()` for fresh API calls
- Now both code paths have the fallback
- Paris stocks should show country: "France"

### After Fix (v2 - lines 121-145)
- **Critical Cache Fix**: Apply exchange-based fallback to cached data
- When retrieving cached data with empty country, derive from exchange
- Automatically update cache with derived country
- Previously cached assets (ING, ABN, BBVA) now show correct country

### After Fix (v3 - TEFAS Support)
- **TEFAS Fund Detection**: Auto-detect Turkey for TEFAS funds
- Fresh TEFAS data saves with `country: 'Turkey'` (lines 166-196)
- Cached TEFAS data auto-derives Turkey from source/currency (lines 124-131)
- All TEFAS funds now show country: "Turkey" automatically

## Testing Checklist

- [ ] LVMH (MC.PA) → France
- [ ] Sanofi (SAN.PA) → France
- [ ] Philips (PHIA.AS) → Netherlands
- [ ] Stellantis (test multiple exchanges)
- [ ] Adidas (ADS.DE) → Germany
- [ ] BBVA (BBVA.MC) → Spain
- [ ] US stock (AAPL) → United States (from Yahoo, not fallback)
- [ ] TEFAS funds (MAC, TKS, etc.) → Turkey
- [ ] Check console logs for "Derived country" messages

## If Tests Fail

1. Check browser console for errors
2. Check network tab for Yahoo API responses
3. Verify symbol format (should have .PA, .AS, etc.)
4. Check if exchange field is populated in the response
5. Review console logs for "Derived country" messages

## Notes

- Sector will still be empty (manual entry required)
- Country should auto-populate for all major exchanges
- Users can always override in EditAssetModal
