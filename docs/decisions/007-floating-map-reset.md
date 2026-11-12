# Decision 007 — Floating full-map reset control

- Date: 2026-11-12
- Status: Implemented in the isolated prototype branch; online preview still requires deployment verification.
- Scope: `map-navi-prototype` only. The production `main` branch and the existing live site are not changed.

## Decision

Add a dedicated circular reset control inside the map viewport, in the upper-right corner. It uses an unmistakable pair of curved arrows and calls the existing `fitFullProfile()` behavior.

## Why

The full-map action should be available where the user is looking, without requiring them to leave the map area or find a separate control below it. Keeping the existing button below the map preserves backward compatibility while the floating control is tested.

## Implementation

- Added the floating control and accessible label/title to `index.html`.
- Connected it to the existing `fitFullProfile()` function in `app.mjs`.
- No new map data or unverified POIs were introduced.

## Acceptance check

1. Open the Rhein prototype.
2. Tap the round arrows control in the upper-right corner of the map.
3. The map returns to the full profile bounds.
4. The existing lower full-map control continues to work.

## Next

Once a preview host is available and the page is verified on a phone, review the control's size and position before adding the pharmacy and toilet controls. Those need verified POI data and must not display invented locations.
