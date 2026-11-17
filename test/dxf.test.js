/* Run: node test/dxf.test.js */
const assert = require("assert");
const path = require("path");
const X = require(path.join(__dirname, "..", "js", "dxf.js"));

// Ceiling height texts
assert.strictEqual(X.parseCH("CL-01  CH +3,000"), 3);
assert.strictEqual(X.parseCH("C.H. 2700"), 2.7);
assert.strictEqual(X.parseCH("CH=2.85"), 2.85);
assert.strictEqual(X.parseCH("CH+3.85"), 3.85);
assert.strictEqual(X.parseCH("CHAIR"), null);
assert.strictEqual(X.parseCH("CASHIER"), null);

// Space type from room names
assert.strictEqual(X.guessUse("SHOWROOM DISPLAY"), "showroom");
assert.strictEqual(X.guessUse("SERVICE RECEPTION"), "service-reception");
assert.strictEqual(X.guessUse("RECEPTION BRANDWALL"), "reception");
assert.strictEqual(X.guessUse("MEN TOILET"), "toilet");
assert.strictEqual(X.guessUse("WHEEL ALIGNMENT"), "wheel-alignment");
assert.strictEqual(X.guessUse("GUDANG"), "storage");
assert.strictEqual(X.guessUse("XYZ"), null);

// Equivalent rectangle keeps area and perimeter
const r = X.equivRect(24, 20);
assert.ok(Math.abs(r.L - 6) < 1e-9 && Math.abs(r.W - 4) < 1e-9);
const L = X.equivRect(48, 32); // L-shape 8x8 minus 4x4: A 48, P 32
assert.ok(Math.abs(r.L * r.W - 24) < 1e-9 && Math.abs(L.L * L.W - 48) < 1e-9 && Math.abs(2 * (L.L + L.W) - 32) < 1e-9);

// Minimal DXF in mm: two rooms as closed outlines, plus walls of the same rooms
function lw(layer, pts) {
  return ["0", "LWPOLYLINE", "8", layer, "90", String(pts.length), "70", "1"].concat(...pts.map((p) => ["10", String(p[0]), "20", String(p[1])]));
}
function txt(layer, s, x, y, h) { return ["0", "TEXT", "8", layer, "10", String(x), "20", String(y), "40", String(h), "1", s]; }
const ents = [].concat(
  lw("A-ROOM", [[0, 0], [6000, 0], [6000, 4000], [0, 4000]]),
  lw("A-ROOM", [[6000, 0], [10000, 0], [10000, 4000], [6000, 4000]]),
  lw("A-WALL", [[0, 0], [10000, 0], [10000, 4000], [0, 4000]]),
  ["0", "LINE", "8", "A-WALL", "10", "6000", "20", "0", "11", "6000", "21", "4000"],
  txt("A-ROOM-NAME", "SALES OFFICE", 3000, 2000, 300), txt("A-TAG", "CH 2700", 3000, 1000, 150),
  txt("A-ROOM-NAME", "MEN TOILET 10 SQ.M", 8000, 2000, 300)
);
const dxf = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"].concat(ents, ["0", "ENDSEC", "0", "EOF"]).join("\n");
const doc = X.parse(dxf);
const det = X.detect(doc);
assert.strictEqual(det.scale, 0.001);
assert.strictEqual(det.mode, "outline");
assert.strictEqual(det.layer, "A-ROOM");
const out = X.roomsFromOutlines(doc, { layer: "A-ROOM", scale: 0.001 });
assert.strictEqual(out.rooms.length, 2);
const office = out.rooms.find((x) => x.name === "SALES OFFICE");
assert.ok(office && office.use === "office" && Math.abs(office.area - 24) < 1e-6 && office.ch === 2.7);
const wc = out.rooms.find((x) => x.use === "toilet");
assert.strictEqual(wc.name, "MEN TOILET"); // area note stripped
assert.ok(Math.abs(wc.area - 16) < 1e-6);

// Same rooms from the walls only (flood fill), within 3 % of the true area
const w = X.roomsFromWalls(doc, { wallLayers: ["A-WALL"], scale: 0.001, gap: 0.5 });
assert.strictEqual(w.rooms.length, 2);
const o2 = w.rooms.find((x) => x.use === "office");
assert.ok(Math.abs(o2.area - 24) / 24 < 0.03, "walls area " + o2.area);
assert.strictEqual(o2.ch, 2.7);

console.log("dxf tests passed");
