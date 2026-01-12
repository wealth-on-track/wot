# Portfolio Currency Column Display Fix

## Problem

Portfolio table was showing duplicate values when an asset's currency matched the selected reporting currency.

**Example:**
- User selects EUR as reporting currency
- Asset in EUR shows:
  - "Total Value / Total Cost" column: €1,000 / €800
  - "Total Value (EUR) / Total Cost (EUR)" column: €1,000 / €800
  - **Issue**: Same value shown twice, creating redundancy

## User Requirement

**Systematic Logic:**
```
IF asset.currency === selectedCurrency THEN
  - Left column (Total Value / Total Cost): Show "-" (empty)
  - Right column (Total Value ({Currency}) / Total Cost ({Currency})): Show value

ELSE (different currency)
  - Left column: Show in asset's native currency
  - Right column: Show converted to selected currency
```

**Purpose**: Users can differentiate between assets in different currencies (shown in both columns) and assets matching the reporting currency (shown only in right column).

## Examples

### Scenario 1: Selected Currency = EUR

| Asset | Currency | Total Value / Total Cost | Total Value (EUR) / Total Cost (EUR) |
|-------|----------|--------------------------|--------------------------------------|
| AAPL  | USD      | $10,000 / $8,000        | €9,200 / €7,360                     |
| ASML  | EUR      | -                        | €5,000 / €4,000                     |
| TUBORG| TRY      | ₺50,000 / ₺45,000       | €1,471 / €1,324                     |

### Scenario 2: Selected Currency = USD

| Asset | Currency | Total Value / Total Cost | Total Value (USD) / Total Cost (USD) |
|-------|----------|--------------------------|--------------------------------------|
| AAPL  | USD      | -                        | $10,000 / $8,000                     |
| ASML  | EUR      | €5,000 / €4,000         | $5,435 / $4,348                      |
| BTC-USD| USD     | -                        | $50,000 / $45,000                    |

### Scenario 3: Selected Currency = TRY

| Asset | Currency | Total Value / Total Cost | Total Value (TRY) / Total Cost (TRY) |
|-------|----------|--------------------------|--------------------------------------|
| AAPL  | USD      | $10,000 / $8,000        | ₺340,000 / ₺272,000                  |
| TUBORG| TRY      | -                        | ₺50,000 / ₺45,000                    |
| GAUTRY| TRY      | -                        | ₺25,000 / ₺23,000                    |

## Implementation

### Files Modified
- [/src/components/DashboardV2.tsx](../src/components/DashboardV2.tsx)

### Changes Applied

#### 1. PRICE Column (Lines 755-790)

**Old Behavior**: Always showed price in selected currency or native (based on toggle)

**New Behavior**:
```typescript
case 'PRICE':
    if (asset.currency === globalCurrency) {
        // Same currency - show "-" (value shown in PRICE_EUR column)
        cellContent = <div>-</div>;
    } else if (asset.type === 'CASH') {
        // CASH always shows "-"
        cellContent = <div>-</div>;
    } else {
        // Different currency - show in native currency
        cellContent = <div>{nativeSymbol}{fmt(nativePrice)}</div>;
    }
    break;
```

#### 2. PRICE_EUR Column (Lines 792-819)

**New Behavior**: Always shows price in selected global currency
```typescript
case 'PRICE_EUR':
    if (asset.type === 'CASH') {
        cellContent = <div>-</div>;
    } else {
        // Always show in global currency
        cellContent = <div>{globalSymbol}{fmt(globalPrice)}</div>;
    }
    break;
```

#### 3. VALUE Column (Lines 820-847)

**Old Behavior**: Always showed total value/cost

**New Behavior**:
```typescript
case 'VALUE':
    if (asset.currency === globalCurrency) {
        // Same currency - show "-" (value shown in VALUE_EUR column)
        cellContent = <div>-</div>;
    } else if (asset.type === 'CASH') {
        // Different currency CASH - show in native currency
        cellContent = <div>{nativeSymbol}{fmt(asset.quantity)}</div>;
    } else {
        // Different currency asset - show in native currency
        cellContent = <div>{nativeSymbol}{fmt(nativeTotalValue)}</div>;
    }
    break;
```

#### 4. VALUE_EUR Column (Lines 849-876)

**Unchanged**: Always shows total value/cost in selected global currency

## Systematic Solution

The fix applies a single rule consistently across all currency-related columns:

```
Rule: IF (asset.currency === globalCurrency) THEN
        Show value ONLY in the global currency column (right)
      ELSE
        Show value in BOTH columns (native + converted)
```

This rule applies to:
- ✅ PRICE column
- ✅ PRICE_EUR (or PRICE_USD, PRICE_TRY, etc.) column
- ✅ VALUE (Total Value / Total Cost) column
- ✅ VALUE_EUR (or VALUE_USD, VALUE_TRY, etc.) column

## Benefits

1. **No Redundancy**: Same value never shown twice in a row
2. **Clear Differentiation**: Users can immediately see which assets are in different currencies
3. **Systematic**: Works for any currency selection (EUR, USD, TRY, GBP, JPY, etc.)
4. **Automatic**: No manual user action needed
5. **Scalable**: Works with any asset currency without hardcoding

## Edge Cases Handled

### 1. CASH Assets
- CASH in same currency: Shows only in right column
- CASH in different currency: Shows in both columns
- CASH never shows price (always "-")

### 2. Crypto Assets
- BTC-USD when USD selected: Shows only in right column
- BTC-EUR when USD selected: Shows EUR in left, USD in right
- ETH-EUR when EUR selected: Shows only in right column

### 3. Commodities
- GAUTRY (TRY) when TRY selected: Shows only in right column
- GAUTRY (TRY) when EUR selected: Shows TRY in left, EUR in right
- XAU (XAU) when any currency: Always shows both (XAU ≠ reporting currency)

### 4. Multi-Currency Portfolio
User with EUR, USD, and TRY assets can see:
- EUR assets: Only in EUR column
- USD assets: USD (left) + EUR (right)
- TRY assets: TRY (left) + EUR (right)

## Testing

To test the fix:
1. Add assets in different currencies (EUR, USD, TRY)
2. Change reporting currency in navbar (EUR → USD → TRY)
3. Verify:
   - Assets matching selected currency show only in right column (with "-" in left)
   - Assets in different currencies show in both columns
   - CASH assets follow same rule
   - Crypto assets follow same rule
   - Price and Value columns behave consistently

## Notes

- The fix preserves all existing functionality
- No changes to data fetching or calculations
- Only affects UI display logic
- Column headers update dynamically (EUR/USD/TRY based on selection)
- Works with existing currency conversion system
