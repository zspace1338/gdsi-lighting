/* GDSI Lighting Calculator - calculation core (lumen method).
 * Pure functions, no DOM. Loaded by the browser and by Node tests.
 *
 *   N = E x A / (F x UF x MF)
 *   K = L x W / (Hm x (L + W))        room index
 *   Hm = ceiling height - suspension - work plane height
 *
 * UF tables below are GENERIC values for a direct-distribution LED fixture.
 * They are an assumption, not manufacturer data. A registered fixture may carry its own UF table.
 */
(function (root) {
  "use strict";

  var UF_K = [0.6, 0.8, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];
  var UF_TABLES = {
    light:  { label: "Light finishes (ceiling 70 / wall 50 / floor 20 %)", uf: [0.42, 0.50, 0.56, 0.62, 0.66, 0.72, 0.76, 0.79, 0.83, 0.85] },
    medium: { label: "Medium finishes (50 / 30 / 20 %)",                   uf: [0.36, 0.44, 0.50, 0.56, 0.60, 0.66, 0.70, 0.73, 0.77, 0.80] },
    dark:   { label: "Dark finishes / open ceiling (30 / 10 / 10 %)",      uf: [0.31, 0.39, 0.45, 0.51, 0.55, 0.61, 0.65, 0.68, 0.73, 0.76] }
  };

  function num(v) {
    if (v === null || v === undefined || v === "") return null;
    var n = Number(v);
    return isFinite(n) ? n : null;
  }

  function interpUF(k, table) {
    var uf = table || UF_TABLES.light.uf;
    if (k <= UF_K[0]) return uf[0];
    var last = UF_K.length - 1;
    if (k >= UF_K[last]) return uf[last];
    for (var i = 0; i < last; i++) {
      if (k <= UF_K[i + 1]) {
        var t = (k - UF_K[i]) / (UF_K[i + 1] - UF_K[i]);
        return uf[i] + t * (uf[i + 1] - uf[i]);
      }
    }
    return uf[last];
  }

  /* Smallest regular grid holding at least n points, with spacing as square as possible. */
  function bestGrid(n, L, W, minCols, minRows) {
    var best = null;
    minCols = minCols || 1; minRows = minRows || 1;
    for (var cols = minCols; cols <= Math.max(n, minCols); cols++) {
      var rows = Math.max(minRows, Math.ceil(n / cols));
      var count = rows * cols;
      var sx = L / cols, sy = W / rows;
      var cost = ((count - n) / n) * 2 + Math.abs(Math.log(sx / sy));
      if (!best || cost < best.cost) best = { cols: cols, rows: rows, count: count, sx: sx, sy: sy, cost: cost };
    }
    return best;
  }

  function round(v, d) { var p = Math.pow(10, d || 0); return Math.round(v * p) / p; }

  /* room: {length, width, height, suspension, workPlane, targetLux}
   * std:  one entry of GDSI_STANDARDS.spaces
   * fx:   one fixture
   * settings: {mf, reflectance}
   */
  function calcRoom(room, std, fx, settings, supplement) {
    var out = { status: "error", messages: [], positions: [], strips: [] };
    var L = num(room.length), W = num(room.width), H = num(room.height);
    if (!L || !W || L <= 0 || W <= 0) { out.messages.push("Enter room length and width."); return out; }
    if (!H || H <= 0) { out.messages.push("Enter the ceiling height."); return out; }
    if (L < W) { var t = L; L = W; W = t; out.swapped = true; }
    if (!fx) { out.messages.push("Select a fixture."); return out; }

    var target = num(room.targetLux);
    var userTarget = target !== null;
    if (target === null) target = std ? num(std.target) : null;
    if (!target || target <= 0) { out.messages.push("No standard figure for this space - enter the target illuminance."); return out; }

    var hw = num(room.workPlane); if (hw === null) hw = std && num(std.workPlane) !== null ? std.workPlane : 0.85;
    var susp = num(room.suspension) || 0;
    var Hm = H - susp - hw;
    if (Hm <= 0.3) { out.messages.push("Mounting height above the work plane is too small - check ceiling height."); return out; }

    var mf = num(settings && settings.mf) || 0.8;
    var preset = UF_TABLES[(settings && settings.reflectance) || "light"] || UF_TABLES.light;
    var A = L * W;
    var K = (L * W) / (Hm * (L + W));
    var UF = interpUF(K, fx.ufTable && fx.ufTable.length === UF_K.length ? fx.ufTable : preset.uf);
    var lm = num(fx.lm), watt = num(fx.watt) || 0;
    if (!lm || lm <= 0) { out.messages.push("The selected fixture has no lumen output."); return out; }

    out.L = L; out.W = W; out.area = A; out.Hm = Hm; out.workPlane = hw; out.K = K; out.UF = UF; out.MF = mf;
    out.target = target; out.userTarget = userTarget; out.kind = fx.kind;

    var requiredLm = (target * A) / (UF * mf);
    out.requiredLm = requiredLm;

    if (fx.kind === "surface") {
      var mw = num(fx.moduleWidth) || 1.5, gap = num(fx.gap) || 2.4;
      var reqArea = requiredLm / lm;
      var maxStrips = Math.max(1, Math.floor((W + gap) / (mw + gap)));
      var n = Math.max(1, Math.ceil(reqArea / (mw * L)));
      var fits = n <= maxStrips;
      if (!fits) n = maxStrips;
      var len = fits ? Math.min(L, Math.ceil((reqArea / (n * mw)) * 10) / 10) : L;
      var lumArea = n * mw * len;
      out.qty = n; out.unit = "strip";
      out.stripLength = len; out.moduleWidth = mw; out.luminousArea = lumArea; out.coverage = lumArea / A;
      out.totalLm = lumArea * lm; out.totalWatt = lumArea * watt;
      var pitch = fits && n > 1 ? Math.min(mw + gap, W / n) : W / n;
      var y0 = (W - (pitch * (n - 1) + mw)) / 2;
      for (var s = 0; s < n; s++) out.strips.push({ x: (L - len) / 2, y: y0 + s * pitch, w: len, h: mw });
      out.pitch = pitch;
      if (!fits) {
        /* The manual module (1,500 wide / 2,400 break) caps the luminous area. Top up with spot lights in the breaks. */
        var surfaceLux = (out.totalLm * UF * mf) / A;
        var sLm = supplement ? num(supplement.lm) : null;
        if (sLm) {
          var bands = [];
          if (y0 > 0.6) bands.push(y0 / 2);
          for (var b = 0; b < n - 1; b++) bands.push(y0 + b * pitch + mw + (pitch - mw) / 2);
          if (y0 > 0.6) bands.push(W - y0 / 2);
          if (!bands.length) bands.push(W / 2);
          var need = Math.ceil((requiredLm - out.totalLm) / sLm);
          var per = Math.ceil(need / bands.length);
          out.suppQty = per * bands.length; out.suppName = supplement.name; out.suppId = supplement.id; out.surfaceLux = surfaceLux;
          for (var bi = 0; bi < bands.length; bi++) for (var pi = 0; pi < per; pi++) out.positions.push({ x: (pi + 0.5) * (L / per), y: bands[bi] });
          out.totalLm += out.suppQty * sLm; out.totalWatt += out.suppQty * (num(supplement.watt) || 0);
          out.info = "Surface Light at the manual module (1,500 wide / 2,400 break) gives " + round(surfaceLux) + " lux. " + out.suppQty + " spot lights are added in the breaks to reach the target.";
        } else {
          out.messages.push("Surface Light alone cannot reach the target with the 1,500 / 2,400 mm module. Add spot lights or use a higher-output Surface Light.");
        }
      }
    } else {
      var nReq = Math.max(1, Math.ceil(requiredLm / lm));
      var shrMax = num(fx.shr) || 1.5;
      var outdoor = !!(std && std.outdoor);
      var maxSp = shrMax * Hm;
      var g = outdoor ? bestGrid(nReq, L, W) : bestGrid(nReq, L, W, Math.ceil(L / maxSp - 1e-9), Math.ceil(W / maxSp - 1e-9));
      out.qtyRequired = nReq; out.qty = g.count; out.unit = "pc";
      out.cols = g.cols; out.rows = g.rows; out.sx = g.sx; out.sy = g.sy;
      out.totalLm = g.count * lm; out.totalWatt = g.count * watt;
      for (var j = 0; j < g.rows; j++) for (var i = 0; i < g.cols; i++) out.positions.push({ x: (i + 0.5) * g.sx, y: (j + 0.5) * g.sy });
      out.shr = Math.max(g.sx, g.sy) / Hm; out.shrMax = shrMax;
      if (g.count > nReq * 1.2 + 1) out.info = nReq + " pcs give the target lux; " + g.count + " are used so the spacing stays within " + shrMax + " x mounting height (even light).";
      if (fx.kind === "linear") out.lineLength = num(fx.length) || 1.2;
    }

    out.achieved = (out.totalLm * UF * mf) / A;
    out.lpd = out.totalWatt / A;

    var min = userTarget ? target : (std && num(std.min) !== null ? std.min : target);
    var max = userTarget ? null : (std ? num(std.max) : null);
    out.min = min; out.max = max;
    if (out.achieved < min - 0.5) {
      out.status = "fail";
      out.messages.push("Below the required " + round(min) + " lux.");
    } else if (max !== null && out.achieved > max * 1.1) {
      out.status = "over";
      out.messages.push("Above the recommended maximum " + round(max) + " lux - a lower-output fixture would save energy.");
    } else {
      out.status = out.messages.length ? "warn" : "ok";
    }
    if (std && std.lpd && out.lpd > std.lpd.value + 1e-9) {
      out.lpdOver = true;
      out.messages.push("Power density " + round(out.lpd, 1) + " W/m2 is above the ECBC 2017 reference " + std.lpd.value + " W/m2 (" + std.lpd.ref + ").");
    }
    return out;
  }

  var api = { UF_K: UF_K, UF_TABLES: UF_TABLES, interpUF: interpUF, bestGrid: bestGrid, calcRoom: calcRoom, round: round, num: num };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GDSICalc = api;
})(typeof window !== "undefined" ? window : this);
