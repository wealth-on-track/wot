# Commodity Metadata Systematic Fix

## Problem Identified

GAUTRY (Gram Gold) had incorrect metadata:
- ❌ Country: "Turkey" (should be "Global")
- ❌ Currency: "TRY" (should be "XAU")
- ❌ Exchange: "Forex" (should be "Commodity")

This violated the 8-Category System design principle that **all commodities must have country="Global"**.

## Root Cause Analysis

Commodity metadata was defined in **3 different locations** with inconsistent rules:

1. **[/src/lib/symbolMapping.ts](../src/lib/symbolMapping.ts)** - Manual symbol mappings
2. **[/src/app/actions/search.ts](../src/app/actions/search.ts)** - Search results for GAUTRY/XAGTRY
3. **[/src/lib/assetCategories.ts](../src/lib/assetCategories.ts)** - Category default metadata

Each location had Turkey exceptions or incorrect currency logic.

## Systematic Fix Applied

### 1. Fixed symbolMapping.ts (Lines 40-47)

**Before:**
```typescript
'GAUTRY': { country: 'Turkey', sector: 'Commodities', industry: 'Gold' },
'XAGTRY': { country: 'Turkey', sector: 'Commodities', industry: 'Silver' },
```

**After:**
```typescript
'GAUTRY': { country: 'Global', sector: 'Commodity', industry: 'Gold' },
'XAGTRY': { country: 'Global', sector: 'Commodity', industry: 'Silver' },
'GC=F': { country: 'Global', sector: 'Commodity', industry: 'Precious Metals' },
'SI=F': { country: 'Global', sector: 'Commodity', industry: 'Precious Metals' },
'CL=F': { country: 'Global', sector: 'Commodity', industry: 'Energy' },
'NG=F': { country: 'Global', sector: 'Commodity', industry: 'Energy' },
```

**Changes:**
- ✅ All commodities → country: 'Global'
- ✅ Standardized sector: 'Commodity' (not 'Commodities')

### 2. Fixed search.ts (Lines 81-119, 310-333)

#### Special Handling for GAUTRY/XAGTRY Search Results

**Before:**
```typescript
// GAUTRY
{
    symbol: 'GAUTRY',
    exchange: 'Forex',     // ❌
    currency: 'XAU',       // ❌ Should be TRY
    country: getCountryFromType(goldType, 'GAUTRY'), // ❌ Was 'Turkey'
}
```

**After:**
```typescript
// GAUTRY
{
    symbol: 'GAUTRY',
    fullName: 'GR Altın',
    exchange: 'Commodity',  // ✅
    category: 'COMMODITIES',
    type: goldType,
    currency: 'TRY',        // ✅ Priced in Turkish Lira
    country: 'Global',      // ✅ All commodities are Global
    sector: 'Commodity',
    source: 'MANUAL' as const,
}
```

Same pattern applied to XAGTRY with currency: 'TRY'

#### Removed Turkey Exception from getCountryFromType()

**Before:**
```typescript
function getCountryFromType(type, symbol) {
    switch (type) {
        case 'GOLD':
        case 'COMMODITY':
            // Turkish-specific commodities
            if (symbol === 'GAUTRY' || symbol === 'XAGTRY' || symbol === 'AET') {
                return 'Turkey';  // ❌
            }
            return 'Global';
    }
}
```

**After:**
```typescript
function getCountryFromType(type, symbol) {
    switch (type) {
        case 'GOLD':
        case 'COMMODITY':
            // ALL COMMODITIES are Global (including GAUTRY, XAGTRY)
            // Even Turkish gram gold/silver are Global because they track global metal prices
            return 'Global';  // ✅
    }
}
```

### 3. Fixed assetCategories.ts (Lines 274-285)

**Before:**
```typescript
case 'COMMODITIES':
    const isTurkish = symbol === 'GAUTRY' || symbol === 'XAGTRY' || symbol === 'AET';
    return {
        sector: 'Commodity',
        country: 'Global',
        currency: isTurkish ? 'TRY' : 'USD'  // ❌ GAUTRY/XAGTRY had wrong currency
    };
```

**After:**
```typescript
case 'COMMODITIES':
    // All commodities: Country = Global, Sector = Commodity
    // Currency: TRY for GAUTRY/XAGTRY, XAU/XAG for ounce-based, USD for others
    let commodityCurrency = 'USD';
    if (symbol === 'GAUTRY') commodityCurrency = 'TRY';  // ✅
    else if (symbol === 'XAGTRY') commodityCurrency = 'TRY';  // ✅
    else if (symbol === 'XAU') commodityCurrency = 'XAU';  // ✅
    else if (symbol === 'XAG') commodityCurrency = 'XAG';  // ✅

    return {
        sector: 'Commodity',
        country: 'Global',  // Always Global for all commodities
        currency: commodityCurrency
    };
```

## Design Principles Enforced

### All Commodities Follow These Rules:

1. **Country**: ALWAYS "Global"
   - Even Turkish gram gold (GAUTRY) is Global because it tracks XAU (global gold price)
   - Even Turkish gram silver (XAGTRY) is Global because it tracks XAG (global silver price)

2. **Sector**: ALWAYS "Commodity"
   - Standardized singular form (not "Commodities")

3. **Exchange**: "Commodity" (default)
   - Not "Forex" (that's for FX category)

4. **Currency**:
   - Turkish gram-based commodities (GAUTRY, XAGTRY): "TRY"
   - Ounce-based precious metals (XAU, XAG): "XAU", "XAG"
   - All other commodities (oil, gas, etc.): "USD"

## Testing

Created test script: [test_commodity_defaults.js](../test_commodity_defaults.js)

Run: `npx tsx test_commodity_defaults.js`

All tests pass ✅:
- GAUTRY: country=Global, currency=TRY, sector=Commodity
- XAGTRY: country=Global, currency=TRY, sector=Commodity
- XAU: country=Global, currency=XAU, sector=Commodity
- XAG: country=Global, currency=XAG, sector=Commodity
- CL=F (Oil): country=Global, currency=USD, sector=Commodity

## Impact

### New Imports
When users search and add GAUTRY or XAGTRY:
- ✅ Will have correct metadata automatically
- ✅ Consistent across all 3 metadata sources

### Existing Assets
- No existing commodity assets in database (verified with check_commodity_metadata.js)
- No migration needed

## Files Modified

1. [/src/lib/symbolMapping.ts](../src/lib/symbolMapping.ts) - Lines 40-47
2. [/src/app/actions/search.ts](../src/app/actions/search.ts) - Lines 81-119, 310-333
3. [/src/lib/assetCategories.ts](../src/lib/assetCategories.ts) - Lines 274-285

## Rationale: Why Turkish Commodities Are "Global" with TRY Currency

GAUTRY and XAGTRY are denominated in Turkish Lira **per gram**, and their prices are derived from **global metal prices**:

- **GAUTRY** = (XAU/oz in USD) × (USD/TRY rate) ÷ 31.1035 grams/oz
- **XAGTRY** = (XAG/oz in USD) × (USD/TRY rate) ÷ 31.1035 grams/oz

They track **global** precious metal markets, not Turkish production or Turkish-specific pricing. Therefore:
- Country: "Global" (follows global XAU/XAG markets)
- Currency: "TRY" (actual denomination of the asset)
- Sector: "Commodity" (commodity classification)

This is consistent with the 8-Category System principle that commodities are globally traded assets, while maintaining correct currency for portfolio calculations.

## Related Documentation

- [8-Category System Overview](./PRICE_UPDATE_SYSTEM.md)
- [Asset Categories Implementation](../src/lib/assetCategories.ts)
