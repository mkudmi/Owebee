# UX Design Specification: Owebee

- **Project:** Owebee
- **Date:** 2026-06-30
- **Designer:** Codex BMAD UX Designer
- **Version:** 1.0
- **Status:** Ready for implementation planning
- **Source artifacts:** `_bmad-output/planning-artifacts/prd.md`, `_bmad-output/planning-artifacts/architecture.md`
- **Accessibility target:** WCAG 2.1 AA

---

## 1. Design Overview

### 1.1 Product Experience

Owebee is a responsive web/PWA application for tracking shared trip expenses. It must let a first-time guest join without creating a full account, let any participant record a typical expense in under 15 seconds, and make individual and family balances understandable without a spreadsheet or an explanation from the trip owner.

The experience is designed for intermittent connectivity. Offline actions are treated as valid user work: they remain visible, carry an explicit synchronization state, and are never silently discarded.

### 1.2 Design Goals

1. Make the primary mobile actions—join, add expense, and check balance—immediately discoverable.
2. Explain shares, family aggregation, currency conversion, and balance direction in plain language.
3. Preserve user confidence during offline use, retries, conflicts, and delayed exchange-rate lookup.
4. Keep owner-only controls available without exposing destructive actions in primary navigation.
5. Meet WCAG 2.1 AA at 320, 390, 768, 1024, and 1440 px viewports in both Russian and English.

### 1.3 Success Measures

| Measure | Target | Validation method |
|---|---:|---|
| Create trip and copy invite link | ≤ 60 seconds | Moderated first-use test |
| Add a typical expense | ≤ 15 seconds | Timed mobile usability test |
| Guest join completion without owner help | ≥ 90% | Funnel analytics and usability test |
| Correct interpretation of personal balance | ≥ 90% on first attempt | Comprehension test |
| Correct interpretation of family share count | ≥ 80% on first attempt | Comprehension test |
| Critical accessibility violations | 0 | axe, keyboard, VoiceOver/NVDA |
| Lost offline mutations | 0 | Integration and recovery tests |

### 1.4 Design Principles

- **The number needs a sentence.** A signed amount is always accompanied by “You owe,” “You are owed,” or an equivalent participant label.
- **Fast path first, detail on demand.** Defaults support the common expense; rate and split details remain expandable.
- **Local work is real work.** Pending expenses appear in the same list as synced expenses and include text, icon, and status.
- **Explain the calculation where it appears.** Family shares and currency snapshots are disclosed beside the affected total.
- **Safe by construction.** Financial edits are reviewable; destructive trip actions require explicit confirmation.
- **One concept, one term.** “Share,” “family,” “base currency,” and sync-state labels are consistent across UI and help text.

### 1.5 Target Platforms

- Responsive PWA in modern mobile and desktop browsers.
- Minimum supported viewport width: 320 px.
- Portrait and landscape orientation.
- Touch, mouse, keyboard, and screen-reader input.
- Russian and English localization with locale-aware number, date, and currency formatting.

---

## 2. Users and Jobs

### 2.1 Trip Organizer

**Primary jobs**

- Create a trip, choose its base currency, and invite the group.
- Set up participants or families and correct mistakes.
- Monitor the overall balance and close the trip safely.

**Pain points**

- Manual calculation and repeated explanations.
- Fear that another participant entered an expense incorrectly.
- Ambiguity when family members count as multiple people but pay as one unit.

**Design response**

- A guided two-field trip setup followed by a dedicated invite success state.
- Owner actions grouped under trip settings, with role labels and confirmation.
- Family rows always display their share count and offer a calculation breakdown.

### 2.2 Invited Participant

**Primary jobs**

- Join from a link without creating a password.
- Add an expense quickly from a phone.
- Understand the amount they owe or are owed.

**Pain points**

- Low willingness to register for a single trip.
- Unreliable mobile connectivity.
- Financial terminology and unexplained negative numbers.

**Design response**

- Name-and-email guest join with recovery built into the duplicate-email path.
- Offline-capable expense form and persistent sync feedback.
- Plain-language balance summaries with original and converted amounts in details.

### 2.3 Family Representative

**Primary jobs**

- Have the family counted by the correct number of personal shares.
- See and settle one aggregate family balance.

**Pain points**

- A single account incorrectly being treated as one person.
- Multiple family totals that must be recombined manually.

**Design response**

- A family is one display entity with an explicit count such as “2 shares.”
- Expanded rows explain the per-share calculation and aggregate total.

### 2.4 Inclusive-Use Considerations

The design assumes users may have low vision, color-vision differences, limited dexterity, cognitive load from travel, or temporary impairment from glare, motion, or fatigue. Every core action must work without drag gestures, hover, color-only meaning, or precise tapping.

---

## 3. Information Architecture and Navigation

### 3.1 Top-Level Structure

```text
Public
├── Welcome / sign in
├── Register
├── Invite preview
│   ├── Join as guest
│   └── Recover guest access
└── Magic-link result

Authenticated
├── Trips
│   ├── Active
│   └── Archived
├── Create trip
└── Account

Trip workspace
├── Overview
├── Expenses
│   ├── Expense details
│   └── Add/edit expense
├── Balance
│   └── Participant/family breakdown
├── People
│   └── Family editor
└── Trip settings (owner only)
```

### 3.2 Trip Navigation

- **Mobile, below 768 px:** persistent bottom navigation with `Overview`, `Expenses`, `Balance`, and `People`. A centered or visually dominant “Add expense” action appears above the bar or as the primary action on Overview and Expenses. Settings are opened from the trip header.
- **Tablet and desktop, 768 px and above:** left navigation rail (240 px at 1024 px and above; compact at tablet widths), trip switcher at top, and content area with contextual actions.
- The active destination uses text, icon, shape/fill, and `aria-current="page"`; color is not the only cue.
- Navigation order and labels remain identical in Russian and English.
- A “Skip to main content” link is the first focusable element on authenticated pages.

### 3.3 Global Status Layer

A compact network/sync indicator remains available from every trip screen:

- `Offline — changes stay on this device`
- `2 changes waiting`
- `Syncing 1 of 2`
- `All changes synced`
- `1 change needs attention`

The indicator opens the Sync Center. Routine success disappears after five seconds but remains available in the center; offline, pending, failed, and conflict states persist until resolved.

---

## 4. Key Journeys

### 4.1 Create and Invite

```text
[Trips] → [Create trip]
              │
              ├─ name
              └─ base currency
                    │
                    ▼
              [Create]
                    │
        ┌───────────┴────────────┐
        │ success                │ validation/network failure
        ▼                        ▼
[Invite ready]              [Inline error]
  ├─ Copy link                  └─ Preserve input + retry
  ├─ Share
  └─ Open trip
```

**Interaction requirements**

- Name receives focus on entry; the likely base currency is preselected from locale and can be changed.
- After creation, the invite URL is shown in a read-only labeled field.
- “Copy link” changes to “Copied” and announces success with `role="status"`.
- Native share is offered only when supported; copy always remains available.
- The flow is complete when the user copies/shares the link or opens the trip.

### 4.2 Join as Guest

```text
[Invite URL] → [Trip preview]
                    │
                    ▼
             [Name + email]
                    │
              [Join trip]
                    │
       ┌────────────┼──────────────┐
       │ new guest  │ email exists │ invalid/expired invite
       ▼            ▼              ▼
[Trip overview] [Recover access] [Safe error screen]
                    │
               [Email sent]
```

**Interaction requirements**

- Preview includes trip name, owner name if available, base currency, and a clear statement that email is used for access recovery.
- Generic recovery messaging prevents email enumeration.
- Name uses `autocomplete="name"` and email uses `autocomplete="email"`.
- On a reused email, the primary next step is “Email me a sign-in link”; do not ask the user to create a duplicate profile.
- Expired/rotated invites provide a plain explanation and a “Ask the organizer for a new link” action; no dead-end technical error.

### 4.3 Add a Typical Expense

```text
[Add expense]
      │
      ▼
[Quick expense form]
  Amount*       Currency (base default)
  Description*
  Paid by       (current user default)
  Split among   (everyone default)
  Date          (today default)
      │
      ├─ [More options]
      │     ├─ custom shares
      │     └─ exchange-rate details
      ▼
[Review summary in form]
      │
 [Save expense]
      │
 ┌────┼─────────────────────────────┐
 │ online accepted │ offline        │ validation/provider failure
 ▼                 ▼                ▼
[Synced row]   [Waiting row]   [Preserved form + guidance]
```

**Fast-path rules**

- On open, focus Amount and display the currency selector in the same visual group.
- Defaults: current user as payer, today as date, trip base currency, and all active calculation units selected with their configured shares.
- Description may use recent suggestions but remains editable plain text.
- The primary button label includes the formatted amount after it becomes valid, for example `Add €48.20`.
- A sticky mobile action area remains above the virtual keyboard and bottom navigation.
- Saving offline closes the form only after local persistence succeeds and announces: “Saved on this device. It will sync when you’re online.”
- Repeated taps cannot create duplicate expenses; the saving state disables the action and retains an idempotency key.

### 4.4 Review Balance

```text
[Balance]
   │
   ├─ [Your summary: You owe / You are owed / Settled]
   │
   ├─ [Participant and family rows]
   │        └─ Expand → expenses, shares, original amount, rate
   │
   └─ pending local changes?
            └─ Show “May change after sync” notice
```

**Interpretation rules**

- Never show a bare signed amount as the only meaning.
- Current-user summary:
  - negative: `You owe ₽2,500`
  - positive: `You are owed ₽2,500`
  - zero within display precision: `You’re settled`
- Group rows use `Owes`, `Is owed`, or `Settled`, followed by the formatted absolute amount.
- Family rows include a badge such as `Family · 2 shares`.
- The screen states the base currency and last calculation time.
- Pending local expenses trigger an inline notice: `This balance does not include 2 changes waiting to sync.`
- Settlement-transfer suggestions are not implied; MVP shows balances, not a payment matrix.

### 4.5 Resolve a Sync Conflict

```text
[Conflict notification] → [Conflict details]
                                 │
                 ┌───────────────┴───────────────┐
                 │ editable and authorized       │ no longer authorized/deleted
                 ▼                               ▼
       [Compare changed fields]          [Explain server outcome]
          ├─ Use latest version             ├─ Keep local copy as draft
          └─ Apply my values                 └─ Dismiss after export/copy
                 │
                 ▼
              [Retry]
```

**Conflict requirements**

- The unresolved local payload remains stored until the user explicitly resolves or safely copies it.
- Show only changed fields in a two-column comparison labeled “Current trip version” and “Your offline change.”
- Do not expose JSON, version numbers, or HTTP terminology in the default view.
- Applying local values is available only when authorization still permits the edit.
- Resolution result is announced, the balance refreshes, and focus returns to the affected expense row.

---

## 5. Screen Specifications

### 5.1 Trips List

**Purpose:** Start or resume a trip.

**Content order**

1. Page title and account/language actions.
2. Primary `Create trip` action for registered users.
3. Active trips, sorted by most recently updated.
4. Archived trips as a collapsed secondary section.
5. Empty state with one sentence and the create action.

**Trip card**

- Trip name, base currency, role, participant count, last activity.
- Sync warning if this device has unresolved local changes for the trip.
- Entire card is not a nested click target; use one descriptive trip link and separate overflow actions.

### 5.2 Trip Overview

**Purpose:** Answer “What needs my attention?” and expose primary actions.

```text
┌─────────────────────────────────┐
│ Georgia 2026          [Settings]│
│ Base currency: RUB              │
├─────────────────────────────────┤
│ You are owed                    │
│ ₽ 5,000                         │
│ Balance updated 2 min ago       │
│ [View balance]                  │
├─────────────────────────────────┤
│ [ + Add expense ]               │
├─────────────────────────────────┤
│ Recent expenses                 │
│ Hotel      ₽10,000       Synced │
│ Dinner      €48.20      Waiting │
│ [View all expenses]             │
├─────────────────────────────────┤
│ People: 5 shares · 4 entries    │
│ [Invite] [Manage people]        │
└─────────────────────────────────┘
```

At desktop widths, summary, recent expenses, and people become a two-column dashboard; DOM order remains summary → primary action → recent expenses → people.

### 5.3 Expense Form

**Purpose:** Capture the common expense quickly while supporting precise splits and rates.

**Field order**

1. Amount and currency.
2. Description.
3. Payer.
4. Split selector.
5. Expense date.
6. Exchange-rate panel when currency differs from base.
7. Review sentence.
8. Primary save action.

**Validation**

- Validate required fields on blur and on submit, not per keystroke.
- Amount accepts localized decimal input but normalizes to an exact decimal string; no floating-point display artifacts.
- Error text states how to fix the issue and is linked with `aria-describedby`.
- Move focus to the error summary on failed submit; each summary item links to its field.
- Keep every entered value after server, provider, or connectivity errors.

**Split selector**

- Default view is a checklist of participant/family calculation units.
- Each row includes name, type, and configured share count.
- `Select all` uses a checkbox with an indeterminate state when needed.
- Advanced custom shares use numeric stepper/input controls, never drag-only sliders.
- A live summary reads, for example: `Split across 5 personal shares. Ivanov family receives 2 of 5 shares.`

**Exchange-rate panel**

- For same-currency expenses, no rate control is shown.
- For other currencies, show source, rate date, converted preview, and `Use a different rate`.
- Provider loading does not block other fields.
- Provider failure offers manual rate entry with explanation.
- Manual values are labeled `Custom rate` in form, details, and audit history.
- The conversion sentence specifies direction: `€1 = ₽92.50; €48.20 becomes ₽4,458.50`.

### 5.4 Expenses List and Detail

**List row content**

- Description and payer.
- Original amount as primary amount.
- Converted base amount when currencies differ.
- Expense date.
- Sync state with icon and text.
- Edit control only when permitted.

**List behavior**

- Mobile uses stacked rows; desktop may use a semantic table when columns remain readable.
- Filters: payer, date, currency, sync state. Filtering never hides unresolved conflicts by default.
- Loading uses skeleton rows with a screen-reader status.
- Empty state differentiates “No expenses yet” from “No matching expenses.”
- Pagination/infinite loading provides an explicit `Load more` button for keyboard and screen-reader predictability.

**Detail**

- Calculation summary appears before metadata.
- Show payer, included units, each share count, original amount, snapshot/custom rate, base amount, creator, and last edit.
- History is progressive disclosure and uses a chronological list, not color alone.

### 5.5 Balance

**Purpose:** Make financial direction and calculation evidence immediately understandable.

**Row anatomy**

```text
[Avatar/initial] Ivanov family     Family · 2 shares
                 Owes ₽3,200
                 [Show calculation]
```

- Positive/negative color is supplementary to the `Owes`/`Is owed` text and directional icon.
- Expanded calculation lists contributing expenses and ends with the arithmetic summary.
- Long lists are paginated or virtualized only if assistive-technology behavior is verified.
- Values align by decimal position on desktop; use tabular numerals.

### 5.6 People and Families

**Purpose:** Maintain calculation units without hiding the impact of changes.

- Separate headings for participants and families.
- Owner-only create/edit controls include visible `Owner only` context where ambiguity is possible.
- Family editor includes name, personal share count, and explanatory preview:
  `This family appears as one balance row but receives 2 shares in included expenses.`
- Changing a share count warns that future calculations and affected balance views may change; the confirmation names the old and new values.
- Archiving a participant/family must explain whether existing expenses remain unchanged.

### 5.7 Trip Settings

- General: trip name, base currency, interface language preference.
- Invite: copy, share, rotate link. Rotation explicitly warns that the previous link will stop working.
- Lifecycle: archive/unarchive.
- Danger zone: delete.
- Base-currency change requires a review step showing old/new currency and the effect on displayed totals.
- Delete requires typing the exact trip name; paste remains allowed for accessibility. The action button remains disabled until the normalized value matches.

### 5.8 Recovery and Magic-Link States

- Request screen always returns the same accepted state regardless of account existence.
- Sent state displays the entered email in masked form, expiry guidance, resend timing, and a way to correct the address.
- Verification has loading, success, expired, already-used, and generic-failure states.
- Success returns the user directly to the intended trip, not a generic dashboard.

### 5.9 PWA Install

- Installation is optional and never blocks a core task.
- Prompt only after demonstrated value: after joining a trip or adding the first expense.
- Use an in-product explainer with `Install` and `Not now`; respect dismissal.
- On iOS/manual-install platforms, show concise platform-specific steps.
- Offline capability is described accurately; do not promise that every screen or external action works without a connection.

---

## 6. Component and State Contract

### 6.1 Buttons

| Variant | Use | Required states |
|---|---|---|
| Primary | One main action per region | default, hover, focus, active, loading, disabled |
| Secondary | Alternative or supporting action | default, hover, focus, active, disabled |
| Tertiary | Low-emphasis action | default, hover, focus, active, disabled |
| Destructive | Confirmed irreversible action | default, hover, focus, active, loading, disabled |
| Icon button | Compact named action | tooltip plus accessible name |

Minimum target: 48 × 48 px on mobile and 44 × 44 px elsewhere. Loading labels preserve action meaning, such as `Saving expense…`.

### 6.2 Form Controls

- Persistent visible label; placeholder is example text only.
- 48 px minimum height, 16 px minimum input font.
- Default, hover, focus, filled, invalid, disabled, and read-only states.
- Focus ring: 3 px outer ring with at least 3:1 contrast against adjacent colors.
- Required status appears in text or symbol with a legend, never by color alone.
- Currency amount fields use `inputmode="decimal"` and preserve locale input expectations.

### 6.3 Disclosure and Accordion

- Native button trigger with `aria-expanded` and `aria-controls`.
- Chevron is decorative and rotates only when reduced motion is not requested.
- Expanded content follows its trigger in the DOM.
- Balance and family calculations allow multiple rows to remain open for comparison.

### 6.4 Dialogs and Bottom Sheets

- Mobile edit/confirmation surfaces may use full-height sheets; tablet/desktop use centered dialogs up to 600 px.
- Move focus to the dialog title or first invalid field, trap focus, close non-destructive dialogs with Escape, and return focus to the trigger.
- Destructive confirmation does not close on backdrop click.
- Prefer a page over a dialog for the multi-field expense form at 320–767 px.

### 6.5 Toasts and Inline Messages

- Toasts confirm non-critical completion and never contain the only copy of important information.
- Errors related to a field or section appear inline.
- `role="status"` for routine progress/success; `role="alert"` for errors needing immediate attention.
- Toast pause/close controls are keyboard accessible; persistent action-required states do not auto-dismiss.

### 6.6 Sync Status

| State | Label | User action |
|---|---|---|
| Local save in progress | Saving on this device… | Wait |
| `pending` | Waiting to sync | Optional manual retry when online |
| `syncing` | Syncing… | None |
| `synced` | Synced | None |
| `failed` | Couldn’t sync | Retry; view reason |
| `conflict` | Needs attention | Review conflict |

Each state uses a distinct icon, text, and color. Animated indicators stop under `prefers-reduced-motion`.

### 6.7 Loading, Empty, and Error States

Every data region must define:

- Initial loading.
- Background refresh with existing content retained.
- Empty.
- Filtered empty.
- Partial data.
- Recoverable error with retry.
- Permission loss.
- Offline with cache.
- Offline without cache.

Do not replace usable cached content with a full-screen spinner during refresh.

---

## 7. Responsive Behavior

| Viewport | Layout | Navigation | Forms and overlays |
|---|---|---|---|
| 320–767 px | Single column; 16 px page gutters | Bottom trip navigation; compact header | Full-width controls; page-based expense form; bottom sheets for short tasks |
| 768–1023 px | One or two columns; 24 px gutters | Compact left rail | Forms up to 560 px; centered dialogs or sheets |
| 1024–1439 px | Left rail + content; max content 1200 px | Full labeled rail | Two-column supporting content; primary form remains single reading column |
| 1440 px+ | Centered shell; max content 1440 px | Full rail | More whitespace, not denser primary forms |

### 7.1 Reflow Rules

- No horizontal page scroll at 320 px or 200% zoom.
- Long trip names, emails, currency labels, and translated strings wrap without covering controls.
- Financial amounts may wrap as a unit but must not truncate significant digits.
- Sticky bottom actions account for safe-area insets and never cover the final form field or validation message.
- Mobile data tables become semantic card lists; avoid horizontal scrolling for primary financial information.
- On-screen keyboard resize must keep the focused field and primary action reachable.

### 7.2 Content Density

- Body line length: 45–75 characters.
- Financial lists may use denser 12 px vertical gaps on desktop, but touch targets remain at least 44 px.
- Secondary metadata can collapse on mobile but remains available from the same row; essential meaning is never hidden.

---

## 8. Visual System and Design Tokens

The initial product UI already uses dark ink, cobalt, and a cool off-white. Owebee should retain that accessible foundation and use honey as a warm brand accent rather than as the primary action color.

### 8.1 Color Tokens

| Token | Value | Use |
|---|---|---|
| `color-bg` | `#F7F7FB` | App background |
| `color-surface` | `#FFFFFF` | Cards, forms, dialogs |
| `color-text` | `#172033` | Primary text |
| `color-text-muted` | `#4B5563` | Secondary text |
| `color-primary` | `#1D4ED8` | Links, primary buttons, active controls |
| `color-primary-hover` | `#1E40AF` | Hover/pressed |
| `color-brand-honey` | `#F4B942` | Decorative accent, illustration, badges with dark text |
| `color-success` | `#15803D` | Synced/success foreground |
| `color-warning` | `#92400E` | Pending/offline foreground |
| `color-danger` | `#B91C1C` | Error/destructive foreground |
| `color-info` | `#1D4ED8` | Informational foreground |
| `color-border` | `#CBD5E1` | Inputs and dividers |
| `color-focus` | `#2563EB` | Focus ring |

White text is permitted on `color-primary`, `color-primary-hover`, `color-success`, and `color-danger`. Honey uses dark ink text. Semantic tinted backgrounds require the corresponding dark semantic foreground; do not use the raw tint alone for status meaning.

### 8.2 Typography

- Font family: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Body: 16 px / 1.5.
- Small metadata: 14 px / 1.45; never below 12 px.
- H1: 28 px mobile, 36 px tablet, 40 px desktop.
- H2: 24 px mobile, 28 px desktop.
- H3: 20 px mobile, 22 px desktop.
- Monetary totals: 32 px mobile, up to 48 px desktop, weight 700, tabular numerals.
- Use sentence case. Avoid all caps except short decorative brand labels.

### 8.3 Spacing, Radius, and Elevation

- Base spacing unit: 4 px; primary rhythm: 8 px.
- Common spacing: 4, 8, 12, 16, 24, 32, 48, 64 px.
- Control radius: 8 px.
- Card/dialog radius: 12 px.
- Pills/status badges: 999 px.
- Cards: border plus subtle `0 1px 2px rgba(23,32,51,.06)`.
- Dialogs: `0 16px 40px rgba(23,32,51,.18)`.
- Do not rely on elevation alone to separate interactive regions.

### 8.4 Motion

- Routine transitions: 120–200 ms.
- No financial value should animate through misleading intermediate numbers.
- Honor `prefers-reduced-motion: reduce`; remove non-essential motion and use instant state changes.
- Loading indicators may rotate only when they have a static text alternative.

---

## 9. Accessibility Specification

### 9.1 Semantic Structure

- One `h1` per screen; headings do not skip levels.
- Use `header`, labeled `nav`, `main`, and appropriate `section` landmarks.
- Use native links for navigation and buttons for actions.
- Expense tables use `caption`, `th`, and `scope`; card alternatives preserve equivalent labels and order.
- Set document `lang` from the active locale and mark isolated language changes.

### 9.2 Keyboard and Focus

- All operations work with keyboard alone.
- Logical focus order follows DOM and visual order.
- Visible focus indicator is at least 2 px and 3:1 against adjacent colors.
- Opening overlays moves focus inside; closing returns it to the trigger.
- Escape closes non-destructive overlays. No keyboard traps.
- Tab controls, if used, implement arrow, Home, and End keys; do not simulate tabs with plain links.

### 9.3 Visual and Cognitive Access

- Normal text contrast ≥ 4.5:1; large text and UI boundaries ≥ 3:1.
- Status, balance direction, validation, and selection never rely on color alone.
- Text supports 200% zoom and WCAG text-spacing overrides without loss of function.
- Plain-language error text avoids codes. Advanced technical details may be disclosed separately.
- Dates use unambiguous localized display; currency always includes symbol or ISO code where symbols could collide.
- Important confirmation text names the object and effect, not merely “Are you sure?”

### 9.4 Forms and Financial Error Prevention

- Every control has a visible programmatic label.
- Error summary and inline errors are announced and linked.
- Before destructive deletion or impactful base-currency changes, users review and confirm consequences.
- Expense edits show the resulting split/conversion before save.
- Saved financial changes remain reversible by editing when authorization allows; audit history is available where implemented.

### 9.5 Live Regions

- `aria-live="polite"`: copied link, local save complete, syncing progress, refreshed balance.
- `role="alert"`: submit failure, local persistence failure, permission loss, conflict requiring attention.
- Do not announce every percentage or animation frame. Debounce rapid sync updates into meaningful messages.

### 9.6 Test Matrix

- Keyboard: Chrome and Firefox desktop.
- Screen reader: VoiceOver + Safari; NVDA + Firefox or Chrome.
- Zoom: 200% at 1280 CSS px and reflow at 320 CSS px.
- High contrast/forced colors: Windows forced-colors mode.
- Reduced motion and increased text spacing.
- Viewports: 320, 390, 768, 1024, and 1440 px, plus landscape.
- Automated: axe on all primary routes and Lighthouse as a supporting signal.

---

## 10. Localization and Content Rules

- All user-facing strings, accessible names, status announcements, and email templates use translation keys.
- Do not concatenate translated fragments around amounts or names; use parameterized full sentences.
- Use `Intl.NumberFormat` and `Intl.DateTimeFormat`.
- Preserve full precision in storage and calculation; display according to currency rules and disclose higher precision in calculation details when material.
- English and Russian layouts must tolerate at least 35% string expansion.
- Avoid idioms in transactional copy.

### 10.1 Canonical Terms

| Concept | English UI term | Russian UI term |
|---|---|---|
| Trip calculation unit | Share | Доля |
| Aggregate group | Family | Семья |
| Trip reporting currency | Base currency | Базовая валюта |
| Locally saved mutation | Waiting to sync | Ожидает синхронизации |
| Concurrent edit | Needs attention | Требует внимания |
| Positive personal balance | You are owed | Вам должны |
| Negative personal balance | You owe | Вы должны |

Translation owners may refine grammar, but the concepts and direction must remain stable.

---

## 11. Failure and Edge-State Catalogue

| Scenario | Required user experience |
|---|---|
| Invite invalid, expired, or rotated | Explain that the link no longer works; suggest requesting a new one |
| Guest email already present | Offer recovery; do not create a duplicate |
| Magic link expired/used | Offer a new request without losing trip context |
| Currency provider unavailable | Preserve form; offer manual rate; explain conversion cannot be automatic |
| Device goes offline mid-form | Keep input; switch save behavior to local persistence |
| Local storage unavailable/full | Do not claim saved; show urgent error and allow copying entered data |
| Sync retry duplicates request | Keep one visible expense; idempotency is invisible to the user |
| Expense changed on another device | Preserve local change and open conflict comparison |
| User loses edit permission | Explain why apply is unavailable; allow safe copy/draft retention |
| Base currency changes while offline | Mark cached balance stale and require sync before authoritative comparison |
| Family share count changes | Explain effect and show current count in affected calculations |
| No expenses | Show instructional empty state with `Add expense` |
| All balances zero | Show `Everyone is settled` rather than an empty list |
| Very large/precise amount | Wrap without truncation; validate supported bounds |
| Same currency symbol for multiple codes | Display ISO code in ambiguous contexts |
| Long translated labels/names | Wrap to two or more lines; never overlap amount or action |

---

## 12. Developer Handoff

### 12.1 Frontend Constraints

- Implement with semantic React components; ARIA supplements rather than replaces native HTML.
- Keep server state, cached trip data, and outbox state visually distinguishable but presented in one coherent interface.
- A pending expense requires a stable client ID so focus, optimistic rows, and later server reconciliation do not create duplicate-looking entries.
- Do not calculate authoritative balances from rounded display strings.
- Route protection and hidden owner actions are not authorization; API enforcement remains authoritative.
- Cache the translation resources and essential shell required for the offline expense path.

### 12.2 Required Shared Components

1. App shell and responsive trip navigation.
2. Localized money and date formatters.
3. Form field, amount/currency field, select/combobox, checkbox, and share stepper.
4. Button variants and icon button with tooltip.
5. Status badge and global Sync Center.
6. Expense row/card and expense calculation breakdown.
7. Balance summary and participant/family balance row.
8. Error summary, inline message, toast, skeleton, and empty state.
9. Accessible dialog, confirmation dialog, and mobile sheet.
10. Invite link field with copy/share feedback.

### 12.3 Analytics Events

Collect no expense descriptions, emails, invite tokens, or monetary values in analytics.

Recommended events:

- `trip_create_started`, `trip_create_completed`
- `invite_link_copied`, `invite_share_opened`
- `guest_join_started`, `guest_join_completed`, `guest_recovery_requested`
- `expense_form_opened`, `expense_saved_online`, `expense_saved_offline`
- `expense_advanced_split_opened`, `manual_rate_used`
- `balance_opened`, `balance_breakdown_opened`
- `sync_conflict_opened`, `sync_conflict_resolved`
- `pwa_install_prompted`, `pwa_install_accepted`, `pwa_install_dismissed`

Record duration and outcome categories, not sensitive field contents.

### 12.4 Acceptance Gates

- All five key journeys have success, loading, empty, offline, permission, and recoverable-error behavior.
- A typical expense can be entered with amount and description plus one save action because all other fields have valid defaults.
- Family rows expose aggregate identity and personal share count.
- Currency conversion always shows original amount, direction of rate, and base amount in details.
- Every pending/failed/conflict state includes text and an action where one is possible.
- No horizontal page scroll at 320 px or 200% zoom.
- Critical flows pass keyboard and screen-reader smoke tests in both locales.
- All specified text and UI color pairs pass WCAG 2.1 AA contrast.
- Destructive and financially impactful actions meet WCAG error-prevention expectations.

---

## 13. Requirement Traceability

| UX area | Requirements covered |
|---|---|
| Registration, guest join, recovery | FR-001, FR-005, FR-006, NFR-003, NFR-004 |
| Trip creation and invitation | FR-002, FR-004, NFR-008 |
| Base currency and lifecycle settings | FR-003, FR-016, FR-017 |
| People, families, and shares | FR-007, FR-011 |
| Expense form, list, and permissions | FR-008, FR-009, FR-010, FR-021 |
| Currency rate and conversion disclosure | FR-012, FR-013, FR-014 |
| Balance summary and breakdown | FR-015 |
| Offline, sync, and PWA | FR-018, FR-020, NFR-006 |
| Localization and responsive access | FR-019, NFR-007, NFR-008 |
| Calculation responsiveness | NFR-002 |

---

## 14. Open Product Decisions

These do not block the interaction model but must be resolved before final UI copy and API integration:

1. Whether registered-user authentication uses password, passwordless email, or both.
2. Whether a family is represented only by an aggregate record or also has named member records.
3. Whether changing family shares recalculates existing expenses or only affects future/default splits.
4. Exact supported currency list, decimal display rules, and provider-attribution requirements.
5. Which conflict resolutions the Sync API will support beyond accept-server and retry-local.
6. Data-retention and recovery behavior after trip deletion.

Until resolved, prototypes and implementation must not imply behavior that the domain model cannot guarantee.

