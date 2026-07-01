---
name: Owebee
description: Accessible, trustworthy visual system for a responsive trip-expense PWA.
status: final
updated: 2026-06-30
sources:
  - "{planning_artifacts}/prd.md"
  - "{planning_artifacts}/architecture.md"
  - "imports/ux-design-v1.md"
colors:
  background: '#F7F7FB'
  surface: '#FFFFFF'
  text: '#172033'
  text-muted: '#4B5563'
  primary: '#1D4ED8'
  primary-hover: '#1E40AF'
  primary-foreground: '#FFFFFF'
  brand-honey: '#F4B942'
  success: '#15803D'
  success-surface: '#F0FDF4'
  warning: '#92400E'
  warning-surface: '#FFFBEB'
  danger: '#B91C1C'
  danger-surface: '#FEF2F2'
  info: '#1D4ED8'
  info-surface: '#EFF6FF'
  border-subtle: '#CBD5E1'
  border-control: '#64748B'
  focus-ring: '#0F172A'
  focus-gap: '#FFFFFF'
typography:
  body:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-strong:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: 16px
    fontWeight: '600'
    lineHeight: '1.5'
  metadata:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.45'
  heading-1:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.15'
    letterSpacing: -0.02em
  heading-1-mobile:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.015em
  heading-2:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.2'
  heading-2-mobile:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.25'
  heading-3:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: 20px
    fontWeight: '650'
    lineHeight: '1.3'
  money-total:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
rounded:
  sm: 8px
  md: 12px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  '7': 48px
  '8': 64px
  gutter-mobile: 16px
  gutter-tablet: 24px
  nav-rail: 240px
components:
  app-shell:
    background: '{colors.background}'
    foreground: '{colors.text}'
    max-width: 1440px
  trip-navigation:
    background: '{colors.surface}'
    foreground: '{colors.text}'
    active: '{colors.primary}'
    border: '{colors.border-subtle}'
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    background-hover: '{colors.primary-hover}'
    radius: '{rounded.sm}'
    min-height: 44px
  button-destructive:
    background: '{colors.danger}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.sm}'
    min-height: 44px
  form-field:
    background: '{colors.surface}'
    foreground: '{colors.text}'
    border: '{colors.border-control}'
    radius: '{rounded.sm}'
    min-height: 48px
  amount-currency-field:
    background: '{colors.surface}'
    foreground: '{colors.text}'
    border: '{colors.border-control}'
    radius: '{rounded.sm}'
    min-height: 48px
  select-combobox:
    background: '{colors.surface}'
    foreground: '{colors.text}'
    border: '{colors.border-control}'
    radius: '{rounded.sm}'
    min-height: 48px
  share-selector-stepper:
    background: '{colors.surface}'
    foreground: '{colors.text}'
    border: '{colors.border-control}'
    radius: '{rounded.sm}'
    min-height: 48px
  status-synced:
    background: '{colors.success-surface}'
    foreground: '{colors.success}'
    radius: '{rounded.full}'
  status-pending:
    background: '{colors.warning-surface}'
    foreground: '{colors.warning}'
    radius: '{rounded.full}'
  status-conflict:
    background: '{colors.danger-surface}'
    foreground: '{colors.danger}'
    radius: '{rounded.full}'
  sync-center:
    background: '{colors.surface}'
    foreground: '{colors.text}'
    border: '{colors.border-control}'
    radius: '{rounded.md}'
  expense-row:
    background: '{colors.surface}'
    foreground: '{colors.text}'
    border: '{colors.border-subtle}'
    radius: '{rounded.sm}'
  balance-summary:
    background: '{colors.surface}'
    foreground: '{colors.text}'
    border: '{colors.border-subtle}'
    radius: '{rounded.md}'
  balance-row:
    background: '{colors.surface}'
    foreground: '{colors.text}'
    border: '{colors.border-subtle}'
    radius: '{rounded.sm}'
  dialog:
    background: '{colors.surface}'
    foreground: '{colors.text}'
    radius: '{rounded.md}'
    max-width: 600px
  mobile-sheet:
    background: '{colors.surface}'
    foreground: '{colors.text}'
    radius: '{rounded.md}'
  invite-link-field:
    background: '{colors.surface}'
    foreground: '{colors.text}'
    border: '{colors.border-control}'
    radius: '{rounded.sm}'
  toast-inline-message:
    background: '{colors.surface}'
    foreground: '{colors.text}'
    border: '{colors.border-control}'
    radius: '{rounded.sm}'
  error-summary:
    background: '{colors.danger-surface}'
    foreground: '{colors.danger}'
    border: '{colors.danger}'
    radius: '{rounded.sm}'
  empty-state:
    background: '{colors.surface}'
    foreground: '{colors.text}'
    radius: '{rounded.md}'
---

## Brand & Style

Owebee should feel like a calm trip ledger shared by people who trust one another but still need the arithmetic to be inspectable. It is a practical tool, not a banking dashboard: dark ink carries meaning, cobalt marks actions, cool off-white reduces glare, and honey adds warmth without becoming an action or status color.

The interface earns trust by pairing every important number with a sentence, keeping locally saved work visible, and explaining unusual calculations where they appear. Visual hierarchy comes from spacing, typography, and restrained surfaces rather than decoration.

## Colors

The palette has three jobs: make actions obvious, keep financial text highly legible, and distinguish synchronization states without color-only meaning.

- `{colors.background}` is the application canvas; `{colors.surface}` holds forms, cards, dialogs, and navigation.
- `{colors.text}` and `{colors.text-muted}` are the only routine text colors. They measure approximately 16.27:1 and 7.56:1 respectively on `{colors.surface}`.
- `{colors.primary}` is reserved for links, primary actions, and active controls. White text on primary measures approximately 6.70:1.
- `{colors.brand-honey}` is decorative and may back dark ink; it never means success, warning, or selection.
- Semantic foreground/surface pairs are fixed: success on success-surface, warning on warning-surface, danger on danger-surface, and info on info-surface. Every semantic state also has text and an icon.
- `{colors.border-subtle}` is only for non-essential dividers. Interactive boundaries use `{colors.border-control}`, which measures approximately 4.76:1 on white.
- Focus uses a two-part treatment: a 2px `{colors.focus-gap}` separation plus a 3px `{colors.focus-ring}` outer ring. This avoids placing blue focus directly against a blue primary control.

Do not place semantic foreground colors directly on the app background without validating the pair. Disabled states must preserve readable labels and may not communicate state through opacity alone.

## Typography

Inter and the system sans-serif fallback stack form the complete type system. Sentence case is standard; all caps is reserved for short decorative labels.

- Body copy uses `{typography.body}`; labels that need emphasis use `{typography.body-strong}`.
- Secondary information uses `{typography.metadata}` and never drops below 12px.
- Page titles use `{typography.heading-1-mobile}` below 768px and `{typography.heading-1}` at wider viewports.
- Section titles use `{typography.heading-2-mobile}` or `{typography.heading-2}`; component titles use `{typography.heading-3}`.
- Primary financial totals use `{typography.money-total}` at desktop and 32px at mobile. All monetary values use tabular numerals.
- Financial amounts may wrap as a unit but never truncate significant digits.

## Layout & Spacing

The spacing system is 4px-based, with an 8px primary rhythm. Use `{spacing.gutter-mobile}` below 768px and `{spacing.gutter-tablet}` from 768px upward.

Mobile is single-column. At 768px, trip navigation becomes a compact left rail; at 1024px it expands to `{spacing.nav-rail}`. The application shell is centered and capped at the `app-shell` maximum width. Primary forms remain one reading column even when supporting content becomes two-column.

Body text stays within 45–75 characters per line. Sticky mobile actions must include safe-area padding and must not cover the focused field, its help text, or an error.

## Elevation & Depth

Hierarchy uses borders and tonal layering before shadows.

- Cards use a subtle `0 1px 2px rgba(23, 32, 51, 0.06)` shadow only when a surface boundary needs reinforcement.
- Dialogs and sheets use `0 16px 40px rgba(23, 32, 51, 0.18)`.
- A shadow never replaces a required control boundary or focus indicator.
- Cached content remains visually stable during background refresh; do not replace it with a raised loading surface.

## Shapes

Controls, fields, and rows use `{rounded.sm}`. Cards, dialogs, sheets, and the Sync Center use `{rounded.md}`. Pills are reserved for compact status and type labels and use `{rounded.full}`.

Shape supports meaning but never carries it alone. Active navigation combines label, icon, fill/shape, and `aria-current`; status pills combine text, icon, and semantic color.

## Components

| Component | Visual contract |
|---|---|
| App shell | `{components.app-shell}`; centered, stable background, skip-link visible on focus. |
| Trip navigation | `{components.trip-navigation}`; bottom bar below 768px, rail above; active item uses icon, text, shape, and primary color. |
| Button — primary | `{components.button-primary}`; one primary action per region; 48px minimum target on mobile. |
| Button — destructive | `{components.button-destructive}`; appears only inside a consequence-confirmation region. |
| Form field | `{components.form-field}`; persistent label, visible boundary, help/error below, no placeholder-only labels. |
| Amount/currency field | `{components.amount-currency-field}`; visually grouped controls, amount remains dominant, ISO code appears when a symbol is ambiguous. |
| Select/combobox | `{components.select-combobox}`; visually consistent with fields, with a distinct popup indicator and visible selected value. |
| Share selector/stepper | `{components.share-selector-stepper}`; rows keep identity, type, and share count legible at 320px. |
| Status badge — synced | `{components.status-synced}`; text “Synced” plus a non-color icon. |
| Status badge — pending | `{components.status-pending}`; text “Waiting to sync” plus a non-color icon. |
| Status badge — conflict | `{components.status-conflict}`; text “Needs attention” plus a non-color icon and an action nearby. |
| Sync Center | `{components.sync-center}`; persistent attention states, grouped mutation rows, no auto-dismiss for unresolved work. |
| Expense row | `{components.expense-row}`; description and original amount lead; converted amount, payer, date, and sync status follow. |
| Balance summary | `{components.balance-summary}`; direction sentence precedes the total; timestamp and pending-data notice remain adjacent. |
| Balance row | `{components.balance-row}`; identity, entity type/share count, direction sentence, amount, and disclosure action. |
| Dialog | `{components.dialog}`; centered from 768px, one modal layer only. |
| Mobile sheet | `{components.mobile-sheet}`; short tasks only; multi-field expense editing remains a page. |
| Invite link field | `{components.invite-link-field}`; labeled read-only URL with adjacent Copy and optional Share actions. |
| Toast/inline message | `{components.toast-inline-message}`; semantic foreground and surface vary by state; important information remains inline. |
| Error summary | `{components.error-summary}`; high-contrast heading, linked error list, and no decorative alarm imagery. |
| Empty state | `{components.empty-state}`; concise heading, one explanatory sentence, and one primary next action. |

All interactive components use the two-part focus treatment defined under Colors. Hover is supplementary; every action remains visible and operable without hover.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Pair amounts with “You owe,” “You are owed,” “Owes,” or “Is owed.” | Present a bare signed number as the only meaning. |
| Keep pending expenses in the normal list with explicit status. | Hide local work in a temporary toast or separate debug view. |
| Use honey for warmth and brand recognition. | Use honey as primary action, warning, or selection color. |
| Use control borders that meet the 3:1 non-text contrast floor. | Reuse subtle divider colors for form boundaries. |
| Use a white gap plus dark outer focus ring on colored controls. | Put a blue ring directly against a blue control. |
| Preserve a single reading column for financial forms. | Widen forms merely because desktop space is available. |
| Keep core actions visible at 320px and 400% equivalent reflow. | Require horizontal scrolling for primary financial content. |
