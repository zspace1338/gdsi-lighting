/* Run: node test/calc.test.js */
const assert = require("assert");
const path = require("path");
const C = require(path.join(__dirname, "..", "js", "calc.js"));

global.window = {};
require(path.join(__dirname, "..", "data", "standards.js"));
require(path.join(__dirname, "..", "data", "fixtures.js"));
const STD = window.GDSI_STANDARDS, FX = window.GDSI_FIXTURES;
const std = (id) => STD.spaces.find((s) => s.id === id);
const fx = (id) => FX.find((f) => f.id === id);
const S = { mf: 0.8, reflectance: "light" };

// UF interpolation: table ends clamp, midpoint is linear.
assert.strictEqual(C.interpUF(0.1), 0.42);
assert.strictEqual(C.interpUF(9), 0.85);
assert.ok(Math.abs(C.interpUF(1.75) - 0.69) < 1e-9);

// Hand check: office 6 x 4 x 2.7 m, 500 lux, downlight 1500 lm.
// Hm = 2.7 - 0.85 = 1.85, K = 24 / (1.85 * 10) = 1.297, UF = 0.62 + (1.297-1.25)/0.25*0.04 = 0.6276
// N = 500 * 24 / (1500 * 0.6276 * 0.8) = 15.93 -> 16
let r = C.calcRoom({ length: 6, width: 4, height: 2.7 }, std("office"), fx("gen-downlight"), S);
assert.strictEqual(r.qtyRequired, 16);
assert.ok(Math.abs(r.K - 1.2973) < 1e-3);
assert.ok(Math.abs(r.UF - 0.6276) < 1e-3);
assert.ok(r.qty >= 16 && r.achieved >= 500, "office meets 500 lux");
assert.strictEqual(r.positions.length, r.qty);

// Every standard with a target must reach its minimum with its default fixture.
for (const s of STD.spaces) {
  const f = fx(s.defaultFixture);
  assert.ok(f, "default fixture exists for " + s.id);
  const res = C.calcRoom({ length: 12, width: 8, height: s.defaultH }, s, f, S, fx("gen-spot"));
  if (s.target !== null) assert.notStrictEqual(res.status, "fail", s.id + " must reach its minimum");
  if (s.target === null) { assert.strictEqual(res.status, "error", s.id + " needs a target"); continue; }
  assert.notStrictEqual(res.status, "error", s.id + ": " + res.messages.join("; "));
  if (res.status !== "fail") assert.ok(res.achieved >= s.min - 0.5, s.id + " reaches min");
  console.log(s.id.padEnd(18), String(res.qty).padStart(4), (res.unit + (res.suppQty ? "+" + res.suppQty : "")).padEnd(8), String(Math.round(res.achieved)).padStart(5) + " lux", res.status, res.messages.length ? "| " + res.messages[0] : "");
}

// Swapped sides give the same answer; user target overrides the table; missing input is an error.
const a = C.calcRoom({ length: 5, width: 9, height: 3 }, std("reception"), fx("gen-downlight"), S);
const b = C.calcRoom({ length: 9, width: 5, height: 3 }, std("reception"), fx("gen-downlight"), S);
assert.strictEqual(a.qty, b.qty);
assert.strictEqual(C.calcRoom({ length: 5, width: 5, height: 3, targetLux: "200" }, std("custom"), fx("gen-downlight"), S).target, 200);
assert.strictEqual(C.calcRoom({ length: "", width: 5, height: 3 }, std("office"), fx("gen-downlight"), S).status, "error");
assert.strictEqual(C.calcRoom({ length: 5, width: 5, height: 1 }, std("office"), fx("gen-downlight"), S).status, "error");

console.log("all tests passed");
