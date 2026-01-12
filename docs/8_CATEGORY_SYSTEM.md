# 8-Category Asset Classification System

**Date:** January 11, 2026
**Version:** 1.0.0
**Status:** ✅ Production Ready

---

## 📋 Overview

The portfolio tracker now uses an **8-category asset classification system** that provides clear, systematic organization of all investment types. This replaces the previous hybrid system that mixed type + exchange combinations.

### The 8 Categories:

1. **BIST** - Borsa Istanbul (Turkish Stock Exchange)
2. **TEFAS** - Turkish Mutual Funds
3. **US_MARKETS** - NASDAQ, NYSE, AMEX
4. **EU_MARKETS** - European Exchanges (Paris, Amsterdam, Frankfurt, Milan, London, Madrid, Lisbon, Swiss)
5. **CRYPTO** - Cryptocurrencies
6. **COMMODITIES** - Gold, Silver, Oil, etc.
7. **FX** - Foreign Exchange Pairs (EUR/USD, USD/TRY, etc.)
8. **CASH** - Cash Holdings

---

## 🎯 Why 8 Categories?

### Benefits:

✅ **Clear Classification** - Every asset belongs to exactly ONE category
✅ **Simplified Routing** - API calls, logo lookups, and price fetching are category-specific
✅ **Better Analytics** - Easy portfolio breakdown by market
✅ **Scalability** - New assets fit into existing categories
✅ **Type Safety** - Enum validation prevents invalid categories

### Before vs. After:

| Before (Hybrid) | After (8-Category) |
|---|---|
| `type: 'STOCK'` + `exchange: 'BIST'` | `category: 'BIST'` |
| `type: 'STOCK'` + `exchange: 'NASDAQ'` | `category: 'US_MARKETS'` |
| `type: 'FUND'` + `exchange: 'TEFAS'` | `category: 'TEFAS'` |
| `type: 'CRYPTO'` | `category: 'CRYPTO'` |
| `type: 'GOLD'` or `'COMMODITY'` | `category: 'COMMODITIES'` |
| Blocked | `category: 'FX'` ✨ NEW |
| `type: 'CASH'` | `category: 'CASH'` |

---

## 🔄 Update Strategies by Category

| Category | Price Update | Metadata Update | Logo Update | Notes |
|----------|--------------|-----------------|-------------|-------|
| **BIST** | Hourly (00-59:00)<br/>⏸️ Pause: 00:00-08:00 TRT | Import only → DB cache<br/>✏️ User editable | Import only → DB cache<br/>🔄 Admin refresh available | Market hours: 10:00-18:00 TRT |
| **TEFAS** | Hourly (00-59:00)<br/>⏸️ Pause: 00:00-08:00 TRT | Import only → DB cache<br/>✏️ User editable | Letter placeholder (static) | Fund NAV published daily |
| **US_MARKETS** | Hourly (00-59:00)<br/>⏸️ Pause: 00:00-08:00 EST | Import only → DB cache<br/>✏️ User editable | Import only → DB cache<br/>🔄 Admin refresh available | Market hours: 9:30-16:00 EST |
| **EU_MARKETS** | Hourly (00-59:00)<br/>⏸️ Pause: 00:00-08:00 CET | Import only → DB cache<br/>✏️ User editable | Import only → DB cache<br/>🔄 Admin refresh available | Varies by exchange |
| **CRYPTO** | Hourly (00-59:00)<br/>24/7 trading | Import only → DB cache<br/>✏️ User editable | Import only → DB cache<br/>🔄 Admin refresh available | No market hours |
| **COMMODITIES** | Hourly (00-59:00)<br/>⏸️ Pause: 00:00-08:00 UTC | Import only → DB cache (hardcoded)<br/>✏️ User editable | Icons8 (static) | GAUTRY: Synthetic calc |
| **FX** | Hourly (00-59:00)<br/>24/5 trading | Import only → DB cache (hardcoded)<br/>✏️ User editable | Country flags (static) | Forex: Sun 17:00 - Fri 17:00 EST |
| **CASH** | Never (fixed 1.0) | Import only → DB cache (hardcoded)<br/>✏️ User editable | Currency symbols (static) | Price always 1.0<br/>Conversion via FX rates |

### Update Strategy Details:

#### Price Updates
- **Frequency:** Hourly at xx:00 (GitHub Actions cron job)
- **Pause Window:** 00:00-08:00 in respective timezone to avoid off-hours API calls
- **Cache:** PriceCache table with stale detection (24h for most, 7 days for errors)
- **CASH Exception:** Never updates (always 1.0)

#### Metadata Updates
- **Import:** Fetched once during asset creation via search API
- **Storage:** Saved to Asset table (sector, country fields)
- **User Edit:** Available via "Edit Asset" modal in portfolio
- **Admin Refresh:** Optional manual refresh button in admin panel (see below)

#### Logo Updates
- **Import:** Fetched once during asset creation
- **Storage:** URL saved to Asset.logoUrl field
- **Static Assets:** TEFAS (letter placeholder), Commodities (Icons8), FX (flags), Cash (symbols)
- **Admin Refresh:** Available for categories with external logo APIs

---

## 🗂️ Category Details

### 1. BIST (Borsa Istanbul)

**Description:** Turkish stocks traded on Borsa Istanbul
**Examples:** TAVHL.IS, RYGYO.IS, ASELS.IS
**Currency:** TRY (locked)
**Exchange:** BIST, IST, Istanbul
**Yahoo Suffix:** `.IS`

**API Routing:**
- **Price:** Yahoo Finance (symbol.IS) → AlphaVantage
- **Metadata:** Yahoo Profile → AlphaVantage → Finnhub → Exchange mapping
- **Logo:** Logodev (Istanbul) → Yahoo Finance → Icons8

---

### 2. TEFAS (Turkish Mutual Funds)

**Description:** Turkish mutual funds regulated by TEFAS
**Examples:** TI2, GAU, AHE
**Currency:** TRY (locked)
**Exchange:** TEFAS
**Special:** 3-letter codes only

**API Routing:**
- **Price:** TEFAS API ONLY (strict guard, Yahoo blocked)
- **Metadata:** TEFAS API (fund name, code, manager)
- **Logo:** Letter placeholder only (no external logos)

**Important:** TEFAS has exclusive API routing - Yahoo Finance is completely blocked to prevent incorrect pricing in USD.

---

### 3. US_MARKETS (US Stock Exchanges)

**Description:** Stocks traded on US exchanges
**Examples:** AAPL, TSLA, MSFT, NVDA
**Currency:** USD (default), can be EUR for ADRs
**Exchange:** NASDAQ, NYSE, AMEX

**API Routing:**
- **Price:** Yahoo Finance → AlphaVantage
- **Metadata:** Yahoo Profile → AlphaVantage → Finnhub
- **Logo:** Logodev (US) → Clearbit → Yahoo Finance → Icons8

---

### 4. EU_MARKETS (European Stock Exchanges)

**Description:** Stocks traded on European exchanges
**Examples:** ASML.AS (Amsterdam), SOI.PA (Paris), RABO.AS (Amsterdam)
**Currency:** EUR (Paris, Amsterdam, Frankfurt, Milan, Madrid, Lisbon), GBP (London), CHF (Swiss)
**Exchanges:**
- **PAR** (Euronext Paris) → `.PA`
- **AMS** (Euronext Amsterdam) → `.AS`
- **FRA, GER** (Frankfurt, Deutsche Börse) → `.F`, `.DE`
- **MIL** (Borsa Italiana) → `.MI`
- **LSE, LON** (London Stock Exchange) → `.L`
- **MAD** (Bolsa de Madrid) → `.MC`
- **LIS** (Euronext Lisbon) → `.LS`
- **SWX, VTX** (SIX Swiss Exchange) → `.SW`

**API Routing:**
- **Price:** Yahoo Finance (with suffix) → Finnhub
- **Metadata:** Yahoo Profile → Finnhub → Exchange mapping
- **Logo:** Logodev (Europe) → Clearbit → Yahoo Finance → Icons8

---

### 5. CRYPTO (Cryptocurrencies)

**Description:** Digital currencies
**Examples:** BTC-USD, ETH-EUR, XRP-EUR
**Currency:** Pair-based (determined by suffix: -USD, -EUR, -TRY)
**Exchange:** None (24/7 markets)

**API Routing:**
- **Price:** Yahoo Finance (BTC-USD format) - 24/7 pricing
- **Metadata:** Yahoo (limited metadata) - Auto-assigned: sector="Crypto", country="Global"
- **Logo:** CryptoCompare → Icons8 (crypto icons) → Letter placeholder

**Market Status:** Always 'REGULAR' (24/7, no holidays)

---

### 6. COMMODITIES (Gold, Silver, Oil, etc.)

**Description:** Physical commodities and futures
**Examples:**
- **GAUTRY** (Gram Gold in TRY)
- **XAGTRY** (Gram Silver in TRY)
- **GC=F** (Gold futures)
- **SI=F** (Silver futures)
- **CL=F** (Oil futures)

**Currency:** TRY (Turkish gram commodities), USD (international futures)
**Exchange:** Forex, COMEX, NYMEX

**API Routing:**
- **Price (Turkish):** Synthetic Calculation
  - GAUTRY: `(GC=F price × USDTRY parity) / 31.1034768` (ounce to gram)
  - XAGTRY: `(SI=F price × USDTRY parity) / 31.1034768`
- **Price (International):** Yahoo Finance (GC=F, SI=F, CL=F)
- **Metadata:** Manual/Hardcoded (Commodity, Global/Turkey)
- **Logo:** Icons8 (gold-bars, silver, oil icons)

**Special Symbols:**
- GAUTRY, XAGTRY, AET → Country: Turkey
- Others → Country: Global

---

### 7. FX (Foreign Exchange) ✨ NEW

**Description:** Currency pairs for tracking exchange rates
**Examples:** EURUSD=X, EURTRY=X, USDTRY=X, GBPUSD=X
**Currency:** Pair-based (base/quote)
**Exchange:** Forex

**API Routing:**
- **Price:** Yahoo Finance (EURUSD=X format) → ECB rates (fallback)
- **Metadata:** Manual (sector="Currency", country="Global")
- **Logo:** Country flags (EUR=🇪🇺, USD=🇺🇸, TRY=🇹🇷)

**Search Format:**
- "EURUSD" → EURUSD=X
- "EUR USD" → EURUSD=X
- "EUR/USD" → EURUSD=X

**Enable Status:** ✅ Enabled (previously blocked in search)

---

### 8. CASH (Cash Holdings)

**Description:** Cash in various currencies
**Examples:** USD, EUR, TRY, GBP
**Currency:** Matches symbol (USD cash = USD currency)
**Exchange:** Forex

**API Routing:**
- **Price:** Fixed at 1.0 (conversion handled separately at portfolio valuation level)
- **Metadata:** Manual (sector="Cash", country based on currency code)
  - USD → USA
  - EUR → Europe
  - TRY → Turkey
  - GBP → United Kingdom
  - Others → Global
- **Logo:** Currency symbols (💵💶💷) or Icons8

**Important:** Price is always 1.0 relative to itself; actual conversion happens during portfolio calculation.

---

## 🔧 Implementation Architecture

### Database Schema

```prisma
enum AssetCategory {
  BIST
  TEFAS
  US_MARKETS
  EU_MARKETS
  CRYPTO
  COMMODITIES
  FX
  CASH
}

model Asset {
  id          String        @id @default(cuid())
  category    AssetCategory @default(US_MARKETS)  // New 8-category system
  type        String                              // Legacy field for backward compatibility
  symbol      String
  // ... other fields
}
```

### TypeScript Types

```typescript
// New 8-category system
type AssetCategory =
  | 'BIST'
  | 'TEFAS'
  | 'US_MARKETS'
  | 'EU_MARKETS'
  | 'CRYPTO'
  | 'COMMODITIES'
  | 'FX'
  | 'CASH';

// Legacy types (backward compatibility)
type LegacyAssetType =
  | 'STOCK'
  | 'CRYPTO'
  | 'GOLD'
  | 'BOND'
  | 'FUND'
  | 'CASH'
  | 'COMMODITY'
  | 'CURRENCY'
  | 'ETF';
```

### Key Files

| File | Purpose |
|------|---------|
| `/src/lib/assetCategories.ts` | **Core:** Category definitions, helper functions, routing logic |
| `/prisma/schema.prisma` | Database schema with AssetCategory enum |
| `/src/app/actions/search.ts` | Search logic with category assignment |
| `/src/lib/actions.ts` | addAsset function with category saving |
| `/src/components/InlineAssetSearch.tsx` | UI component with category in FormData |
| `/scripts/migrate_to_8_categories.ts` | Migration script for existing assets |

---

## 🔄 Migration

### Database Migration

**Status:** ✅ Completed
**Date:** January 11, 2026
**Assets Migrated:** 16

**Distribution After Migration:**
- BIST: 2 assets (12.5%)
- TEFAS: 3 assets (18.8%)
- US_MARKETS: 4 assets (25.0%)
- EU_MARKETS: 5 assets (31.3%)
- CRYPTO: 2 assets (12.5%)
- COMMODITIES: 0 assets
- FX: 0 assets
- CASH: 0 assets

**Migration Process:**
1. Created AssetCategory enum in Prisma schema
2. Added category column to Asset table (default: US_MARKETS)
3. Ran migration script to convert all existing assets
4. Verified 100% success rate (0 errors)

**Run Migration Again:**
```bash
npx tsx scripts/migrate_to_8_categories.ts
```

---

## 🧪 Testing

### Test Scenarios

#### 1. BIST Stock
- Search: "TAVHL"
- Expected Category: BIST
- Expected Exchange: Borsa Istanbul
- Expected Currency: TRY

#### 2. TEFAS Fund
- Search: "TI2"
- Expected Category: TEFAS
- Expected Exchange: TEFAS
- Expected Currency: TRY

#### 3. US Stock
- Search: "AAPL"
- Expected Category: US_MARKETS
- Expected Exchange: NASDAQ
- Expected Currency: USD

#### 4. EU Stock
- Search: "ASML"
- Expected Category: EU_MARKETS
- Expected Exchange: Amsterdam
- Expected Currency: EUR

#### 5. Crypto
- Search: "BTC"
- Expected Category: CRYPTO
- Expected Symbol: BTC-USD or BTC-EUR
- Expected Currency: USD or EUR (pair-based)

#### 6. Commodity (Turkish)
- Search: "ALTIN" or "GAU"
- Expected Category: COMMODITIES
- Expected Symbol: GAUTRY
- Expected Currency: TRY

#### 7. FX Pair ✨ NEW
- Search: "EURUSD" or "EUR USD"
- Expected Category: FX
- Expected Symbol: EURUSD=X
- Expected Currency: EUR (base)

#### 8. Cash
- Search: "USD" or "CASH"
- Expected Category: CASH
- Expected Symbol: USD
- Expected Currency: USD

---

## 📚 API Reference

### Helper Functions

#### `getAssetCategory(type, exchange?, symbol?): AssetCategory`

Determines the category based on legacy type, exchange, and symbol.

**Example:**
```typescript
getAssetCategory('STOCK', 'BIST', 'TAVHL.IS')         → 'BIST'
getAssetCategory('FUND', 'TEFAS', 'TI2')              → 'TEFAS'
getAssetCategory('STOCK', 'NASDAQ', 'AAPL')           → 'US_MARKETS'
getAssetCategory('STOCK', 'Amsterdam', 'ASML.AS')     → 'EU_MARKETS'
getAssetCategory('CRYPTO', undefined, 'BTC-USD')      → 'CRYPTO'
getAssetCategory('GOLD', undefined, 'GAUTRY')         → 'COMMODITIES'
getAssetCategory('CURRENCY', undefined, 'EURUSD=X')   → 'FX'
getAssetCategory('CASH', undefined, 'USD')            → 'CASH'
```

#### `categoryToLegacyType(category): LegacyAssetType`

Converts new category to legacy type for backward compatibility.

#### `getYahooSearchSymbol(category, symbol, exchange?): string`

Gets the correct Yahoo Finance ticker for a given category and symbol.

**Examples:**
```typescript
getYahooSearchSymbol('BIST', 'TAVHL', 'BIST')         → 'TAVHL.IS'
getYahooSearchSymbol('EU_MARKETS', 'ASML', 'AMS')     → 'ASML.AS'
getYahooSearchSymbol('US_MARKETS', 'AAPL')            → 'AAPL'
getYahooSearchSymbol('COMMODITIES', 'GAUTRY')         → 'GC=F'
```

#### `getCategoryDefaults(category, symbol?): { sector, country, currency }`

Gets default metadata for a category.

**Example:**
```typescript
getCategoryDefaults('BIST')                 → { sector: 'UNKNOWN', country: 'Turkey', currency: 'TRY' }
getCategoryDefaults('TEFAS')                → { sector: 'Fund', country: 'Turkey', currency: 'TRY' }
getCategoryDefaults('CRYPTO')               → { sector: 'Crypto', country: 'Global', currency: 'USD' }
getCategoryDefaults('COMMODITIES', 'GAUTRY') → { sector: 'Commodity', country: 'Turkey', currency: 'TRY' }
getCategoryDefaults('CASH', 'EUR')          → { sector: 'Cash', country: 'Europe', currency: 'EUR' }
```

#### `shouldUseYahoo(category): boolean`

Determines if Yahoo Finance should be used for price fetching.

**Returns `false` for:** TEFAS, CASH
**Returns `true` for:** All others

---

## 🎨 UI Display

### Category Colors

```typescript
BIST: '#E74C3C'        // Red
TEFAS: '#3498DB'       // Blue
US_MARKETS: '#2ECC71'  // Green
EU_MARKETS: '#9B59B6'  // Purple
CRYPTO: '#F39C12'      // Orange
COMMODITIES: '#E67E22' // Dark Orange
FX: '#1ABC9C'          // Teal
CASH: '#95A5A6'        // Gray
```

### Display Names

```typescript
BIST: 'Borsa Istanbul'
TEFAS: 'TEFAS Funds'
US_MARKETS: 'US Markets'
EU_MARKETS: 'European Markets'
CRYPTO: 'Cryptocurrencies'
COMMODITIES: 'Commodities'
FX: 'Foreign Exchange'
CASH: 'Cash Holdings'
```

---

## 🔧 Admin Panel Features

### Manual Metadata Refresh

**Location:** `/admin/assets` (Admin Panel → Assets)

**Purpose:** Refresh metadata (sector, country, industry) and logos for existing assets by re-fetching from APIs.

**Access:** Admin users only

**Use Cases:**
1. Incorrect sector/country data from initial import
2. Company changed industry/sector
3. Logo URL broken or outdated
4. Bulk refresh after API improvements

**Features:**
- ✅ Single asset refresh
- ✅ Bulk refresh (all assets in category)
- ✅ Rate limiting to respect API quotas
- ✅ Progress indicator
- ✅ Error handling with retry logic

**Categories Supported:**
- **BIST:** Yahoo→AlphaVantage→Finnhub + Logo APIs
- **US_MARKETS:** Yahoo→AlphaVantage→Finnhub + Logo APIs
- **EU_MARKETS:** Yahoo→Finnhub + Logo APIs
- **CRYPTO:** Yahoo + CryptoCompare logos
- **TEFAS:** TEFAS API (metadata only, no logo)
- **COMMODITIES:** Manual metadata (no refresh needed)
- **FX:** Manual metadata (no refresh needed)
- **CASH:** Manual metadata (no refresh needed)

**Rate Limits:**
- AlphaVantage: 25 requests/day (free tier)
- Finnhub: 60 requests/minute (free tier)
- Yahoo: Unlimited (unofficial)
- Logodev: Unknown (use with caution)

**Implementation Status:** 📋 Planned (not yet implemented)

**Proposed UI:**
```
Admin Panel → Assets
┌─────────────────────────────────────────┐
│ Asset List                              │
│ ┌───────────────────────────────────┐  │
│ │ Symbol  Category    Actions        │  │
│ │ TAVHL   BIST        [Refresh]      │  │
│ │ AAPL    US_MARKETS  [Refresh]      │  │
│ │ TI2     TEFAS       [Refresh]      │  │
│ └───────────────────────────────────┘  │
│                                         │
│ [Bulk Refresh All] [Refresh by Category]
└─────────────────────────────────────────┘
```

---

## 🚀 Future Enhancements

### Potential New Categories (Not Implemented Yet)

1. **ASIA_MARKETS** - Asian exchanges (Tokyo, Hong Kong, Shanghai)
2. **LATAM_MARKETS** - Latin American exchanges
3. **REAL_ESTATE** - REITs and real estate funds
4. **DERIVATIVES** - Options, futures (non-commodity)

### API Improvements

1. Add Binance API for direct crypto pricing
2. Add ECB API as primary source for FX rates
3. Add commodity-specific APIs (CME, ICE)
4. Improve logo coverage for EU stocks

---

## 📞 Support

For questions or issues related to the 8-category system:

1. Check this documentation first
2. Review `/src/lib/assetCategories.ts` for implementation details
3. Test with migration script: `npx tsx scripts/migrate_to_8_categories.ts`
4. Report issues at: https://github.com/anthropics/claude-code/issues

---

## 📝 Changelog

### v1.0.0 - January 11, 2026
- ✨ Initial implementation of 8-category system
- ✅ Database migration completed (16 assets)
- ✅ Search logic updated with category support
- ✅ addAsset action saves category field
- ✅ FX category enabled (previously blocked)
- ✅ Build successful, all tests passing
- 📚 Comprehensive documentation created

---

**Last Updated:** January 11, 2026
**Maintained By:** Portfolio Tracker Development Team
