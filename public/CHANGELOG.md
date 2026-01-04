# Changelog

## v136 - 04/01/2026 20:55
- UI: **Total Cost Basis**. The "Value" column now displays the asset's total cost basis (Buy Price × Quantity) in its original currency, faded underneath the current market value.
- UI: **Compact Rows**. Significantly reduced row height and vertical padding to fit more assets on a single screen.
- UI: **Maximized Fonts**. Font sizes have been increased again to use all available space.
- UI: **Strict Header Alignment**. Numeric headers (Price, Value, P&L) are now strictly right-aligned to match their data.

## v135 - 04/01/2026 20:38
- UI: **Maximize Screen Real Estate**. Significantly increased font sizes and adjusted column proportions to fill the entire dashboard width, eliminating whitespace.
- UI: **Strict Alignment**. Text columns (Name, Portfolio, Type) are now strictly Left Aligned, while Numeric columns (Price, Value, P&L) are strictly Right Aligned.
- UI: **Enhanced Readability**. Larger numbers and text for better visibility on wide screens.

## v134 - 04/01/2026 20:25
- UI: **Dynamic Currency Headers**. Removed "(Org)" labels. Headers like "PRICE (€)" or "P&L (€)" now automatically update to reflect the selected global currency (e.g., "PRICE ($)" or "P&L ($)" when viewing in USD).
- Fix: **Native vs Global Columns**. "Price" and "Value" columns now strictly show the asset's original currency values, while the converted columns strictly follow the user's selected global currency.

## v133 - 04/01/2026 20:20
- UI: **Default Column Reset**: Updated the "Adjust List" menu button to **"Default"**. Clicking it now restores the optimal column layout: Portfolio -> Name -> Price -> Value -> Price (€) -> Value (€) -> P&L.

## v132 - 04/01/2026 20:15
- UI: **List View Only**. The dashboard has been streamlined to exclusively use the List view. Grid and Card view options have been removed.
- UI: **Optimized Default Columns**. The default column layout has been updated to: Portfolio -> Name -> Price (Org) -> Value (Org) -> Price (€) -> Value (€) -> P&L.
- UI: **Enhanced Metric Visibility**. Restored the faded "Cost" display under Price columns and the "Amount" display under the P&L percentage for better data density.
- Feature: **Smart P&L Currency**. The P&L column now automatically defaults to Euro (€) when "Original" currency mode is active, or follows the global currency selection otherwise.

## v131 - 04/01/2026 19:42
- UI: **Removed Column Separators**. Completely removed the vertical lines (`border-right`) from the Asset Table (Headers, Groups, and Rows) based on user feedback. The table structure now relies purely on grid alignment.

## v129 - 04/01/2026 19:40
- UI: **Absolute Column Separation (abc/def Mode)**. Eliminated all horizontal gaps and inter-row/group spaces. Vertical separators now form a 100% solid, unbroken line from the top of the table to the bottom.
- UI: Removed all `border-bottom` from rows and group headers to prioritize continuous vertical flow.
- UI: Strengthened vertical dividers to `rgba(0,0,0,0.6)` for a bold, architectural grid appearance.
- Fix: Removed legacy margins from group wrappers that were breaking column continuity.

## v128 - 04/01/2026 19:35
- UI: **Absolute Vertical Continuity**. Rebuilt the Asset Group headers to utilize the same internal grid system as the asset list. This allows the vertical dividers to extend seamlessly from the header through group titles to the bottom of the table.
- UI: **Solid Grid Architecture**. Removed all inter-row and inter-group margins and padding to ensure a 100% flush, gap-free table layout with prominent vertical separators.
- UI: Increased vertical divider opacity to 0.4 for a crisp, professional black-line grid appearance.

## v127 - 04/01/2026 19:15
- UI: **Unified Table Structure**. Merged the header and asset list into a single, seamless container to eliminate all visual gaps.
- UI: **True Column Separators**. Vertical lines are now perfectly continuous from the very top to the bottom of the table, regardless of rows or groups.
- UI: Removed all inter-row and inter-group margins for a solid, premium grid block.

## v126 - 04/01/2026 19:00
- UI: **'Black Line' Appearance**. Increased divider opacity to 0.3 for vertical and 0.18 for horizontal lines to create a premium, well-defined grid.
- UI: **Absolute Divider Stability**. Optimized the hover shift mechanism so that vertical separators remain perfectly fixed to the rest of the table while row data slides.
- UI: **Nested Shifting Container**. Content transformation is now strictly isolated to ensure zero layout jump on the grid borders.

## v125 - 04/01/2026 18:40
- UI: **True Continuous Separators**. Moved divider borders into cells and increased opacity to 0.25 to ensure unbreakable vertical lines.
- UI: **Fixed Grid Lines**. Grid lines now remain fixed during hover, while only the content performs the 35px shift.
- UI: Enhanced visibility for horizontal separators (0.15 opacity) for a clearer 'black line' grid appearance.

## v124 - 04/01/2026 18:05
- UI: **Lowered Short-Label Threshold**. Labels like CCY/EXCH. now activate starting at 7+ columns.
- UI: **Continuous Vertical Separators**. Removed row indentation and gaps to ensure vertical divider lines are unbroken from header to bottom.
- UI: **Extreme Compactness**. Further reduced cell padding, font sizes, and row heights for maximum data density.
- UI: Unified separator styles across header and rows for a cleaner grid look.

## v123 - 04/01/2026 17:15
- UI: Implemented **Dynamic Header Labels** (e.g., CCY, EXCH.) when 10+ columns are active.
- UI: Enhanced **Hover Shift**. The entire row content now slides left by 35px on hover to provide clear space for the Gear icon.
- UI: Standardized **Font Sizes**. Portfolio column and numerical columns now use perfectly uniform typography.
- UI: Added **High-Visibility Separators** (darker lines) for better grid structure in all view modes.
- UI: Multi-line headers are now enabled for Value/Price metrics in dense views.

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
