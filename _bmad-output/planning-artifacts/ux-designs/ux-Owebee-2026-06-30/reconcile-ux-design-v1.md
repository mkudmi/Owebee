# Reconciliation — UX Design Specification v1.0

Source: `imports/ux-design-v1.md`

## Preserved

- Product principles: numbers need sentences, fast path first, local work is real work, calculations explain themselves, and destructive actions are explicit.
- Responsive IA and navigation for public, authenticated, and trip surfaces.
- Five source journeys, expanded into named-protagonist flows with climax and failure beats.
- Expense, balance, family-share, currency-rate, offline, sync, conflict, localization, and accessibility behavior.
- Visual palette, typography, spacing, radii, elevation, and motion rules.
- Developer-facing component inventory and requirement traceability.
- All six open product decisions.

## Refined

- WCAG target raised from 2.1 AA to 2.2 AA.
- `#CBD5E1` retained only as a non-essential divider; interactive boundaries now use `#64748B`.
- Focus changed from a blue ring to a white separation gap plus dark outer ring so it remains visible on primary-blue controls.
- Generic state guidance converted into a surface-by-state contract.
- Component names aligned across visual and behavioral contracts.
- Authentication and Account surfaces received explicit states and accessibility rules.
- Normal offline recovery now has a complete `pending → syncing → synced` journey.

## Relocated

- Visual identity and component appearance moved to `DESIGN.md`.
- Behavior, states, accessibility, responsive rules, and flows moved to `EXPERIENCE.md`.
- The previous validation moved to `imports/pre-update-validation/`.
- The legacy document remains intact except for an archival notice.

## Not promoted

- Analytics event names and backend implementation detail remain in the legacy source and upstream architecture because they are not UX spine ownership.
- No new product scope was introduced.

