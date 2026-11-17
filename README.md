# GDSI Lighting Calculator

Preliminary lighting sizing for Hyundai GDSI dealerships: target illuminance per space, fixture quantity and a grid layout.
English UI, PC only, runs entirely in the browser (no server, no install). Final verification is by DIALux or the lighting vendor.

## Run

Open `index.html` in Chrome or Edge. Data is kept in the browser (localStorage); use **Save / Open** to move a project between PCs.

User manual: [manual/](manual/) (web, button **Manual** in the app) and `manual/GDSI_Lighting_Calculator_User_Manual_v0.2.pdf`.

## Whole-drawing import

Click **Upload drawing** (or drop the file on the page) with the floor plan or reflected ceiling plan as **DXF**
(DWG cannot be read in a browser: AutoCAD SAVEAS > DXF). All rooms are found at once and shown on a preview
where rooms can be unticked, renamed or re-typed before they are added.

- **Room outlines** - closed polylines on one layer (zone / room / area layer) are the room boundaries. Picked automatically when such a layer exists.
- **Wall lines + room names** - when no boundaries are drawn, the wall layers are rasterised and each room-name text is flood-filled.
  Door openings narrower than the *bridge door gaps* width are closed. Areas open to the outside are skipped and listed.
  An open-plan area with several room names (showroom + lounge + reception) is divided between the names along the walls - the split boundary is approximate.
- Space type is guessed from the name (English and common Indonesian words); unknown names become *Other (enter target)*.
- Ceiling heights are read from `CH +3,000` / `C.H. 2700` / `CH=2.85` texts. Upload the plan first, then the ceiling plan: rooms with the same name take the ceiling height instead of being added twice.
- Non-rectangular rooms become the rectangle with the same area and perimeter, so the room index is exact; the layout sketch is schematic.
- Area annotations in names (`96 SQ.FT.`) are removed from the room name.

## Files

| File | Content |
|---|---|
| `data/standards.js` | Illuminance table. `manual` = GDSI 2.0 Guideline v2.0 (page numbers), `is3646` = IS 3646 (Part 1): 1992 Table 1 where the manual has no figure, `none` = designer enters the target |
| `data/fixtures.js` | Built-in **generic placeholder** fixtures. Real fixtures are registered in the app (Fixtures tab) and exported / imported as JSON |
| `js/dxf.js` | DXF reader and room finder (outlines, or walls + flood fill), CH texts, space-type keywords |
| `js/calc.js` | Lumen method: `N = E x A / (F x UF x MF)`, room index, generic UF table, spacing rule, Surface Light strips (1,500 / 2,400 mm module) with spot top-up |
| `js/app.js` | UI |
| `test/*.test.js` | `node test/calc.test.js` and `node test/dxf.test.js` |

## Assumptions to replace with real data

- Fixture output and power (all built-in fixtures)
- Utilisation factor table (generic direct-distribution LED), maintenance factor 0.8
- Default ceiling heights (only the workshop 4.8 m minimum is from the manual)
- Showroom design target 850 lux = midpoint of the manual range 700-1000

## Stages

1. Manual entry calculator - **done (v0.1)**
2. Whole-drawing DXF upload (plan or RCP; outlines or walls) - **done (v0.2)**
3. DXF / XLSX export, installable app (PWA), one-page user guide
4. Pilot with 1-2 designers in India
