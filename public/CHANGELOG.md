# Changelog

## v122 - 04/01/2026 16:55
- Feature: **Content-Shifting Gear**. When hovering over an asset, the P&L text now smoothly slides left to make room for the gear icon on the far right.
- UI: Updated **Next Earnings Date (NED)** in the column selection menu for better clarity while keeping it as **NED** on the dashboard.
- UI: Increased visibility of **vertical column separators** (15-18% opacity) for better data distinction.
- UI: Gear icon is now slightly smaller in ultra-high density mode for a cleaner look.

## v121 - 04/01/2026 16:38
- UI: Shortened **Next Earnings Date** to **NED** in the table header to save space.
- UI: Enabled **2-line headers** so labels can wrap elegantly without being cut off.
- UI: Added **visible vertical separators** between columns for clearer data distinction.
- UI: Further reduced padding and font sizes (to 0.55rem) in extreme density mode to ensure all 12 columns fit on the dashboard.

## v120 - 04/01/2026 16:29
- Feature: **Extreme-Density Mode**. The table now uses a zero-gutter layout and dynamic width scaling for 12+ columns.
- UI: Enforced a strict 120px minimum/cap balance for the **Name** column to prevent pushing other columns off-screen.
- UI: Re-optimized all column widths for better horizontal space utilization.
- UI: Reduced ultra-mode font size to **0.58rem - 0.6rem** to ensure maximum visibility in crowded views.

## v119 - 04/01/2026 16:21
- UI: Shortened column headers (e.g., "Price (Org)") and forced single-line display to prevent wrapping.
- UI: Restored the hover-activated "Gear" settings button for assets.
- UI: Implemented **Ultra-High Density** mode (for 10+ columns) with even smaller fonts (0.62rem) and reduced padding to ensure minimum text occlusion.
- Fix: Enhanced row hover effects and vertical alignment in compact views.

## v118 - 04/01/2026 15:35
- Feature: **Dynamic List Density**. The table now automatically adjusts font sizes, padding, and layout based on the number of selected columns.
- UI: Added subtle vertical separators between columns for better visual structure.
- UI: Improved alignment - non-numeric text is now consistently left-aligned, while financial data remains right-aligned.
- UI: Enhanced text overflow handling (ellipsis) to prevent column overlap in compact views.

## v117 - 04/01/2026 15:02
- UI: Renamed **Price** to **Price (Org. CCY)** and **Value** to **Value (Org. CCY)** in the asset list.
- Versioning: Switched to a simplified versioning format (e.g., v117).

## v1.1.6 - 04/01/2026 14:55
- Feature: Added **Price (€)** and **Value (€)** column options to the asset list. This allows users to track their asset costs and total values in Euro, regardless of the asset's original currency.


## v1.1.5 - 04/01/2026 11:00
- Feature: Added **Total Value** input for pension funds (BES) and ETFs. You can now enter the total amount you have in your account, and the app will automatically calculate the quantity based on the unit price.


## v1.1.4 - 03/01/2026 18:12
- Improvement: Footer version is now clickable and opens a changelog viewer.
- UI: Enhanced footer aesthetics with glassmorphism.

## v1.1.3 - 03/01/2026 17:58
- Documentation: Updated build time and versioning scheme.

## v1.0.4 - 03/01/2026 14:02
- Fix: Resolved drag-and-drop reversion issue by optimistically updating asset ranks locally.
- Fix: Implemented sturdy handling for Yahoo API 429 Rate Limit errors with database fallback.
- Fix: Added unique ID to DndContext to resolve hydration mismatch errors.
- Fix: Ensured asset reordering persists by triggering a router refresh after database update.

## v1.0.3 - 03/01/2026 13:08
- Fix: Resolved build errors in actions.ts.
- Feature: Added version footer to the dashboard.

## v1.0.2 - 03/01/2026 12:53
- Feature: Added timestamp to version display.

## v1.0.1 - 03/01/2026 12:06
- Feature: Initial implementation of versioning and simplified slogan.
