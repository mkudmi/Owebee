# Validation Report — Owebee

> Archived pre-update report. See the workspace root for the current validation.

- **UX specification:** `/Users/mku/Documents/Owebee/_bmad-output/planning-artifacts/ux-design.md`
- **Run at:** 2026-06-30T20:39:06+03:00

## Overall verdict

The UX specification contains strong product reasoning, especially around offline durability, financial comprehension, localization, and recovery. It is not yet a reliable current-format contract for architecture and story development: visual and behavioral ownership is blended, machine-readable tokens are absent, journeys do not meet the named-protagonist/climax shape, and component/state coverage is not closed per surface.

Accessibility is thoughtfully addressed but has two concrete token failures: the input boundary is only 1.48:1 against white, and the focus blue is only 1.30:1 against the primary blue. The existing document is valuable source material and should be migrated rather than rewritten from scratch.

## Category verdicts

- Flow coverage — **broken**
- Token completeness — **broken**
- Component coverage — **broken**
- State coverage — **thin**
- Visual reference coverage — **thin**
- Bloat & overspecification — **thin**
- Inheritance discipline — **thin**
- Shape fit — **broken**
- Accessibility — **adequate, with high-impact gaps**

## Findings by severity

### Critical (1)

**Token completeness — No machine-readable visual contract** (§ Visual System and Design Tokens)  
There is no canonical `DESIGN.md` frontmatter, component token object, or resolvable token-reference graph.  
Fix: Migrate appearance into `DESIGN.md` and use `{path.to.token}` references from both spines.

### High (11)

**Flow coverage — Journeys lack evidence shape** (§ Key Journeys)  
No journey has a named protagonist, situational context, or explicit climax.  
Fix: Rewrite the five source flows as named-person journeys with climax and failure beats.

**Flow coverage — Authentication is skipped** (§ Create and Invite)  
The PRD starts with sign-in/registration; the UX starts from Trips.  
Fix: Extend the journey and specify the missing surfaces.

**Flow coverage — Normal offline recovery is fragmented** (§ Add a Typical Expense / Resolve a Sync Conflict)  
The `pending → reconnect → synced` journey is not walked end to end.  
Fix: Add a dedicated offline/restart/reconnection flow.

**Token completeness — No component tokens** (§ Component and State Contract)  
Composite components cannot inherit deterministic visual rules.  
Fix: Add component token objects with identical names across both spines.

**Component coverage — Shared components are names, not paired contracts** (§ Required Shared Components)  
Expense, balance, sync, and invite composites lack complete visual and behavioral rows.  
Fix: Build one canonical component inventory.

**State coverage — Generic checklist is not surface coverage** (§ Loading, Empty, and Error States)  
Applicable states are not committed per IA surface.  
Fix: Add a surface-by-state matrix.

**State coverage — Authentication and Account surfaces are missing** (§ IA / Screen Specifications)  
They exist in IA but have no screen contracts.  
Fix: Specify them or remove them with rationale.

**Inheritance discipline — Source coverage is incomplete** (§ Requirement Traceability)  
`FR-022`, `NFR-001`, `NFR-005`, and `NFR-009` are absent without disposition.  
Fix: Mark every requirement covered, deferred, or not UX-relevant.

**Shape fit — Canonical peer contracts are absent** (whole document)  
Downstream ownership and precedence are ambiguous.  
Fix: Migrate into `DESIGN.md` plus `EXPERIENCE.md`.

**Accessibility — Input boundary contrast fails** (§ Color Tokens / Form Controls)  
`#CBD5E1` on white is approximately 1.48:1, below 3:1.  
Fix: Use a validated darker interactive-boundary token.

**Accessibility — Focus token fails on primary controls** (§ Color Tokens / Keyboard and Focus)  
`#2563EB` against `#1D4ED8` is approximately 1.30:1.  
Fix: Define a dual or surface-aware focus treatment.

### Medium (9)

**Component coverage — Generic primitives are not attached to composites** (§ Component and State Contract)  
Fix: Map primitive rules to named components.

**Visual references — Key screens lack persistent references** (§ Screen Specifications)  
Fix: Create and link a minimal mock/wireframe set.

**Bloat — Upstream and downstream ownership is mixed** (whole document)  
Fix: Reference sources and split visual from behavioral contracts.

**Inheritance — Sources are prose metadata and no UI system is inherited** (§ Document metadata)  
Fix: Add frontmatter and either select a UI system or fully specify custom components.

**Shape fit — Required experience sections are partial** (whole document)  
Fix: Add explicit Foundation, Voice and Tone, Interaction Primitives, and conforming Key Flows.

**Accessibility — WCAG 2.2 coverage is not explicit** (§ Accessibility target)  
Fix: Adopt WCAG 2.2 AA or document the 2.1 constraint and add relevant 2.2 criteria.

**Accessibility — Forced-colors behavior is not designed** (§ Test Matrix)  
Fix: Add component-level forced-colors rules.

**Accessibility — TalkBack coverage is missing** (§ Test Matrix)  
Fix: Add Android Chrome + TalkBack smoke tests.

**Accessibility — Exact-name deletion may impose avoidable effort** (§ Trip Settings)  
Fix: Validate or offer an equally safe alternative confirmation.

### Low (2)

**Bloat — Architecture details sit in UX ownership** (§ Frontend Constraints)  
Fix: Keep as source-linked constraints.

**Accessibility — Contrast assertions lack a full checked matrix** (§ Color Tokens)  
Fix: Record all state and semantic color pairs in `DESIGN.md`.

## What is already strong

- Offline work is treated as durable user work, not an exceptional failure.
- Financial direction is always expressed in words, not bare signed values.
- Error recovery preserves input and local payloads.
- Localization, reflow, keyboard, focus return, live regions, and reduced motion are concrete.
- Family-share explanations and currency-conversion disclosure are implementation-usable.

## Reviewer files

- `review-rubric.md`
- `review-accessibility.md`
