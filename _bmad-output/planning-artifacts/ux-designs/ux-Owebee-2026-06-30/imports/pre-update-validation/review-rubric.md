# Spine Pair Review — Owebee

> Archived pre-update review. Findings were used to produce the canonical contracts in this workspace.

## Overall verdict

The UX specification contains strong product reasoning, unusually good offline/error-state thinking, and useful implementation guidance. As a downstream UX contract, however, it is **not ready in the current BMad format**: the single 834-line document does not provide the machine-readable `DESIGN.md` plus behavioral `EXPERIENCE.md` pair, its journeys are not evidence-shaped around named protagonists and climax beats, and several components and states remain generic rather than surface-specific.

The document should be treated as a rich source for an Update/migration, not discarded. Most of the work is preservation and restructuring; the principal net-new design work is closing authentication/account surfaces, the end-to-end offline-sync journey, per-surface state coverage, and component-level visual contracts.

## 1. Flow coverage — broken

The five PRD flows at `prd.md:1084–1135` were compared with the five UX journeys at `ux-design.md:179–322`.

### Findings

- **High** — None of the five UX journeys uses a named protagonist, situational context, or an explicit climax beat, so the flows cannot demonstrate comprehension and emotional closure as required by the current experience-spine contract (`ux-design.md:179–322`). *Fix:* Rewrite each as numbered steps around a named person and mark the decisive outcome as `**Climax:**`.
- **High** — PRD Flow 1 begins with registration or sign-in, while “Create and Invite” starts at the Trips surface; the registration/authentication segment has no UX journey or screen contract (`prd.md:1084–1092`; `ux-design.md:181–207`). *Fix:* Extend the journey from unauthenticated entry through authentication, trip creation, and invite readiness.
- **High** — PRD Flow 4 is an end-to-end offline creation and reconnection journey, but the UX splits this across one branch of “Add a Typical Expense” and a later conflict-resolution flow; the normal `pending → reconnect → syncing → synced` path is not walked (`prd.md:1115–1124`; `ux-design.md:235–270`, `299–321`). *Fix:* Add a dedicated offline expense and recovery journey, including app restart and local durability.

## 2. Token completeness — broken

The visual token table at `ux-design.md:593–645` was checked against the current `DESIGN.md` token schema.

### Findings

- **Critical** — There is no `DESIGN.md` YAML frontmatter, so colors, typography, spacing, rounded values, and component tokens are not machine-readable and no `{path.to.token}` references can resolve (`ux-design.md:593–645`). *Fix:* Migrate the visual system into canonical `DESIGN.md` frontmatter and reference tokens from prose and `EXPERIENCE.md`.
- **High** — No `components` token object exists. The document names visual components but supplies mostly global colors, radii, and shadows rather than component-specific token mappings (`ux-design.md:492–563`, `761–772`). *Fix:* Define component tokens for the app shell/navigation, buttons, fields, expense rows, balance rows, sync status, dialogs/sheets, and invite controls.
- **High** — The border token assigned to inputs is `#CBD5E1`; against the white surface it measures approximately 1.48:1, below the specification’s stated 3:1 UI-boundary target (`ux-design.md:511`, `612`). *Fix:* Use a darker boundary token or ensure an additional non-color boundary that independently meets the requirement.

## 3. Component coverage — broken

Component names in screen specifications, the component/state contract, and the developer handoff were compared.

### Findings

- **High** — The required shared components do not have paired visual and behavioral contracts. `Expense row/card`, `Balance summary`, `participant/family balance row`, `Sync Center`, `share stepper`, `select/combobox`, and `invite link field` are named for implementation but lack complete component rows covering anatomy, interaction, states, and visual tokens (`ux-design.md:761–772`). *Fix:* Add one canonical component inventory shared by `DESIGN.md.Components` and `EXPERIENCE.md.Component Patterns`, with identical names.
- **Medium** — The generic contracts for buttons, form controls, disclosure, dialogs, messages, and sync states are useful but do not state where variants are allowed or how composite components coordinate focus, optimistic updates, and failure recovery (`ux-design.md:492–563`). *Fix:* Preserve these rules and attach them to the named composites that consume them.

## 4. State coverage — thin

Every IA surface at `ux-design.md:125–155` was walked against screen and state specifications.

### Findings

- **High** — “Every data region must define” is a checklist, not a surface-state contract. Trips, Overview, Expenses, Balance, People, Settings, Account, invite preview, and authentication do not each map cold-load, empty, refresh, error, offline, permission-loss, and focus behavior (`ux-design.md:549–563`). *Fix:* Add a surface-by-state matrix and mark genuinely inapplicable cells explicitly.
- **High** — Welcome/sign-in, registration, and Account appear in the IA but have no screen specifications, despite authentication being part of the first PRD flow (`ux-design.md:129–154`, `325–488`). *Fix:* Add these surfaces or remove them from IA with a sourced rationale.

## 5. Visual reference coverage — thin

No files exist under `mockups/`, `wireframes/`, or `imports/`. The document contains inline text diagrams for flows, Trip Overview, and a balance row.

### Findings

- **Medium** — There are no persistent key-screen references for the mobile expense form, guest join, Sync Center/conflict comparison, People/family editing, or responsive navigation. The PRD still says wireframes are TBD (`prd.md:1380–1384`). *Fix:* Produce a minimal set of key-screen mockups or wireframes, link each inline, and state once that the spines win on conflict.

## 6. Bloat & overspecification — thin

The document was checked for upstream duplication and mixed ownership.

### Findings

- **Medium** — The single file repeats product goals, personas/jobs, success metrics, analytics events, requirement traceability, and frontend constraints while also owning design tokens and interaction behavior (`ux-design.md:13–123`, `750–819`). This increases drift risk and makes source extraction expensive. *Fix:* Keep sources by reference; move appearance to `DESIGN.md`, behavior to `EXPERIENCE.md`, and leave analytics/architecture ownership upstream unless a UX decision depends on it.
- **Low** — Several implementation details are valuable but over-specific for UX ownership, such as stable client IDs and authoritative calculation rules (`ux-design.md:750–759`). *Fix:* Retain them as source-linked constraints or architecture notes rather than UX spine rules.

## 7. Inheritance discipline — thin

Both source artifact paths resolve, and the architecture establishes React + TypeScript + Vite without naming a UI component system.

### Findings

- **High** — Requirement traceability omits `FR-022`, `NFR-001`, `NFR-005`, and `NFR-009`, and it lists IDs rather than preserving requirement names verbatim (`ux-design.md:805–819`; `prd.md:529–678`). `FR-022` may be intentionally out of MVP, but that decision is not recorded here. *Fix:* Add a complete source coverage table with `covered`, `deferred`, or `not UX-relevant` and a rationale.
- **Medium** — Sources are prose metadata rather than resolvable frontmatter, and no shared UI system is inherited (`ux-design.md:3–9`; `architecture.md:1471–1490`). *Fix:* Add canonical `sources:` frontmatter. Either name a UI system and specify deltas or fully specify every custom component.

## 8. Shape fit — broken

The document was compared with the current `DESIGN.md` and `EXPERIENCE.md` canonical shapes.

### Findings

- **High** — The required peer contracts are absent. Visual identity, behavior, accessibility, responsive rules, analytics, and architecture guidance are blended in one document, so downstream consumers cannot reliably determine ownership or precedence. *Fix:* Migrate into `DESIGN.md` and `EXPERIENCE.md`; preserve this file as an import/source during migration.
- **Medium** — Required experience sections are only partially represented: Foundation is implicit, Voice and Tone is missing as a microcopy contract, Interaction Primitives are scattered, and Key Flows do not meet journey shape. *Fix:* Reassemble the existing material under the canonical experience sections and close the identified gaps.

## Mechanical notes

- Both declared source files resolve.
- No `mockups/`, `wireframes/`, or `imports/` artifacts exist, so there are no orphaned visual files.
- The source PRD and architecture use compatible core glossary terms; the UX translation table changes `Personal share` to the shorter UI term `Share`, which is reasonable but should be recorded as an intentional UI-label mapping.
- The architecture names React + TypeScript + Vite but no component library; a full custom component contract is therefore required unless a UI system is selected.
- The document’s Mermaid requirement is not applicable: diagrams are fenced as plain text.
