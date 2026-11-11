/* GDSI Lighting Calculator - illuminance standards table.
 *
 * source.type:
 *   "manual"  = Hyundai GDSI 2.0 Guideline, Version 2.0 (2022-06). Page number is the PDF page.
 *   "is3646"  = IS 3646 (Part 1): 1992, Table 1 - used ONLY where the GDSI manual gives no figure.
 *               Three values = low - service - high. The middle (service) value is the design target.
 *   "none"    = no figure confirmed in either document. The designer must enter a target.
 *
 * min / target / max are in lux. target is what the calculator designs to.
 * workPlane (m): NBC 2016 Part 8 cl. 4.1.4.3 - 0.85 m general, 0.75 m industrial.
 * defaultH (m): starting ceiling height only. Workshop 4.8 m is the manual minimum (p.121);
 *               every other defaultH is an ASSUMPTION the designer must overwrite with the real height.
 * lpd: ECBC 2017 Table 6-4 (space function method, ECBC level), W/m2 - shown for reference only.
 */
window.GDSI_STANDARDS = {
  manualTitle: "Hyundai GDSI 2.0 Guideline v2.0 (2022-06)",
  supplementTitle: "IS 3646 (Part 1): 1992, Table 1",
  buildingLpd: { value: 9.0, ref: "ECBC 2017 Table 6-1, Automotive facility" },
  groups: ["Showroom (FOH)", "Customer & Office", "Workshop", "Body & Paint", "Parts & Storage", "Circulation & Service", "Parking & Exterior"],
  spaces: [
    /* ---------- Showroom (FOH) : GDSI manual ---------- */
    { id: "showroom", group: "Showroom (FOH)", name: "Showroom - vehicle display",
      min: 700, target: 850, max: 1000, cct: 4000, workPlane: 0.85, defaultH: 3.5, defaultFixture: "gen-surface",
      source: { type: "manual", ref: "p.94", note: "Recommended 700-1000 lux, 4000K. Surface Light is the main type; Spot Light is the alternative. Design target 850 lux is the midpoint (calculator default)." },
      lpd: null },
    { id: "highlight", group: "Showroom (FOH)", name: "Highlight zone",
      min: 700, target: 850, max: 1000, cct: 4000, workPlane: 0.85, defaultH: 3.5, defaultFixture: "gen-surface",
      source: { type: "manual", ref: "p.94, 85, 87", note: "No zone-specific figure; the showroom value (700-1000 lux, 4000K) applies. System-panel Surface Light with indirect light beside the zone." },
      lpd: null },
    { id: "delivery", group: "Showroom (FOH)", name: "Test drive / delivery zone",
      min: 700, target: 850, max: 1000, cct: 4000, workPlane: 0.85, defaultH: 3.5, defaultFixture: "gen-surface",
      source: { type: "manual", ref: "p.94, 267", note: "No zone-specific figure; the showroom value applies. Barrisol Surface Light ceiling with downlights (p.267)." },
      lpd: null },

    /* ---------- Customer & Office : IS 3646 (manual has no figure) ---------- */
    { id: "reception", group: "Customer & Office", name: "Reception / information desk",
      min: 300, target: 500, max: 750, cct: 4000, workPlane: 0.85, defaultH: 3.0, defaultFixture: "gen-downlight",
      source: { type: "is3646", ref: "cl. 23.1.2 Enquiry desks", note: "300-500-750 lux. CCT 4000K follows the showroom (assumption)." },
      lpd: { value: 9.1, ref: "Lobby" } },
    { id: "service-reception", group: "Customer & Office", name: "Service reception",
      min: 300, target: 500, max: 750, cct: 4000, workPlane: 0.85, defaultH: 3.0, defaultFixture: "gen-downlight",
      source: { type: "is3646", ref: "cl. 23.1.2 Enquiry desks (nearest item)", note: "No direct item in IS 3646. Nearest item used - confirm with the project lead." },
      lpd: { value: 9.1, ref: "Lobby" } },
    { id: "lounge", group: "Customer & Office", name: "Customer lounge / waiting",
      min: 150, target: 200, max: 300, cct: 4000, workPlane: 0.85, defaultH: 3.0, defaultFixture: "gen-downlight",
      source: { type: "is3646", ref: "cl. 23.1.1 Entrance halls, lobbies, waiting rooms", note: "150-200-300 lux. Manual shows Indirect Light at the lounge bar (p.83) without a figure." },
      lpd: { value: 9.1, ref: "Lobby" } },
    { id: "consultation", group: "Customer & Office", name: "Consultation / meeting room",
      min: 300, target: 500, max: 750, cct: 4000, workPlane: 0.85, defaultH: 3.0, defaultFixture: "gen-downlight",
      source: { type: "is3646", ref: "cl. 17.1.4 Conference rooms, executive offices", note: "300-500-750 lux. Manual shows Linear Pendant Lighting (p.27) without a figure." },
      lpd: { value: 11.5, ref: "Conference/Meeting" } },
    { id: "office", group: "Customer & Office", name: "Office (BOH)",
      min: 300, target: 500, max: 750, cct: 4000, workPlane: 0.85, defaultH: 2.7, defaultFixture: "gen-downlight",
      source: { type: "is3646", ref: "cl. 17.1.1 General offices", note: "300-500-750 lux. Manual: BOH uses the standard Spot Light (p.94), no figure." },
      lpd: { value: 10.0, ref: "Business, Enclosed / Open Plan" } },

    /* ---------- Workshop : GDSI manual ---------- */
    { id: "workshop", group: "Workshop", name: "Workshop - general service bay",
      min: 750, target: 750, max: null, cct: null, workPlane: 0.75, defaultH: 4.8, defaultFixture: "gen-highbay",
      source: { type: "manual", ref: "p.121", note: "Minimum 750 lux. Ceiling height minimum 4.8 m. Explosion-proof lighting where flammables are stored." },
      lpd: { value: 17.1, ref: "Workshop" } },
    { id: "ev-stall", group: "Workshop", name: "FCEV / EV stall",
      min: 800, target: 800, max: null, cct: null, workPlane: 0.75, defaultH: 4.8, defaultFixture: "gen-exproof",
      source: { type: "manual", ref: "p.175-183", note: "Average 800 lux, explosion-proof type. Manual example: 20 points for a 2+1 bay (12.55 x 8.75 m), 12 points for a 1+1 bay (8.26 x 8.75 m)." },
      lpd: { value: 17.1, ref: "Workshop" } },
    { id: "car-wash", group: "Workshop", name: "Car wash bay",
      min: 200, target: 300, max: 500, cct: null, workPlane: 0.75, defaultH: 4.0, defaultFixture: "gen-linear",
      source: { type: "is3646", ref: "cl. 18.1.2 General repairs, servicing, washing, polishing", note: "200-300-500 lux. Use a wet-location rated fixture." },
      lpd: { value: 6.8, ref: "Business, Service/Repair" } },

    /* ---------- Body & Paint : GDSI manual ---------- */
    { id: "body-repair", group: "Body & Paint", name: "Body & frame repair",
      min: 700, target: 700, max: null, cct: null, workPlane: 0.75, defaultH: 4.8, defaultFixture: "gen-highbay",
      source: { type: "manual", ref: "p.139", note: "Minimum 700 lux. Bay 4.5 x 7.5 m." },
      lpd: { value: 17.1, ref: "Workshop" } },
    { id: "wheel-alignment", group: "Body & Paint", name: "Wheel alignment (B&P)",
      min: 700, target: 700, max: null, cct: null, workPlane: 0.75, defaultH: 4.8, defaultFixture: "gen-highbay",
      source: { type: "manual", ref: "p.139", note: "Minimum 700 lux. Bay 4.5 x 5.0 m." },
      lpd: { value: 17.1, ref: "Workshop" } },
    { id: "putty", group: "Body & Paint", name: "Putty",
      min: 700, target: 700, max: null, cct: null, workPlane: 0.75, defaultH: 4.8, defaultFixture: "gen-linear",
      source: { type: "manual", ref: "p.139", note: "Minimum 700 lux. Bay 4.5 x 7.5 m." },
      lpd: { value: 17.1, ref: "Workshop" } },
    { id: "surface-prep", group: "Body & Paint", name: "Surface preparation",
      min: 500, target: 500, max: null, cct: null, workPlane: 0.75, defaultH: 4.8, defaultFixture: "gen-linear",
      source: { type: "manual", ref: "p.139", note: "Minimum 500 lux. Bay 4.5 x 7.5 m." },
      lpd: { value: 17.1, ref: "Workshop" } },
    { id: "paint-booth", group: "Body & Paint", name: "Paint booth",
      min: 1000, target: 1000, max: null, cct: null, workPlane: 0.75, defaultH: 3.0, defaultFixture: "gen-linear",
      source: { type: "manual", ref: "p.140", note: "Minimum 1,000 lux. Lamps on ceiling and side walls. Booth 5.4 x 7.5 m. Booth lighting is normally supplied with the booth - confirm with the booth vendor." },
      lpd: { value: 17.1, ref: "Workshop" } },
    { id: "polishing", group: "Body & Paint", name: "Polishing",
      min: 1000, target: 1000, max: null, cct: null, workPlane: 0.75, defaultH: 4.8, defaultFixture: "gen-linear",
      source: { type: "manual", ref: "p.140", note: "Minimum 1,000 lux. Bay 4.0 x 7.0 m." },
      lpd: { value: 17.1, ref: "Workshop" } },
    { id: "paint-mixing", group: "Body & Paint", name: "Paint mixing room",
      min: 1000, target: 1000, max: null, cct: null, workPlane: 0.85, defaultH: 3.0, defaultFixture: "gen-exproof",
      source: { type: "manual", ref: "p.140", note: "Minimum 1,000 lux. Spot light for colour comparison required. Room 3.0 x 6.0 m." },
      lpd: { value: 17.1, ref: "Workshop" } },

    /* ---------- Parts & Storage ---------- */
    { id: "parts", group: "Parts & Storage", name: "Parts zone",
      min: 300, target: 350, max: 400, cct: null, workPlane: 0.85, defaultH: 3.0, defaultFixture: "gen-linear",
      source: { type: "manual", ref: "p.142", note: "300-400 lux preferred. Install above the aisles. Ceiling height minimum 2.4 m." },
      lpd: { value: 6.8, ref: "Storage" } },
    { id: "storage", group: "Parts & Storage", name: "Store room (general)",
      min: 50, target: 100, max: 150, cct: null, workPlane: 0.85, defaultH: 3.0, defaultFixture: "gen-downlight",
      source: { type: "is3646", ref: "cl. 16.2.1 Storage, no detail perception", note: "50-100-150 lux. If items must be identified in detail use 100-150-200 (cl. 16.2.2)." },
      lpd: { value: 6.8, ref: "Storage" } },

    /* ---------- Circulation & Service : IS 3646 ---------- */
    { id: "corridor", group: "Circulation & Service", name: "Corridor / passage / stairs",
      min: 50, target: 100, max: 150, cct: null, workPlane: 0, defaultH: 2.7, defaultFixture: "gen-downlight",
      source: { type: "is3646", ref: "cl. 23.2.2 Corridors, passageways, stairs", note: "50-100-150 lux, measured at floor level." },
      lpd: { value: 7.1, ref: "Corridor/Transition" } },
    { id: "toilet", group: "Circulation & Service", name: "Toilet",
      min: 50, target: 100, max: 150, cct: null, workPlane: 0.85, defaultH: 2.7, defaultFixture: "gen-downlight",
      source: { type: "is3646", ref: "cl. 23.4.1 Changing, locker, cleaners rooms, cloakrooms, lavatories", note: "50-100-150 lux." },
      lpd: { value: 7.7, ref: "Restroom" } },
    { id: "locker", group: "Circulation & Service", name: "Staff locker room",
      min: 50, target: 100, max: 150, cct: null, workPlane: 0.85, defaultH: 2.7, defaultFixture: "gen-downlight",
      source: { type: "is3646", ref: "cl. 23.4.1 Changing, locker, cleaners rooms, cloakrooms, lavatories", note: "50-100-150 lux." },
      lpd: null },
    { id: "rest-room", group: "Circulation & Service", name: "Staff rest room",
      min: 100, target: 150, max: 200, cct: null, workPlane: 0.85, defaultH: 2.7, defaultFixture: "gen-downlight",
      source: { type: "is3646", ref: "cl. 23.4.2 Rest rooms", note: "100-150-200 lux." },
      lpd: null },
    { id: "pantry", group: "Circulation & Service", name: "Pantry / cafe / canteen",
      min: 150, target: 200, max: 300, cct: null, workPlane: 0.85, defaultH: 2.7, defaultFixture: "gen-downlight",
      source: { type: "is3646", ref: "cl. 23.5.1 Canteens, cafeterias, dining rooms", note: "150-200-300 lux." },
      lpd: null },
    { id: "plant-room", group: "Circulation & Service", name: "Electrical / mechanical room",
      min: 100, target: 150, max: 200, cct: null, workPlane: 0.85, defaultH: 3.0, defaultFixture: "gen-downlight",
      source: { type: "is3646", ref: "cl. 23.7.1.5 / 23.7.1.6 Plant and electrical rooms", note: "100-150-200 lux." },
      lpd: { value: 7.1, ref: "Electrical/Mechanical" } },

    /* ---------- Parking & Exterior ---------- */
    { id: "parking-indoor", group: "Parking & Exterior", name: "Indoor parking",
      min: 20, target: 30, max: 50, cct: null, workPlane: 0, defaultH: 3.0, defaultFixture: "gen-downlight",
      source: { type: "is3646", ref: "cl. 18.1.1 Interior parking areas", note: "20-30-50 lux, measured at floor level." },
      lpd: { value: 2.2, ref: "Parking Bays (covered/basement)" } },
    { outdoor: true, id: "parking-outdoor", group: "Parking & Exterior", name: "Outdoor parking / access road",
      min: 5, target: 20, max: null, cct: null, workPlane: 0, defaultH: 6.0, defaultFixture: "gen-highbay",
      source: { type: "is3646", ref: "cl. 23.8.1.5 Outdoor car parks", note: "5-20 lux. The room method is for interiors; an outdoor result is a rough count only - confirm with a pole-lighting calculation." },
      lpd: null },
    { outdoor: true, id: "outdoor-display", group: "Parking & Exterior", name: "Outdoor vehicle display",
      min: null, target: null, max: null, cct: null, workPlane: 0, defaultH: 6.0, defaultFixture: "gen-highbay",
      source: { type: "none", ref: "", note: "No figure in the GDSI manual or IS 3646 Part 1 (interior code). Enter the target agreed for the project. Outdoor result is a rough count only." },
      lpd: null },
    { id: "custom", group: "Parking & Exterior", name: "Other (enter target)",
      min: null, target: null, max: null, cct: null, workPlane: 0.85, defaultH: 3.0, defaultFixture: "gen-downlight",
      source: { type: "none", ref: "", note: "Space type not in the table. Enter the target illuminance." },
      lpd: null }
  ]
};
