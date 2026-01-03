# Changelog

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
