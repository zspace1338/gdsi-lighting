/* GDSI Lighting Calculator - built-in fixture list.
 *
 * Every item here is a GENERIC PLACEHOLDER with typical LED values, NOT a product used on site.
 * Register the real fixtures in the app (Fixtures tab) and they will replace these in the room list.
 *
 * kind:
 *   "point"   - downlight / spot / panel / high bay. lm and watt are per fixture.
 *   "linear"  - batten / linear. lm and watt are per piece; length in m (drawn as a line).
 *   "surface" - luminous ceiling (Surface Light). lm and watt are PER SQUARE METRE of luminous surface.
 *               Module width 1.5 m and gap 2.4 m come from the GDSI manual p.94-95.
 * shr: maximum spacing-to-mounting-height ratio (generic assumption 1.5 unless the datasheet says otherwise).
 */
window.GDSI_FIXTURES = [
  { id: "gen-surface",   kind: "surface", name: "Surface Light (luminous ceiling) - generic", lm: 3000,  watt: 30,  cct: 4000, moduleWidth: 1.5, gap: 2.4, note: "Manual p.94-95: module 1,500 mm wide, 2,400 mm break between modules. Output per m2 is a generic assumption." },
  { id: "gen-spot",      kind: "point",   name: "LED spot light 30 W - generic",             lm: 3000,  watt: 30,  cct: 4000, shr: 1.2, note: "Manual p.94 Spot Light 83.5 (W) x 100 (H) mm. Output is a generic assumption." },
  { id: "gen-downlight", kind: "point",   name: "LED downlight 15 W - generic",              lm: 1500,  watt: 15,  cct: 4000, shr: 1.5, note: "Generic assumption." },
  { id: "gen-panel",     kind: "point",   name: "LED panel 600x600 36 W - generic",          lm: 3600,  watt: 36,  cct: 4000, shr: 1.5, note: "Generic assumption." },
  { id: "gen-linear",    kind: "linear",  name: "LED linear batten 1200 mm 36 W - generic",  lm: 4400,  watt: 36,  cct: 4000, shr: 1.5, length: 1.2, note: "Generic assumption." },
  { id: "gen-highbay",   kind: "point",   name: "LED high bay 150 W - generic",              lm: 21000, watt: 150, cct: 5000, shr: 1.5, note: "Generic assumption." },
  { id: "gen-exproof",   kind: "point",   name: "Explosion-proof LED 60 W - generic",        lm: 7200,  watt: 60,  cct: 5000, shr: 1.5, note: "Generic assumption. Hazardous-area certification must be checked on the real product." }
];
