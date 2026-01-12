# Exchange-Based Country Detection

## Overview

This feature automatically detects the country of an asset based on its stock exchange information. It serves as a fallback when Yahoo Finance API doesn't provide country metadata for certain assets (like ING Groep, certain European stocks, etc.).

## How It Works

### Detection Strategy

The system uses a two-tier approach:

1. **Exchange Name Matching** (Primary)
   - Checks exchange name from API (e.g., "NYSE", "BIST", "AMS")
   - Uses case-insensitive partial matching
   - Example: `"NASDAQ-GS"` → `"United States"`

2. **Symbol Suffix Matching** (Fallback)
   - Parses symbol suffix after the dot (e.g., `"INGA.AS"` → `".AS"`)
   - Maps suffix to country
   - Example: `".AS"` → `"Netherlands"`

### Priority

Yahoo Finance data is **always preferred**. Exchange-based detection only activates when:
- Yahoo doesn't provide country information, OR
- Country field is empty/whitespace

## Supported Exchanges

### Europe
| Exchange/Suffix | Country | Example |
|----------------|---------|---------|
| AMS, .AS | Netherlands | INGA.AS (ING Groep) |
| BIST, .IS | Turkey | THYAO.IS (Turkish Airlines) |
| FRA, XETRA, .DE | Germany | SIE.DE (Siemens) |
| LSE, LON, .L | United Kingdom | SHEL.L (Shell) |
| EPA, PAR, .PA | France | MC.PA (LVMH) |
| MIL, .MI | Italy | ENI.MI (Eni) |
| BME, .MC | Spain | SAN.MC (Santander) |
| SWX, .SW | Switzerland | NESN.SW (Nestlé) |
| OSL, .OL | Norway | - |
| CPH, .CO | Denmark | - |
| HEL, .HE | Finland | NOKIA.HE |
| STO, .ST | Sweden | VOLV-B.ST (Volvo) |

### Americas
| Exchange/Suffix | Country | Example |
|----------------|---------|---------|
| NYSE, NASDAQ | United States | AAPL (Apple) |
| TSX, .TO | Canada | - |
| BVMF, .SA | Brazil | - |
| BMV, .MX | Mexico | - |

### Asia-Pacific
| Exchange/Suffix | Country | Example |
|----------------|---------|---------|
| TSE, .T | Japan | 7203.T (Toyota) |
| HKSE, HKG, .HK | Hong Kong | 0700.HK (Tencent) |
| SSE, .SS | China (Shanghai) | - |
| SZSE, .SZ | China (Shenzhen) | - |
| NSE, .NS | India | RELIANCE.NS |
| BSE, .BO | India | - |
| KRX, .KS | South Korea | 005930.KS (Samsung) |
| TWSE, .TW | Taiwan | - |
| SGX, .SI | Singapore | - |

### Middle East & Africa
| Exchange/Suffix | Country | Example |
|----------------|---------|---------|
| TADAWUL, .SR | Saudi Arabia | - |
| JSE, .JO | South Africa | - |

## Usage

### Automatic Detection

The system works automatically when adding new assets:

```typescript
// In InlineAssetSearch or ManualAssetModal
// When user searches for "ING Groep":
// 1. Yahoo returns symbol: INGA.AS
// 2. Yahoo returns exchange: "AMS"
// 3. Yahoo returns country: "" (empty!)
// 4. System detects: .AS → Netherlands ✅
// Result: Country field auto-filled with "Netherlands"
```

### Manual Override

Users can always manually edit the country field in `EditAssetModal`:
- Even if auto-detection worked
- To correct any mistakes
- For exotic exchanges not in the mapping

## Examples

### Before This Feature
```typescript
// Search: "ING Groep"
{
  symbol: "INGA.AS",
  exchange: "AMS",
  country: "",        // ❌ Empty!
  sector: ""
}
```

### After This Feature
```typescript
// Search: "ING Groep"
{
  symbol: "INGA.AS",
  exchange: "AMS",
  country: "Netherlands",  // ✅ Auto-detected from .AS suffix
  sector: ""              // User can manually fill
}
```

## Edge Cases

### No Exchange Info
```typescript
// Symbol: "AAPL" (no suffix)
// Exchange: undefined
// Result: country remains empty
// Action: User manually fills or it uses Yahoo data if available
```

### Unknown Exchange
```typescript
// Symbol: "XYZ.ZZ" (unknown suffix)
// Exchange: "UNKNOWN_EXCHANGE"
// Result: country remains empty
// Action: User manually fills
```

### Conflicting Info
```typescript
// Exchange: "NYSE" (US)
// Symbol: "SYMBOL.AS" (Netherlands suffix)
// Result: Prefers exchange name → "United States"
// Reason: Exchange name is more reliable than suffix
```

## Implementation Files

1. **`src/lib/exchangeToCountry.ts`**
   - Core mapping logic
   - `getCountryFromExchange()` function
   - ~180 lines

2. **`src/lib/actions.ts`**
   - `getAssetMetadata()` integration
   - Fallback logic
   - ~10 lines added

3. **`src/__tests__/lib/exchangeToCountry.test.ts`**
   - 17 test cases
   - 100% coverage of edge cases

## Testing

```bash
# Run tests
npm run test

# Specific test file
npm run test exchangeToCountry

# Watch mode
npm run test -- --watch
```

### Test Coverage

- ✅ Exchange name matching (case-insensitive)
- ✅ Symbol suffix matching
- ✅ Priority (exchange over suffix)
- ✅ Edge cases (undefined, empty, unknown)
- ✅ Real-world examples (ING, THYAO, Siemens, Shell)

## Maintenance

### Adding New Exchanges

To add a new exchange, edit `src/lib/exchangeToCountry.ts`:

```typescript
// For exchange name
const EXCHANGE_TO_COUNTRY: Record<string, string> = {
  // ... existing
  'NEW_EXCHANGE': 'Country Name',
};

// For symbol suffix
const SUFFIX_TO_COUNTRY: Record<string, string> = {
  // ... existing
  'XX': 'Country Name',  // For symbols like ABC.XX
};
```

### Common Additions

If users frequently encounter unmapped exchanges, check:
1. Admin panel → Data Overview → Country distribution
2. Assets with empty country field
3. User feedback

Add the most requested exchanges to the mapping.

## Benefits

✅ **Zero API Calls** - Instant, no rate limits
✅ **No Maintenance** - Exchanges rarely change
✅ **High Accuracy** - Exchange info is standardized
✅ **Backward Compatible** - Doesn't break existing data
✅ **User Control** - Manual override always available
✅ **Sector Flexibility** - Users can add sector info as needed

## Limitations

❌ **Sector Detection** - Not included (user fills manually)
❌ **100% Coverage** - Some exotic exchanges may be missing
❌ **Suffix Ambiguity** - Rare cases where suffix is ambiguous

For sector information, users should:
- Check the asset details from their broker
- Use EditAssetModal to manually add sector
- Sector is optional for portfolio analysis

---

**Last Updated**: January 2026
**Version**: 1.0
