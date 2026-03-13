# System Architecture

## Environment Isolation

Development and production remain fully isolated for live data.

| Feature | Local / Development | Production / Live |
| :--- | :--- | :--- |
| URL | `http://localhost:3000` | `https://wot.money` |
| Branch | `dev` | `main` |
| Database | `wot-db-dev` | `wot-db` |
| Data Scope | Fake / test data | Real user data |

Code and schema move through Git and deployment. User data does not.

## Agent Team Architecture

The admin architecture now uses a 3-agent model:

1. `Scout`
   Finds opportunities, writes the proposal, attaches evidence, defines expected benefit, rollback plan, and scoped file targets.
2. `Executer`
   Syncs with Scout on the proposal, applies the scoped implementation, and records artifacts.
3. `QA`
   Runs checks, reviews artifacts, and makes the final approve/reject decision.

## Workflow States

Live work stays inside `Proposal`.

1. `proposal`
   Scout-owned discovery and framing.
2. `executer_sync`
   Scout and Executer handoff/resync state before implementation.
3. `execution`
   Executer is applying the scoped code change.
4. `qa_review`
   QA has the work, runs validation, and waits for final approve/reject.

Final work moves to `Completed`.

1. `approved`
2. `reverted`
3. `abandoned_with_reason`

Legacy records that still contain `discover`, `approved_for_build`, `build`, `test`, or `review_ready` are normalized into the new states when read.

## Admin UI Contract

The Agent Team admin screen now exposes only two main menus:

1. `Proposal`
   Contains every non-final item across Scout, Scout/Executer sync, Executer, and QA.
2. `Completed`
   Contains finished items only.

Proposal ordering rules:

1. Processing items appear before untouched Scout-only proposals.
2. Within each group, items are ordered oldest-first.
3. New Scout findings land at the bottom of the Proposal list.

Clicking a proposal opens one screen that shows:

1. The full phase rail from Scout to QA.
2. Timeline updates.
3. Proposal/problem/change documentation.
4. Artifacts.
5. Lessons learned.

## Stall Recovery Rule

Nothing is allowed to remain silently stuck.

If a live item has no progress for `10 minutes`:

1. The system flags it as stalled in the UI.
2. Scout and Executer must re-sync.
3. The discussion is documented in artifacts and timeline events.
4. Work continues from the refreshed handoff instead of remaining idle.

This rule applies even if the item was already in execution. The recovery step is explicit and visible in the Proposal detail screen.
