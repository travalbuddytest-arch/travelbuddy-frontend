# Implementation Plan - Contact Page Usability Fixes

Implement fixes for 10 usability and heuristic issues on the TravelBuddy Contact page, focusing on design consistency, semantic hierarchy, and layout refinements.

## User Review Required

> [!IMPORTANT]
> **Issue 8 (Active Navigation)**: Since the navbar does not have a dedicated "Contact" link, I will mark "Support" as the active navigation item on the Contact page, as it serves as the parent help section.

## Proposed Changes

### [HTML] Contact Page Structure
#### [MODIFY] [contact.html](file:///G:/TravelBuddyAndroid/TravelBuddyAndroid/Frontend/contact/contact.html)
- **Issue 5 (Headings)**: Promote `<h3>` in contact cards (Email, Call, Visit Support) to `<h2>` to resolve the H1 -> H3 jump.
- **Issue 4 (Buttons)**: Replace `primary-btn` with the standardized `btn btn-primary` system.
- **Issue 21 (Accessibility/Labels)**: (Verified requirement) Ensure all form inputs have associated `<label>` elements. (Already present in current HTML, will verify associations).
- **Issue 9 (Accessibility)**: Add `aria-hidden="true"` to decorative icons in cards and the sidebar.

### [CSS] Contact Page Styles
#### [MODIFY] [contact.css](file:///G:/TravelBuddyAndroid/TravelBuddyAndroid/Frontend/contact/contact.css)
- **Issue 1-3 (Tokens)**: Replace hardcoded font sizes, colors, and border-radii with variables from `design-system.css`.
- **Issue 3 (Standardized Radii)**:
    - Apply `--radius-lg` (16px) to contact cards and the form card.
    - Apply `--radius-md` (10px) to inputs and buttons.
    - Apply `--radius-xl` (24px) to the sidebar card.
- **Issue 9 (Social Alignment)**: Left-align the sidebar social icons (`.ct-socials`) to match the footer's layout.
- **Issue 10 (Footer Gap)**: Find the source of the 200px vertical gap (likely a margin or min-height on `.ct-main`) and reduce it using standardized spacing tokens.
- **Issue 8 (Active Nav)**: Ensure the `active` class is applied to the Support nav link and styled correctly (reusing `navbar.css` fixes).

### [JS] Global/Shared
- **Issue 6 & 7 (Cookie Consent)**: Verify global fixes in `site-banner.js/css` correctly handle non-blocking display and fixed corner positioning for the reopen pill. (Already implemented in previous task, will confirm no local overrides in `contact.css` break this).

## Verification Plan

### Manual Verification
1. **Heading Hierarchy**: Inspect the page document outline to ensure H1 -> H2 structure.
2. **Button Uniformity**: Verify all buttons ("Send Message", "Search" in Hero) share the same base styling.
3. **Alignment**: Confirm sidebar social icons are left-aligned.
4. **Spacing Audit**: Verify the vertical gap between the form and footer is intentional and visually balanced (~60-80px instead of >200px).
5. **Responsive Check**: Test viewports from 320px to 1440px for stability and zero overflow.
6. **Navigation**: Ensure "Support" is highlighted in the navbar when on the Contact page.
