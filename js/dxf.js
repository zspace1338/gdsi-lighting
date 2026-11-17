/* GDSI Lighting Calculator - whole-drawing import (DXF floor plan or reflected ceiling plan).
 * Pure functions, no DOM. Loaded by the browser and by Node tests.
 *
 * Two ways to find rooms:
 *   "outline" - closed polylines on one layer are the room boundaries (zone / area / room layer).
 *   "walls"   - no boundaries drawn: wall layers are rasterised to a grid and each room-name text is
 *               flood-filled. Door openings are bridged by a morphological closing (gap width).
 *               Regions that leak to the drawing edge are open space and are skipped.
 *
 * Irregular rooms become an equivalent rectangle with the SAME area and perimeter, so the room index
 * K = A / (Hm x P/2) used by the lumen method is exact.
 * Ceiling heights are read from texts such as "CH +3,000", "C.H. 2700", "CH=2.85" inside the room.
 */
(function (root) {
  "use strict";

  var UNIT_SCALE = { 1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1 };
  var UNIT_NAME = { 1: "inch", 2: "feet", 4: "mm", 5: "cm", 6: "m" };

  /* ---------------- parser ---------------- */
  function cleanText(s) {
    return String(s || "")
      .replace(/\\U\+([0-9A-Fa-f]{4})/g, function (m, h) { return String.fromCharCode(parseInt(h, 16)); })
      .replace(/\\P/g, " ").replace(/\\~/g, " ")
      .replace(/\\[ACcFfHhQqTtWwpS][^;\\{}]*;/g, "")
      .replace(/\\[LlOoKkNn]/g, "")
      .replace(/[{}]/g, "")
      .replace(/%%[pP]/g, "±").replace(/%%[cC]/g, "Ø").replace(/%%[dD]/g, "°").replace(/%%[uUoO]/g, "")
      .replace(/\s+/g, " ").trim();
  }

  function arcPts(cx, cy, r, a0, a1, mirror) {
    while (a1 <= a0) a1 += 360;
    var n = Math.max(4, Math.ceil((a1 - a0) / 15)), out = [];
    for (var i = 0; i <= n; i++) {
      var a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
      out.push([(mirror ? -1 : 1) * (cx + r * Math.cos(a)), cy + r * Math.sin(a)]);
    }
    return out;
  }

  /* bulge between p and q -> intermediate arc points (p excluded, q excluded) */
  function bulgePts(p, q, b) {
    if (!b || Math.abs(b) < 1e-9) return [];
    var dx = q[0] - p[0], dy = q[1] - p[1], c = Math.sqrt(dx * dx + dy * dy); if (!c) return [];
    var th = 4 * Math.atan(b), r = c / (2 * Math.sin(th / 2));
    var mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, h = r * Math.cos(th / 2);
    var cx = mx - h * dy / c, cy = my + h * dx / c;
    var a0 = Math.atan2(p[1] - cy, p[0] - cx), n = Math.max(2, Math.ceil(Math.abs(th) / (Math.PI / 12))), out = [];
    for (var i = 1; i < n; i++) { var a = a0 + th * i / n; out.push([cx + Math.abs(r) * Math.cos(a), cy + Math.abs(r) * Math.sin(a)]); }
    return out;
  }

  function parse(text) {
    var L = String(text).split(/\r?\n/), doc = { insunits: 0, paths: [], texts: [], layers: {} };
    var i = 0, n = L.length - 1, section = null, ent = null, d = null, poly = null;
    function layer(name) { if (!doc.layers[name]) doc.layers[name] = { name: name, closed: 0, paths: 0, texts: 0 }; return doc.layers[name]; }
    function g(c) { return d[c] ? d[c][0] : undefined; }
    function f(c, def) { var v = parseFloat(g(c)); return isFinite(v) ? v : def; }
    function flush() {
      if (!ent || !d) return;
      if (g("67") === "1") return; /* paper space */
      var lay = g("8") || "0", mir = f("230", 1) < 0, sx = mir ? -1 : 1;
      if (ent === "LWPOLYLINE") {
        var xs = d["10"] || [], ys = d["20"] || [], pts = [];
        var bul = d._bulge || [];
        for (var k = 0; k < xs.length; k++) {
          var p = [sx * parseFloat(xs[k]), parseFloat(ys[k])];
          pts.push(p);
          var q = k + 1 < xs.length ? [sx * parseFloat(xs[k + 1]), parseFloat(ys[k + 1])] : null;
          var closed = (parseInt(g("70") || "0", 10) & 1) === 1;
          if (!q && closed && xs.length > 2) q = [sx * parseFloat(xs[0]), parseFloat(ys[0])];
          if (q && bul[k]) pts = pts.concat(bulgePts(p, q, (mir ? -1 : 1) * bul[k]));
        }
        addPath(lay, pts, (parseInt(g("70") || "0", 10) & 1) === 1, true);
      } else if (ent === "LINE") {
        addPath(lay, [[f("10", 0), f("20", 0)], [f("11", 0), f("21", 0)]], false, false);
      } else if (ent === "ARC") {
        var a0 = f("50", 0), a1 = f("51", 360);
        addPath(lay, mir ? arcPts(f("10", 0), f("20", 0), f("40", 0), a0, a1, true) : arcPts(f("10", 0), f("20", 0), f("40", 0), a0, a1), false, false);
      } else if (ent === "CIRCLE") {
        var cp = arcPts(f("10", 0), f("20", 0), f("40", 0), 0, 360, mir); cp.pop();
        addPath(lay, cp, true, false);
      } else if (ent === "TEXT" || ent === "ATTRIB" || ent === "MTEXT") {
        if (ent === "ATTRIB" && (parseInt(g("70") || "0", 10) & 1)) return; /* invisible attribute */
        var raw = ent === "MTEXT" ? (d["3"] || []).join("") + (g("1") || "") : g("1");
        var t = cleanText(raw); if (!t) return;
        var al = ent !== "MTEXT" && (parseInt(g("72") || "0", 10) || parseInt(g("74") || g("73") || "0", 10)) && d["11"];
        doc.texts.push({ layer: lay, text: t, x: al ? f("11", 0) : f("10", 0), y: al ? f("21", 0) : f("20", 0), h: f("40", 1) });
        layer(lay).texts++;
      }
    }
    function addPath(lay, pts, closed, pl) {
      if (pts.length < 2) return;
      for (var k = 0; k < pts.length; k++) if (!isFinite(pts[k][0]) || !isFinite(pts[k][1])) return;
      doc.paths.push({ layer: lay, pts: pts, closed: closed, pl: pl });
      var ly = layer(lay); ly.paths++; if (closed && pl && pts.length > 2) ly.closed++;
    }
    while (i < n) {
      var code = L[i].trim(), val = L[i + 1].replace(/\s+$/, ""); i += 2;
      if (code === "0") {
        if (poly && val !== "VERTEX") { if (!poly.skip) addPath(poly.layer, poly.pts, poly.closed, true); poly = null; }
        flush(); ent = null; d = null;
        if (val === "SECTION" || val === "ENDSEC" || val === "EOF") { section = val === "SECTION" ? "?" : null; continue; }
        if (section === "ENTITIES") {
          if (val === "POLYLINE") { ent = "POLYLINE"; d = {}; poly = { layer: "0", closed: false, pts: [], skip: false }; continue; }
          if (val === "VERTEX" && poly) { ent = "VERTEX"; d = {}; continue; }
          ent = val; d = {};
        }
        continue;
      }
      if (section === "?" && code === "2") { section = val.trim(); continue; }
      if (section === "HEADER" && code === "9" && val.trim() === "$INSUNITS") { if (L[i].trim() === "70") doc.insunits = parseInt(L[i + 1], 10) || 0; continue; }
      if (!d) continue;
      if (ent === "LWPOLYLINE" && code === "42") { (d._bulge = d._bulge || [])[(d["10"] || []).length - 1] = parseFloat(val); continue; }
      (d[code] = d[code] || []).push(code === "1" || code === "3" ? val : val.trim());
      /* old-style POLYLINE: start collecting once its header is read (first VERTEX ends it) */
      if (ent === "POLYLINE" && poly) {
        if (code === "8") poly.layer = val.trim();
        if (code === "67" && val.trim() === "1") poly.skip = true;
        if (code === "70") { var fl = parseInt(val, 10) || 0; poly.closed = (fl & 1) === 1; if (fl & (16 | 64)) poly.skip = true; }
      }
      if (ent === "VERTEX" && poly && code === "20") poly.pts.push([parseFloat(d["10"][0]), parseFloat(val)]);
    }
    if (poly && !poly.skip) addPath(poly.layer, poly.pts, poly.closed, true);
    flush();
    return doc;
  }

  /* ---------------- geometry ---------------- */
  function areaPerim(pts) {
    var a = 0, p = 0;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
      p += Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
    }
    return { area: Math.abs(a / 2), perim: p };
  }
  function bbox(pts) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    pts.forEach(function (p) { if (p[0] < b[0]) b[0] = p[0]; if (p[1] < b[1]) b[1] = p[1]; if (p[0] > b[2]) b[2] = p[0]; if (p[1] > b[3]) b[3] = p[1]; });
    return b;
  }
  function inside(x, y, pts) {
    var c = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  }
  /* rectangle with the same area and perimeter (L >= W). Falls back to a square when P < 4 sqrt(A). */
  function equivRect(A, P) {
    var s = P / 2, disc = s * s - 4 * A;
    if (!(A > 0)) return { L: 0, W: 0 };
    if (disc <= 0) { var q = Math.sqrt(A); return { L: q, W: q }; }
    var Lr = (s + Math.sqrt(disc)) / 2;
    return { L: Lr, W: A / Lr };
  }

  /* ---------------- texts: ceiling height, room name, space type ---------------- */
  var CH_RE = /(?:^|[^A-Z])C\.?\s?H\.?\s*[:=]?\s*\+?\s*(\d{1,2}[,.]\d{3}(?![\d])|\d+(?:\.\d+)?)/i;
  function parseCH(t) {
    var m = CH_RE.exec(String(t || "")); if (!m) return null;
    var s = m[1], v;
    if (/^\d{1,2},\d{3}$/.test(s)) v = parseFloat(s.replace(",", ""));
    else v = parseFloat(s);
    if (!isFinite(v) || v <= 0) return null;
    if (v > 20) v = v / 1000; /* mm */
    return v >= 1.8 && v <= 25 ? Math.round(v * 1000) / 1000 : null;
  }
  function isLabel(t) {
    t = String(t || "");
    if (t.length > 48 || parseCH(t) !== null) return false;
    if (/^[\d\s.,x×*+\-=:%±Ø°()\/]+(mm|m|m2|m²|sqm)?$/i.test(t)) return false; /* numbers, dimensions */
    if (/^(FFL|SSL|FL|EL|LVL|\+|-)\s*[\d±]/i.test(t)) return false;           /* levels */
    if (/^[A-Z]{1,3}[-. ]?\d{1,3}[A-Z]?$/i.test(t)) return false;              /* tags: D1, W-02, CL-01 */
    return (t.match(/[A-Za-zÀ-￿]/g) || []).length >= 3;
  }
  var NAME_LAYER = /ROOM|NAME|ZONE|SPACE|AREA|RUANG|RNAME/i;

  /* keyword -> space type id. Order matters: the first match wins. English + common Indonesian. */
  var USE_RULES = [
    ["service-reception", /SERVICE\s*RECEP|SERVICE\s*ADVIS|\bSA\s*DESK|CUSTOMER\s*INTERACTION|DROP\s*OFF/],
    ["delivery", /DELIVER|HAND\s*OVER|TEST\s*DRIVE/],
    ["highlight", /HIGHLIGHT|HERO\s*ZONE/],
    ["reception", /RECEP|INFORMATION|INFO\s*DESK|CASHIER|KASIR|FRONT\s*DESK/],
    ["lounge", /LOUNGE|WAITING|TUNGGU|CUSTOMER\s*(AREA|ZONE)|KIDS|REFRESH/],
    ["consultation", /CONSULT|MEETING|NEGOTIA|DISCUSSION|CONFERENCE|RAPAT|CLOSING/],
    ["pantry", /PANTRY|CAFE|CANTEEN|KITCHEN|DAPUR|KANTIN|LUNCH|DINING/],
    ["rest-room", /STAFF\s*REST|REST\s+ROOM|REST\s*AREA|DRIVER|ISTIRAHAT|MUSHOLA|PRAYER/],
    ["toilet", /TOILET|\bW\.?C\b|LAVATOR|RESTROOM|WASHROOM|KAMAR\s*MANDI|\bKM\b|SHOWER|URINAL/],
    ["locker", /LOCKER|CHANG(ING|E)\.?\s*(ROOM|RM)|R\.?\s*GANTI/],
    ["ev-stall", /\bEV\b|FCEV|CHARG/],
    ["car-wash", /WASH(?!ROOM)|CUCI/],
    ["wheel-alignment", /ALIGN|BALANC|SPOORING/],
    ["paint-booth", /BOOTH|OVEN/],
    ["paint-mixing", /MIXING|COLOU?R\s*ROOM/],
    ["putty", /PUTTY|DEMPUL/],
    ["surface-prep", /PREP|SANDING/],
    ["polishing", /POLISH/],
    ["body-repair", /BODY|FRAME|PANEL\s*BEAT|\bB\s*&\s*P\b|\bBP\b|KETOK/],
    ["workshop", /WORKSHOP|SERVICE\s*BAY|REPAIR|\bBAYS?\b|QUICK\s*SERVICE|PERIODIC|GENERAL\s*(REPAIR|SERVICE)|BENGKEL|MAINTENANCE|STALL/],
    ["parts", /\bPARTS?\b|SPARE|SUKU\s*CADANG/],
    ["plant-room", /ELECT|\bMDB\b|PANEL\s*ROOM|GENSET|PUMP|POMPA|\bAHU\b|\bMECH|SERVER|\bIT\s*ROOM|COMPRESSOR|\bUPS\b|\bLV\b|\bME\s*ROOM|\bEU\b|SHAFT|RISER/],
    ["storage", /STORE|STORAGE|GUDANG|WAREHOUSE|JANITOR|ARCHIVE|ARSIP|TYRE|TIRE|\bOIL\b|SCRAP|WARRANTY|LUBE/],
    ["office", /OFFICE|MANAGER|\bADMIN|\bGM\b|DIRECTOR|ACCOUNT|FINANCE|KANTOR|WORK\s*STATION|\bHR\b|STAFF/],
    ["corridor", /CORRIDOR|PASSAGE|STAIR|LOBBY|HALL|CIRCULATION|ENTRANCE|TANGGA|KORIDOR|SELASAR|FOYER|VESTIBULE/],
    ["outdoor-display", /OUTDOOR\s*DISPLAY|EXTERNAL\s*DISPLAY/],
    ["parking-outdoor", /(OUTDOOR|OPEN|EXTERNAL)\s*PARK|ACCESS\s*ROAD|DRIVE\s*WAY/],
    ["parking-indoor", /PARKING|CAR\s*PARK|PARKIR/],
    ["showroom", /SHOW\s*ROOM|DISPLAY|EXHIBIT|SALES|BRAND|SHOWCASE/]
  ];
  function guessUse(name) {
    var t = String(name || "").toUpperCase();
    for (var i = 0; i < USE_RULES.length; i++) if (USE_RULES[i][1].test(t)) return USE_RULES[i][0];
    return null;
  }

  var AREA_NOTE = /\(?\s*\d[\d,.]*\s*(SQ\.?\s*FT|SQFT|SFT|SQ\.?\s*M|SQM|M2|M²)\.?\s*\)?/i;
  function stripArea(t) { return String(t).replace(new RegExp(AREA_NOTE.source, "ig"), " ").replace(/\s+/g, " ").replace(/[\s,;:-]+$/, "").trim(); }
  /* room name = the biggest label; a label carrying an area note ("96 SQ.FT.") is almost always the room name */
  function pickName(texts) {
    var seen = {}, names = [];
    texts.filter(function (t) { return isLabel(stripArea(t.text)); })
      .map(function (t) { return { n: stripArea(t.text), s: t.h * (NAME_LAYER.test(t.layer) ? 3 : 1) * (AREA_NOTE.test(t.text) ? 2 : 1) }; })
      .sort(function (a, b) { return b.s - a.s; })
      .forEach(function (o) { var k = o.n.toUpperCase(); if (!seen[k]) { seen[k] = 1; names.push(o.n); } });
    return { name: names.slice(0, 2).join(" / "), all: names };
  }
  function useOf(nm) { return guessUse(nm.all[0]) || guessUse(nm.all.join(" ")); }
  function pickCH(texts) {
    for (var i = 0; i < texts.length; i++) { var v = parseCH(texts[i].text); if (v !== null) return v; }
    return null;
  }

  /* ---------------- auto detection ---------------- */
  function guessScale(doc) {
    if (UNIT_SCALE[doc.insunits]) return { scale: UNIT_SCALE[doc.insunits], unit: UNIT_NAME[doc.insunits], detected: true };
    /* no header: a building drawn in mm is tens of thousands of units across */
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    doc.paths.forEach(function (p) { var q = bbox(p.pts); b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[2]); b[3] = Math.max(b[3], q[3]); });
    var span = Math.max(b[2] - b[0], b[3] - b[1]);
    return span > 2000 ? { scale: 0.001, unit: "mm", detected: false } : { scale: 1, unit: "m", detected: false };
  }

  function outlineLayers(doc, scale) {
    var out = [];
    Object.keys(doc.layers).forEach(function (name) {
      if (!doc.layers[name].closed) return;
      var r = roomsFromOutlines(doc, { layer: name, scale: scale });
      var labelled = r.rooms.filter(function (x) { return x.name; }).length;
      if (r.rooms.length) out.push({ layer: name, rooms: r.rooms.length, labelled: labelled, score: labelled * (NAME_LAYER.test(name) ? 3 : 1) - (/WALL|COL|FURN|EQUIP|GLASS|GLAZ|DOOR|WIN|LEGEND|TITLE|TAG|LIGHT/i.test(name) ? labelled * 0.9 : 0) });
    });
    return out.sort(function (a, b) { return b.score - a.score; });
  }
  var WALL_LAYER = /WALL|PARTITION|COLUMN|\bCOL\b|GLAZ|GLASS|WIN|DOOR|KUSEN|CURTAIN|DINDING|KOLOM|STRUCT|SHUTTER|PINTU|JENDELA/i;
  var NOT_WALL = /HATCH|PATT|DIM|TEXT|TXT|FURN|EQUIP|NOTE|TITLE|LEGEND|GRID|AXIS/i;
  function wallLayerGuess(doc) {
    return Object.keys(doc.layers).filter(function (n) { return WALL_LAYER.test(n) && !NOT_WALL.test(n) && doc.layers[n].paths; });
  }
  var NOT_ROOM = /TEXT|TXT|DOT|DEFPOINT|TITLE|TAG|LEGEND|NOTE|DIM|ANNO|FURN|EQUIP|WALL|COL|GLAS|GLAZ|DOOR|WIN|LIGHT|HATCH|^0$/i;
  function detect(doc) {
    var sc = guessScale(doc), ol = outlineLayers(doc, sc.scale);
    var res = { scale: sc.scale, unit: sc.unit, unitDetected: sc.detected, outlineLayers: ol, wallLayers: wallLayerGuess(doc) };
    var good = ol.filter(function (o) { return o.labelled >= 2 && o.labelled >= o.rooms * 0.5 && (NAME_LAYER.test(o.layer) || o.labelled >= 5) && !NOT_ROOM.test(o.layer); });
    if (good.length) { res.mode = "outline"; res.layer = good[0].layer; }
    else { res.mode = "walls"; res.layer = ol.length ? ol[0].layer : ""; }
    return res;
  }

  /* ---------------- mode 1: closed outlines ---------------- */
  function roomsFromOutlines(doc, opt) {
    var s = opt.scale, polys = [];
    doc.paths.forEach(function (p) {
      if (p.layer !== opt.layer || !p.closed || !p.pl || p.pts.length < 3) return;
      var ap = areaPerim(p.pts), a = ap.area * s * s;
      if (a < 1 || a > 50000) return;
      var c = bbox(p.pts), key = Math.round(a * 10) + ":" + Math.round((c[0] + c[2]) * s) + ":" + Math.round((c[1] + c[3]) * s);
      for (var k = 0; k < polys.length; k++) if (polys[k].key === key) return; /* drawn twice */
      polys.push({ pts: p.pts, area: a, perim: ap.perim * s, bb: c, key: key, texts: [], kids: [] });
    });
    /* each text belongs to the smallest outline that contains it */
    doc.texts.forEach(function (t) {
      var best = null;
      polys.forEach(function (p) {
        if (t.x < p.bb[0] || t.x > p.bb[2] || t.y < p.bb[1] || t.y > p.bb[3]) return;
        if (inside(t.x, t.y, p.pts) && (!best || p.area < best.area)) best = p;
      });
      if (best) best.texts.push(t);
    });
    /* nested labelled outlines: their area is taken out of the parent */
    polys.forEach(function (c) {
      var parent = null, x = c.pts[0][0], y = c.pts[0][1];
      polys.forEach(function (p) { if (p !== c && p.area > c.area && inside((c.bb[0] + c.bb[2]) / 2, (c.bb[1] + c.bb[3]) / 2, p.pts) && inside(x, y, p.pts) && (!parent || p.area < parent.area)) parent = p; });
      if (parent) parent.kids.push(c);
    });
    var rooms = polys.map(function (p) {
      var nm = pickName(p.texts), net = p.area, notes = [];
      var kids = p.kids.filter(function (k) { return pickName(k.texts).name; });
      if (kids.length && nm.name) { kids.forEach(function (k) { net -= k.area; }); notes.push("contains " + kids.length + " zone(s) - their area is taken out"); }
      if (net < 0.5) net = p.area;
      var er = equivRect(net, p.perim), irr = net / ((p.bb[2] - p.bb[0]) * (p.bb[3] - p.bb[1]) * s * s) < 0.92;
      return { name: nm.name, labels: nm.all, use: useOf(nm), area: net, perim: p.perim, L: er.L, W: er.W, ch: pickCH(p.texts), irregular: irr,
        outline: p.pts, bb: p.bb, notes: notes, labelX: (p.bb[0] + p.bb[2]) / 2, labelY: (p.bb[1] + p.bb[3]) / 2 };
    });
    return { rooms: rooms.sort(function (a, b) { return b.area - a.area; }) };
  }

  /* labels strong enough to own part of an open-plan area: a known space name, short, no figures,
   * and among the biggest texts in that area. Same name twice = one seed. */
  function seedLabels(texts) {
    var c = texts.map(function (t) { return { t: t, n: stripArea(t.text), area: AREA_NOTE.test(t.text) }; })
      .filter(function (o) { return isLabel(o.n) && guessUse(o.n) && guessUse(o.n) !== "corridor" && o.n.length <= 32 && o.n.split(" ").length <= 4 && !/\d/.test(o.n); });
    if (!c.length) return [];
    var hmax = Math.max.apply(null, c.map(function (o) { return o.t.h; }));
    var by = {}, out = [];
    c.forEach(function (o) {
      if (!(o.area || o.t.h >= hmax * 0.75)) return;
      var k = o.n.toUpperCase();
      if (!by[k]) { by[k] = { name: o.n, texts: [] }; out.push(by[k]); }
      by[k].texts.push(o.t);
    });
    return out;
  }

  /* ---------------- mode 2: walls + flood fill from room names ---------------- */
  function roomsFromWalls(doc, opt) {
    var s = opt.scale, layers = {}, gap = opt.gap === undefined ? 1.0 : opt.gap;
    (opt.wallLayers || []).forEach(function (n) { layers[n] = 1; });
    var walls = doc.paths.filter(function (p) { return layers[p.layer]; });
    if (!walls.length) return { rooms: [], skipped: 0, error: "No geometry on the selected wall layers." };
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    walls.forEach(function (p) { var q = bbox(p.pts); b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[2]); b[3] = Math.max(b[3], q[3]); });
    var W = (b[2] - b[0]) * s, H = (b[3] - b[1]) * s;
    var cell = Math.max(0.05, Math.sqrt(W * H / 5e6)); /* metres per cell, <= 5 M cells */
    var pad = 3, nx = Math.ceil(W / cell) + 2 * pad, ny = Math.ceil(H / cell) + 2 * pad;
    var grid = new Uint8Array(nx * ny); /* 1 = wall */
    var toX = function (x) { return (x - b[0]) * s / cell + pad; }, toY = function (y) { return (y - b[1]) * s / cell + pad; };
    function seg(x0, y0, x1, y1) {
      var steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2) + 1;
      for (var k = 0; k <= steps; k++) {
        var x = Math.floor(x0 + (x1 - x0) * k / steps), y = Math.floor(y0 + (y1 - y0) * k / steps);
        if (x >= 0 && y >= 0 && x < nx && y < ny) grid[y * nx + x] = 1;
      }
    }
    walls.forEach(function (p) {
      var pts = p.pts, m = p.closed ? pts.length : pts.length - 1;
      for (var k = 0; k < m; k++) { var q = pts[(k + 1) % pts.length]; seg(toX(pts[k][0]), toY(pts[k][1]), toX(q[0]), toY(q[1])); }
    });
    /* chamfer distance (in cells) from walls, for the closing that bridges door openings */
    var INF = 1e9, dist = new Float32Array(nx * ny), x, y, i;
    for (i = 0; i < grid.length; i++) dist[i] = grid[i] ? 0 : INF;
    var D1 = 1, D2 = 1.4142;
    for (y = 0; y < ny; y++) for (x = 0; x < nx; x++) {
      i = y * nx + x; var v = dist[i];
      if (x > 0) v = Math.min(v, dist[i - 1] + D1);
      if (y > 0) { v = Math.min(v, dist[i - nx] + D1); if (x > 0) v = Math.min(v, dist[i - nx - 1] + D2); if (x < nx - 1) v = Math.min(v, dist[i - nx + 1] + D2); }
      dist[i] = v;
    }
    for (y = ny - 1; y >= 0; y--) for (x = nx - 1; x >= 0; x--) {
      i = y * nx + x; var u = dist[i];
      if (x < nx - 1) u = Math.min(u, dist[i + 1] + D1);
      if (y < ny - 1) { u = Math.min(u, dist[i + nx] + D1); if (x < nx - 1) u = Math.min(u, dist[i + nx + 1] + D2); if (x > 0) u = Math.min(u, dist[i + nx - 1] + D2); }
      dist[i] = u;
    }
    var r = gap / 2 / cell; /* openings narrower than "gap" are closed */
    var label = new Int32Array(nx * ny); /* region id + 1 */
    var regions = [], skipped = 0;
    var cand = doc.texts.filter(function (t) { return isLabel(t.text) && t.x >= b[0] && t.x <= b[2] && t.y >= b[1] && t.y <= b[3]; });
    var chTexts = doc.texts.filter(function (t) { return parseCH(t.text) !== null; });
    var stack = new Int32Array(nx * ny);
    cand.forEach(function (t) {
      var cx = Math.floor(toX(t.x)), cy = Math.floor(toY(t.y)), start = -1;
      /* the text insertion point may sit on a line: look for the nearest free cell */
      for (var rad = 0; rad <= 6 && start < 0; rad++) for (var dy = -rad; dy <= rad && start < 0; dy++) for (var dx = -rad; dx <= rad && start < 0; dx++) {
        var xx = cx + dx, yy = cy + dy; if (xx < 0 || yy < 0 || xx >= nx || yy >= ny) continue;
        var j = yy * nx + xx; if (dist[j] > r) start = j;
      }
      if (start < 0) return;
      if (label[start]) { regions[label[start] - 1].texts.push(t); return; }
      var id = regions.length + 1, sp = 0, cells = [], leak = false;
      stack[sp++] = start; label[start] = id;
      while (sp) {
        var c = stack[--sp]; cells.push(c);
        var cxx = c % nx, cyy = (c - cxx) / nx;
        if (cxx <= pad || cyy <= pad || cxx >= nx - pad - 1 || cyy >= ny - pad - 1) leak = true;
        var nb = [c - 1, c + 1, c - nx, c + nx];
        for (var k = 0; k < 4; k++) { var q = nb[k]; if (q >= 0 && q < label.length && !label[q] && dist[q] > r) { label[q] = id; stack[sp++] = q; } }
      }
      regions.push({ id: id, cells: cells, leak: leak, texts: [t] });
    });
    /* grow each region back by r into non-wall cells (closing), nearest region first */
    var frontier = [];
    regions.forEach(function (rg) { if (!rg.leak) rg.cells.forEach(function (c) { frontier.push(c); }); else rg.cells.forEach(function (c) { label[c] = -1; }); });
    for (var step = 0; step < Math.ceil(r) + 1 && frontier.length; step++) {
      var next = [];
      for (var fi = 0; fi < frontier.length; fi++) {
        var c0 = frontier[fi], idn = label[c0], nb2 = [c0 - 1, c0 + 1, c0 - nx, c0 + nx];
        for (var k2 = 0; k2 < 4; k2++) { var q2 = nb2[k2]; if (q2 >= 0 && q2 < label.length && !label[q2] && !grid[q2] && dist[q2] <= r + 0.01) { label[q2] = idn; regions[idn - 1].cells.push(q2); next.push(q2); } }
      }
      frontier = next;
    }
    /* open plan: one enclosed area holding several different room names (showroom + lounge + reception ...)
     * is divided between those names by geodesic nearest-name growth (walls still block). */
    if (opt.split !== false) {
      var base = regions.length;
      for (var ri = 0; ri < base; ri++) {
        var rg0 = regions[ri]; if (rg0.leak) continue;
        var seeds = seedLabels(rg0.texts); if (seeds.length < 2) continue;
        var ids = seeds.map(function (sd) { var nr = { id: regions.length + 1, cells: [], leak: false, texts: [], split: true, seedName: sd.name }; regions.push(nr); sd.id = nr.id; return nr; });
        var queue = [], own = rg0.id;
        seeds.forEach(function (sd) {
          sd.texts.forEach(function (t) {
            var tx = Math.floor(toX(t.x)), ty = Math.floor(toY(t.y)), best = -1, bd = 1e9;
            for (var dy = -8; dy <= 8; dy++) for (var dx = -8; dx <= 8; dx++) { var j = (ty + dy) * nx + tx + dx; if (j >= 0 && j < label.length && label[j] === own && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = j; } }
            if (best >= 0) { label[best] = sd.id; queue.push(best); }
          });
        });
        for (var qi = 0; qi < queue.length; qi++) {
          var cq = queue[qi], idq = label[cq], nbq = [cq - 1, cq + 1, cq - nx, cq + nx];
          for (var kq = 0; kq < 4; kq++) { var qq = nbq[kq]; if (qq >= 0 && qq < label.length && label[qq] === own) { label[qq] = idq; queue.push(qq); } }
        }
        rg0.cells.forEach(function (c) { if (label[c] > base && label[c] !== own) regions[label[c] - 1].cells.push(c); else if (label[c] === own) label[c] = 0; });
        rg0.texts.forEach(function (t) {
          var tx = Math.floor(toX(t.x)), ty = Math.floor(toY(t.y)), j = ty * nx + tx, id2 = j >= 0 && j < label.length ? label[j] : 0;
          if (id2 > base) regions[id2 - 1].texts.push(t);
        });
        seeds.forEach(function (sd) { var nr = regions[sd.id - 1]; sd.texts.forEach(function (t) { if (nr.texts.indexOf(t) < 0) nr.texts.unshift(t); }); });
        rg0.dropped = true;
      }
    }
    var rooms = [], openNames = [];
    regions.forEach(function (rg) {
      if (rg.dropped) return;
      if (rg.leak) { skipped++; openNames = openNames.concat(pickName(rg.texts).all); return; }
      if (!rg.cells.length || !rg.texts.length) return;
      var n = rg.cells.length, edges = 0, wallEdges = 0, minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
      rg.cells.forEach(function (c) {
        var cx2 = c % nx, cy2 = (c - cx2) / nx;
        if (cx2 < minx) minx = cx2; if (cx2 > maxx) maxx = cx2; if (cy2 < miny) miny = cy2; if (cy2 > maxy) maxy = cy2;
        var nb3 = [c - 1, c + 1, c - nx, c + nx];
        for (var k3 = 0; k3 < 4; k3++) if (label[nb3[k3]] !== rg.id) { edges++; if (grid[nb3[k3]]) wallEdges++; }
      });
      var A = n * cell * cell + wallEdges * cell * cell * 0.5; /* the cells under the wall line are half room */
      if (A < 1) { skipped++; return; }
      /* staircase edges over-count slanted walls; never let the perimeter exceed 1.08 x the bounding box's */
      var bw = (maxx - minx + 1) * cell, bh = (maxy - miny + 1) * cell;
      var P = Math.min(edges * cell, Math.max(2 * (bw + bh), 4 * Math.sqrt(A)) * 1.08);
      var er = equivRect(A, P), nm = pickName(rg.texts);
      var wx0 = b[0] + (minx - pad) * cell / s, wy0 = b[1] + (miny - pad) * cell / s, wx1 = b[0] + (maxx - pad + 1) * cell / s, wy1 = b[1] + (maxy - pad + 1) * cell / s;
      var inCH = chTexts.filter(function (t) { var tx = Math.floor(toX(t.x)), ty = Math.floor(toY(t.y)); return tx >= 0 && ty >= 0 && tx < nx && ty < ny && label[ty * nx + tx] === rg.id; });
      rooms.push({ name: rg.seedName || nm.name, labels: nm.all, use: rg.seedName ? guessUse(rg.seedName) : useOf(nm), area: A, perim: P, L: er.L, W: er.W, ch: pickCH(inCH.concat(rg.texts)), irregular: A / (bw * bh) < 0.92,
        regionId: rg.id, split: !!rg.split, bb: [wx0, wy0, wx1, wy1], notes: rg.split ? ["open-plan area divided by room names - boundary is approximate"] : [], labelX: rg.texts[0].x, labelY: rg.texts[0].y });
    });
    return { rooms: rooms.sort(function (a, b2) { return b2.area - a.area; }), skipped: skipped, openNames: openNames,
      raster: { nx: nx, ny: ny, cell: cell, pad: pad, label: label, origin: [b[0], b[1]], scale: s } };
  }

  var api = { parse: parse, cleanText: cleanText, parseCH: parseCH, isLabel: isLabel, guessUse: guessUse, equivRect: equivRect, areaPerim: areaPerim,
    detect: detect, outlineLayers: outlineLayers, roomsFromOutlines: roomsFromOutlines, roomsFromWalls: roomsFromWalls, UNIT_SCALE: UNIT_SCALE, UNIT_NAME: UNIT_NAME };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GDSIDxf = api;
})(typeof window !== "undefined" ? window : this);
