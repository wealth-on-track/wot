# Price Update System - Architecture & Rules

## 8-Category System Overview

| # | Category | Price API | Update Schedule | Metadata API | Metadata Update | Logo API | Currency |
|---|----------|-----------|-----------------|--------------|-----------------|----------|----------|
| 1 | BIST | Yahoo (.IS) | Hourly (skip 00:00-08:00) | Yahoo→Alpha→Finnhub | Import only | Logodev→GitHub CDN | TRY |
| 2 | TEFAS | TEFAS API (exclusive) | Hourly (skip 00:00-08:00) | TEFAS API | Import only | Letter placeholder | TRY |
| 3 | US_MARKETS | Yahoo | Hourly (skip 00:00-08:00) | Yahoo→Alpha→Finnhub | Import only | Logodev→Clearbit→Icons8 | USD |
| 4 | EU_MARKETS | Yahoo (suffix) | Hourly (skip 00:00-08:00) | Yahoo→Finnhub | Import only | Logodev→Clearbit→Icons8 | EUR/GBP/CHF |
| 5 | CRYPTO | Yahoo (24/7) | Hourly (skip 00:00-08:00) | Yahoo | Import only | CryptoCompare→Icons8 | Pair-based |
| 6 | COMMODITIES | Synthetic/Yahoo | Hourly (skip 00:00-08:00) | Manual | Import only | Icons8 | TRY/USD |
| 7 | FX | Yahoo (=X) | Hourly (skip 00:00-08:00) | Manual | Import only | Country flags | Pair-based |
| 8 | CASH | Fixed (1.0) | No update | Manual | Import only | Currency symbols | Symbol |

## Implementation Details

### 1. Price Update Service (`src/services/priceUpdateService.ts`)

**Category Filtering:**
```typescript
// Filter by category according to the 8-category system rules:
// - TEFAS: Updated separately via TEFAS API (not Yahoo)
// - CASH: Fixed price 1.0, no API update needed
const assetsToUpdate = assets.filter(a =>
  a.category !== 'TEFAS' && a.category !== 'CASH'
);
```

**Update Flow:**
1. Fetch all assets from database with `category` field
2. Filter out TEFAS and CASH categories
3. Check cache freshness (60-minute threshold)
4. Batch fetch prices from Yahoo API (fallbacks: AlphaVantage, Direct Chart, Finnhub)
5. Update currency rates (EURUSD, EURTRY, EURGBP)

**Key Features:**
- ✅ No metadata updates during price sync
- ✅ Respects category-based routing
- ✅ Batch processing with error handling
- ✅ Cache-first strategy (60-minute freshness)

### 2. Hourly Schedule (`src/app/api/cron/update-prices/route.ts`)

**Time-Based Skip Logic:**
```typescript
// Skip updates between 00:00-08:00 UTC+3 (Istanbul time)
const now = new Date();
const istanbulHour = now.getUTCHours() + 3; // UTC+3 for Istanbul
const normalizedHour = istanbulHour >= 24 ? istanbulHour - 24 : istanbulHour;

if (normalizedHour >= 0 && normalizedHour < 8) {
  return { skipped: true, message: "Night hours (00:00-08:00)" };
}
```

**Rationale:**
- Markets are closed during night hours
- Saves API quota
- Reduces unnecessary database writes

### 3. TEFAS Price Updates

**Separate Flow:**
- TEFAS prices are fetched via `getMarketPrice` action when viewing portfolio
- Uses TEFAS API exclusively (not Yahoo)
- Cached in `priceCache` table with `source: 'TEFAS'`
- No hourly background updates (on-demand only)

### 4. CASH Price Handling

**Fixed Value:**
- CASH assets have fixed price of 1.0
- No API updates needed
- Portfolio calculations use `quantity * 1.0 = quantity`
- Currency conversion applied at display time

### 5. Metadata Updates

**Import-Time Only:**
- Metadata (sector, country) fetched during asset import via search/add flow
- Stored in `priceCache` table
- Synced to `asset` table on creation
- **No automatic updates** during price refresh

**Manual Refresh:**
- Admin endpoint: `/api/admin/refresh-metadata`
- Requires authentication
- Uses tiered fallbacks: Yahoo → AlphaVantage → Finnhub → Manual mapping

### 6. Logo System (`src/lib/logos.ts`)

**Category-Based Routing:**
```typescript
// TEFAS: Letter placeholder (no API)
if (exchange === 'TEFAS') return null;

// CRYPTO: CoinCap CDN
if (type === 'CRYPTO') return `https://assets.coincap.io/assets/icons/${symbol}@2x.png`;

// CASH/CURRENCY: Local SVG files
if (type === 'CASH') return `/icons/currency/${symbol.toLowerCase()}.svg`;

// COMMODITIES: Icons8 static URLs
if (type === 'COMMODITY') return 'https://img.icons8.com/color/96/gold-bars.png';

// BIST: GitHub CDN
if (symbol.includes('.IS')) return `https://cdn.jsdelivr.net/gh/.../logos/${symbol}.png`;

// US/EU STOCKS: Logo.dev API
return `https://img.logo.dev/ticker/${symbol}?token=${apiKey}`;
```

**Key Principles:**
- ✅ No runtime API calls (except Logo.dev which is client-side cached)
- ✅ Static URLs for reliability
- ✅ Category-specific providers
- ✅ Fallback to placeholders

## Database Schema

### `priceCache` Table
```prisma
model PriceCache {
  symbol        String   @id
  previousClose Float
  currency      String
  tradeTime     DateTime?
  updatedAt     DateTime @updatedAt
  source        String?   // 'YAHOO', 'TEFAS', 'ALPHA', 'FINNHUB', etc.
  sector        String?   // Metadata (import-time only)
  country       String?   // Metadata (import-time only)
}
```

### `asset` Table
```prisma
model Asset {
  id          String        @id @default(cuid())
  portfolioId String
  category    AssetCategory @default(US_MARKETS)
  symbol      String
  type        String
  quantity    Float
  buyPrice    Float
  currency    String
  sector      String?       // Synced from priceCache on import
  country     String?       // Synced from priceCache on import
  // ...
}
```

## API Usage Summary

### Price Updates (Hourly)
- **Yahoo Finance**: BIST, US_MARKETS, EU_MARKETS, CRYPTO, FX, COMMODITIES
- **TEFAS API**: TEFAS (on-demand, not hourly)
- **None**: CASH (fixed 1.0)

### Metadata (Import-Time Only)
- **Yahoo → AlphaVantage → Finnhub**: All categories except TEFAS, CASH, COMMODITIES, FX
- **TEFAS API**: TEFAS
- **Manual Mapping**: CASH, COMMODITIES, FX

### Logos (Static URLs)
- **CoinCap CDN**: CRYPTO
- **Local SVG**: CASH
- **Icons8**: COMMODITIES
- **GitHub CDN**: BIST
- **Logo.dev**: US_MARKETS, EU_MARKETS
- **Letter Placeholder**: TEFAS

## Monitoring & Telemetry

All API requests are tracked in `apiRequestLog` table:
```typescript
await trackApiRequest(provider, isSuccess, {
  endpoint: 'chart',
  params: symbol,
  duration: elapsed,
  error: errorMessage
});
```

**Providers Tracked:**
- `YAHOO`
- `YAHOO_DIRECT`
- `ALPHA_VANTAGE`
- `FINNHUB`
- `TEFAS`
- `LOGODEV`

**View Logs:**
- Admin Panel: `/admin/requests`
- Filter by provider, status, time range
- Track API quota usage

## Testing

### Manual Price Update
```bash
curl https://wot.money/api/cron/update-prices
```

### Check Category Distribution
```sql
SELECT category, COUNT(*) as count
FROM Asset
GROUP BY category;
```

### Verify Price Freshness
```sql
SELECT symbol, updatedAt, source
FROM PriceCache
WHERE updatedAt < NOW() - INTERVAL '1 hour'
ORDER BY updatedAt DESC;
```

## Troubleshooting

### Issue: TEFAS prices not updating
- **Solution**: TEFAS uses on-demand updates, not hourly. Prices refresh when user views portfolio.

### Issue: Night-time API errors
- **Solution**: Updates skip 00:00-08:00 Istanbul time. Check cron response for `skipped: true`.

### Issue: Missing sector/country
- **Solution**: Metadata is import-time only. Use `/api/admin/refresh-metadata` to backfill.

### Issue: Logo not loading
- **Solution**: Check category-specific provider. TEFAS uses placeholders, BIST uses GitHub CDN, etc.

## Future Improvements

1. **TEFAS Hourly Updates**: Add background job for TEFAS price updates (optional)
2. **Smart Scheduling**: Skip updates during known market holidays
3. **Webhook Support**: Real-time price updates via WebSocket
4. **Multi-Currency Support**: Add CHF, CAD, AUD exchange rates
5. **Historical Data**: Store daily closing prices for charting

---

**Last Updated**: 2026-01-11
**Version**: 2.0 (8-Category System)
