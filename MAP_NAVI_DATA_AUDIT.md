# Rhein Map Navi — data audit

**Checked:** 12 November 2026  
**Branch:** `feature/map-navi-core-01`  
**Scope:** `map-navi-prototype/profiles/rhine.json` compared with repository assets.

## Profile integrity

- 22 objects in total.
- 22 unique object IDs.
- Category counts: 14 castles, 5 towns, 3 landmarks.
- All 22 coordinates fall inside the profile's declared map bounds.
- All 22 objects contain both English SAY THIS and Russian text.

## Image references

The profile was checked against actual files in the repository:

- Six image references were corrected from `.jpg` to existing `.jpeg` assets: Maus, Rheinfels, Katz, Loreley, Reichenstein and Rheinstein.
- Gutenfels and St. Hildegard have no matching image file in the repository tree. Their image field is therefore omitted so the interface does not request a known-missing asset.
- Other image references in this profile match existing repository files.

## Remaining data work

- Confirm whether Gutenfels and St. Hildegard images should be added later.
- Verify all object coordinates and labels against authoritative geographic sources before production integration.
- Add practical POIs (toilets, pharmacies, cafés, water, parking) only from verified sources; do not invent points.
- The profile remains a prototype snapshot, not the canonical shared data source.

## Verification boundary

This audit confirms repository file-name matches, profile structure and coordinate containment within the declared bounds. It does **not** confirm that every image visually depicts the named place, that coordinates are survey-accurate, or that the map has been tested in a real browser/device.
