# Implementation Plan - Home Page Improvements & Glass Navbar

I will enhance the TravelBuddy home page with interactive features and a more attractive, modern navigation bar using glassmorphism effects.

## User Review Required

> [!IMPORTANT]
> I will be introducing an **Interactive Price Estimator** on the home page. This will use a simulated calculation to show users potential savings instantly.
> I will also update the **Navbar** globally to have a "Glass" effect (blur and transparency).

## Proposed Changes

### 1. Global Navigation Bar
- **[MODIFY] [navbar.css](file:///G:/TravelBuddyAndroid/TravelBuddyAndroid/Frontend/shared/navbar.css)**:
    - Implement a stronger `backdrop-filter: blur(12px)` and `background: rgba(255, 255, 255, 0.7)`.
    - Add a subtle border and shadow to make the glass effect pop.

### 2. Interactive Home Page Features
- **[MODIFY] [index.html](file:///G:/TravelBuddyAndroid/TravelBuddyAndroid/Frontend/home/index.html)**:
    - **Live Activity Ticker**: Add a scrolling bar below the Hero section.
    - **Price Estimator**: Add a dynamic "Estimated Price" display area inside the search card.
    - **Testimonials Section**: Add a modern slider section with verified user stories.
    - **Newsletter Section**: Add a lead capture form above the footer.

- **[MODIFY] [style.css](file:///G:/TravelBuddyAndroid/TravelBuddyAndroid/Frontend/home/style.css)**:
    - Style the **Live Ticker** with a seamless scrolling animation.
    - Style the **Price Estimator** for a premium "calculating" look.
    - Style the **Testimonials** with a focus on photography and trust badges.
    - Style the **Newsletter** with a high-contrast background to grab attention.

- **[MODIFY] [script.js](file:///G:/TravelBuddyAndroid/TravelBuddyAndroid/Frontend/home/script.js)**:
    - **Logic**: Add an event listener to the search inputs to calculate and display a price estimate as the user types.
    - **Ticker Logic**: Create a dynamic generator for the live activity feed.
    - **Slider Logic**: Implement a lightweight carousel for the testimonials.

## Verification Plan

### Manual Verification
1. **Glass Navbar**: Scroll down the page and verify the blur effect is visible over background content.
2. **Price Estimator**: Enter cities in the "From" and "To" fields and verify the "Estimated Price" appears and updates.
3. **Live Ticker**: Confirm the ticker scrolls smoothly and stays updated with simulated events.
4. **Testimonials**: Verify the slider transitions correctly when clicking the navigation dots/arrows.
5. **Newsletter**: Test that the "Subscribe" button triggers a success message.
6. **Mobile Check**: Ensure all new sections stack correctly on smaller screens.
