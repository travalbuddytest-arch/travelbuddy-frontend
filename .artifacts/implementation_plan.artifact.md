# Implementation Plan: Premium "Center-Light" Background System

This plan refines the existing background system to match a sophisticated "Center-Light" visual direction: bright, almost-white centers with extremely soft cyan-blue edges and layered atmospheric glows.

## User Review Required

> [!IMPORTANT]
> - **Visual Direction**: The background will shift from a general gradient to a targeted "illuminated" look, prioritizing the bright center to make content "pop."
> - **Color Accuracy**: I will use the exact hex codes requested (#F8FCFF, #BFEFF1, #DDF7F8, etc.) to ensure perfect alignment with the provided visual direction.
> - **Zero Disruption**: This is a background-only change. All existing components (navbars, cards, buttons) will remain functionally and structurally identical.

## Proposed Changes

### [Core Design System]

#### [MODIFY] [design-system.css](file:///G:/TravelBuddyAndroid/TravelBuddyAndroid/Frontend/shared/design-system.css)
- **Refined Variable Palette**:
    - `--tb-bg-base`: #F8FCFF
    - `--tb-bg-cyan`: #BFEFF1
    - `--tb-bg-light`: #DDF7F8
    - `--tb-bg-center`: #F8FDFF
    - `--tb-bg-atmosphere`: #D8EAFE
- **Layered Gradient Engine**:
    - Update `.tb-bg-layer-base` to use a 4-stop radial gradient for the center-light effect:
      `radial-gradient(circle at 50% 45%, #F9FEFF 0%, #E9FAFB 35%, #D7F3F5 65%, #BFEFF1 100%)`
- **Soft Diffusion Polish**:
    - Increase blur on `.tb-bg-orb` to `150px` or more for "light field" rather than "blob" look.
    - Reduce default opacity to `0.06` – `0.10` for maximum elegance.
- **Dark Section Companion**:
    - Refine `.tb-dark-section-bg` with the #071A3D → #0B2A63 → #0A376F deep gradient and subtle cyan highlights.

### [Animation & Interactivity]

#### [MODIFY] [nav-include.js](file:///G:/TravelBuddyAndroid/TravelBuddyAndroid/Frontend/shared/nav-include.js)
- Slow down ambient floating animations to a `15s - 25s` cycle for a calmer feel.
- Refine the mouse-parallax intensity to be even more subtle (max `10px` shift).

## Verification Plan

### Manual Verification
- **Visual Match**: Confirm the background transitions match the "reference image" description (bright center, soft cyan edges).
- **Glassmorphism Test**: Verify that cards with `glass-surface` look more "premium" against the new illuminated background.
- **Performance Check**: Verify smooth 60fps scrolling and animation on mobile viewports.
- **Contrast Check**: Ensure the bright #F8FDFF center doesn't wash out any light-colored text (using WCAG standards).
