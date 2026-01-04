# Changelog

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
