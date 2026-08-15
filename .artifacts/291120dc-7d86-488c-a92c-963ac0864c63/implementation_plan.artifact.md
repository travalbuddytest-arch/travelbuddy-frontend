# Implementation Plan - Frontend Dashboard Fixes

The user wants to fix the message section in the user dashboard (visibility and functionality) and adjust the track section's size to match the screen page.

## User Review Required

> [!IMPORTANT]
> I will be adding a new "Messages" panel to the user dashboard (overview page) to show recent conversations.
> I will also fix a critical syntax error in the messaging script caused by duplicated code.

## Proposed Changes

### 1. User Dashboard (Overview)
- **[MODIFY] [overview.html](file:///G:/TravelBuddyAndroid/TravelBuddyAndroid/Frontend/user-dashboard/overview.html)**: Add a new panel for "Recent Messages" next to or below "Recent Activity".
- **[MODIFY] [overview.js](file:///G:/TravelBuddyAndroid/TravelBuddyAndroid/Frontend/user-dashboard/js/overview.js)**: Implement fetching and rendering of recent messages in the new panel.

### 2. Messaging Functionality
- **[MODIFY] [messages.js](file:///G:/TravelBuddyAndroid/TravelBuddyAndroid/Frontend/user-dashboard/js/messages.js)**: Remove the large duplicated block of code (lines 127-199) which contains re-declarations of `const` variables, causing a `SyntaxError` that breaks the entire script.

### 3. Track Parcel Section
- **[MODIFY] [track.css](file:///G:/TravelBuddyAndroid/TravelBuddyAndroid/Frontend/user-dashboard/css/track.css)**: Adjust the desktop layout (`@media (min-width: 1181px)`) to be more flexible. I'll reduce the forced `100dvh` constraints where they might be causing clipping and ensure the route card and timeline fit better on various screen heights.

## Verification Plan

### Manual Verification
1. **Messages Visibility**: Open `overview.html` and verify the "Recent Messages" panel appears and shows data.
2. **Messages Functionality**: Open `messages.html` and verify the chat interface loads (the syntax error fix should allow the script to execute).
3. **Track Section Size**: Open `track.html` and verify the layout fits the screen without excessive empty space or clipped content on desktop and mobile.
