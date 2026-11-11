# GDSI Lighting Calculator

Preliminary lighting sizing for Hyundai GDSI dealerships: target illuminance per space, fixture quantity and a grid layout.
English UI, PC only, runs entirely in the browser (no server, no install). Final verification is by DIALux or the lighting vendor.

## Run

Open `index.html` in Chrome or Edge. Data is kept in the browser (localStorage); use **Save / Open** to move a project between PCs.

## Files

| File | Content |
|---|---|
| `data/standards.js` | Illuminance table. `manual` = GDSI 2.0 Guideline v2.0 (page numbers), `is3646` = IS 3646 (Part 1): 1992 Table 1 where the manual has no figure, `none` = designer enters the target |
| `data/fixtures.js` | Built-in **generic placeholder** fixtures. Real fixtures are registered in the app (Fixtures tab) and exported / imported as JSON |
| `js/calc.js` | Lumen method: `N = E x A / (F x UF x MF)`, room index, generic UF table, spacing rule, Surface Light strips (1,500 / 2,400 mm module) with spot top-up |
| `js/app.js` | UI |
| `test/calc.test.js` | `node test/calc.test.js` |

## Assumptions to replace with real data

- Fixture output and power (all built-in fixtures)
- Utilisation factor table (generic direct-distribution LED), maintenance factor 0.8
- Default ceiling heights (only the workshop 4.8 m minimum is from the manual)
- Showroom design target 850 lux = midpoint of the manual range 700-1000

## Stages

1. Manual entry calculator - **done (v0.1)**
2. DXF upload (rooms as closed polylines on the standard layer) + layout view
3. DXF / XLSX export, installable app (PWA), one-page user guide
4. Pilot with 1-2 designers in India
