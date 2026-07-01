# Accessibility Review — Owebee UX

> Archived pre-update review. Findings were used to produce the canonical contracts in this workspace.

## Overall verdict

The specification is accessibility-aware and substantially stronger than a typical planning artifact. It includes semantic landmarks, keyboard behavior, focus return, live regions, reduced motion, localization, error summaries, non-color status cues, target sizes, and a concrete test matrix. The accessibility contract is **adequate but not implementation-closed** because two declared color tokens fail their intended adjacency conditions, core authentication surfaces are underspecified, and the target remains WCAG 2.1 rather than explicitly covering the WCAG 2.2 additions relevant to this product.

## Strengths

- Native HTML is preferred and ARIA is correctly framed as supplemental (`ux-design.md:650–656`, `752–755`).
- Form errors preserve input, use summaries, link to fields, and move focus predictably (`ux-design.md:388–394`).
- Offline, sync, and conflict statuses use text plus icon plus color and meaningful live-region behavior (`ux-design.md:165–175`, `536–547`, `684–688`).
- Reduced motion, reflow, zoom, forced colors, screen-reader, keyboard, and locale checks are explicitly named (`ux-design.md:639–644`, `690–698`).
- Destructive and financially impactful actions include review/confirmation language and avoid color-only meaning (`ux-design.md:667–682`).

## Findings

- **High — Input boundary contrast fails the stated floor.** `color-border: #CBD5E1` against `color-surface: #FFFFFF` is approximately 1.48:1, while the document requires UI boundaries to reach 3:1 (`ux-design.md:511`, `601–613`, `669`). *Fix:* Replace the interactive boundary token with a darker color such as a validated slate/ink token; a lighter divider token may remain for non-essential separators.
- **High — One focus token cannot work on every declared control surface.** `color-focus: #2563EB` is approximately 1.30:1 against `color-primary: #1D4ED8`, so a focused primary button may lose the ring even though the same token works on white (`ux-design.md:605`, `613`, `662`). *Fix:* Define surface-aware focus treatments, such as a light inner gap plus dark outer ring, and verify 3:1 against both the component and adjacent background.
- **High — Authentication and account accessibility are not specified.** Welcome/sign-in, Register, and Account exist in IA, but only guest name/email and magic-link recovery receive interaction detail (`ux-design.md:129–154`, `209–233`, `475–480`). *Fix:* Specify labels, autocomplete tokens, password-manager compatibility if passwords are chosen, error/recovery behavior, session-expiry handling, focus, and accessible-authentication requirements.
- **Medium — The conformance target should be consciously updated or justified.** The document targets WCAG 2.1 AA (`ux-design.md:9`, `648`), while W3C encourages use of WCAG 2.2; the product should explicitly cover Focus Not Obscured, Dragging Movements, Target Size (Minimum), Redundant Entry, and Accessible Authentication. *Fix:* Set WCAG 2.2 AA as the product target, or record why 2.1 is binding and adopt the relevant 2.2 criteria as additional requirements.
- **Medium — Forced-colors behavior is tested but not designed.** The test matrix names Windows forced-colors mode, but component rules do not specify system colors, borders, icon visibility, or `forced-color-adjust` exceptions (`ux-design.md:690–698`). *Fix:* Add forced-colors rules for focus, selected navigation, status icons, disabled controls, and custom checkboxes/steppers.
- **Medium — Mobile screen-reader coverage is incomplete.** The product is mobile-first/PWA, but the matrix includes VoiceOver + Safari and NVDA without TalkBack + Chrome on Android (`ux-design.md:50–56`, `690–698`). *Fix:* Add TalkBack + Chrome for join, expense, balance, and sync-conflict smoke tests.
- **Medium — Exact-name deletion creates avoidable motor and cognitive effort.** Requiring users to type the full trip name is mitigated by allowing paste, but no alternative confirmation path is specified (`ux-design.md:466–473`). *Fix:* Validate this pattern with assistive-technology users or offer an equally safe confirmation using explicit consequence text plus a named destructive action.
- **Low — Contrast is asserted rather than recorded as a complete matrix.** Several principal pairs pass when calculated, but disabled, hover, selected navigation, tinted semantic backgrounds, and text-on-status combinations are not enumerated (`ux-design.md:597–615`). *Fix:* Add a checked color-pair table to `DESIGN.md`, including state and forced-color fallbacks.

## Reference

W3C’s current guidance encourages using the latest WCAG version; content conforming to WCAG 2.2 also conforms to 2.1: <https://www.w3.org/WAI/standards-guidelines/wcag/>.
