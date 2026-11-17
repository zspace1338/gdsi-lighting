/* GDSI Lighting Calculator - UI (stage 2: whole-drawing DXF import + manual room entry). */
(function () {
  "use strict";
  var C = window.GDSICalc, STD = window.GDSI_STANDARDS, BUILTIN = window.GDSI_FIXTURES;
  var KEY = "gdsiLighting.v1";
  var $ = function (id) { return document.getElementById(id); };
  var r0 = function (v) { return C.round(v, 0).toLocaleString("en-US"); };
  var r1 = function (v) { return C.round(v, 1).toFixed(1); };
  var r2 = function (v) { return C.round(v, 2).toFixed(2); };

  function esc(s) {
    return String(s === null || s === undefined ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------------- state ---------------- */
  var state = { name: "", rooms: [], userFixtures: [], settings: { mf: 0.8, reflectance: "light" }, sel: 0 };
  try {
    var saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && Array.isArray(saved.rooms)) applyProject(saved);
  } catch (e) { /* start empty */ }

  function applyProject(p) {
    state.name = p.name || "";
    state.rooms = Array.isArray(p.rooms) ? p.rooms : [];
    state.userFixtures = Array.isArray(p.userFixtures) ? p.userFixtures : [];
    state.settings = { mf: C.num(p.settings && p.settings.mf) || 0.8, reflectance: (p.settings && p.settings.reflectance) || "light" };
    state.sel = 0;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ } }

  function stdById(id) { for (var i = 0; i < STD.spaces.length; i++) if (STD.spaces[i].id === id) return STD.spaces[i]; return STD.spaces[0]; }
  function allFixtures() { return state.userFixtures.concat(BUILTIN); }
  function fxById(id) { var a = allFixtures(); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return null; }
  function fxFor(room) { return (room.fixtureId && fxById(room.fixtureId)) || fxById(stdById(room.use).defaultFixture) || BUILTIN[0]; }
  function isUser(fx) { return state.userFixtures.indexOf(fx) >= 0; }
  function result(room) { return C.calcRoom(room, stdById(room.use), fxFor(room), state.settings, fxById("gen-spot")); }

  /* ---------------- rooms table ---------------- */
  function useOptions(sel) {
    return STD.groups.map(function (g) {
      var o = STD.spaces.filter(function (s) { return s.group === g; }).map(function (s) {
        return '<option value="' + s.id + '"' + (s.id === sel ? " selected" : "") + ">" + esc(s.name) + "</option>";
      }).join("");
      return '<optgroup label="' + esc(g) + '">' + o + "</optgroup>";
    }).join("");
  }
  function fxOptions(room) {
    var def = fxById(stdById(room.use).defaultFixture) || BUILTIN[0];
    var opt = function (f) { return '<option value="' + esc(f.id) + '"' + (f.id === room.fixtureId ? " selected" : "") + ">" + esc(f.name) + "</option>"; };
    var h = '<option value="">Auto: ' + esc(def.name) + "</option>";
    if (state.userFixtures.length) h += '<optgroup label="Registered">' + state.userFixtures.map(opt).join("") + "</optgroup>";
    return h + '<optgroup label="Generic (placeholder)">' + BUILTIN.map(opt).join("") + "</optgroup>";
  }
  function numInput(f, v, ph) {
    return '<input type="number" data-f="' + f + '" min="0" step="any" value="' + esc(v) + '"' + (ph !== undefined ? ' placeholder="' + esc(ph) + '"' : "") + ">";
  }

  function renderRooms() {
    var body = $("roomBody");
    body.innerHTML = state.rooms.map(function (room, i) {
      var std = stdById(room.use);
      return '<tr data-i="' + i + '"' + (i === state.sel ? ' class="sel"' : "") + ">" +
        '<td class="c-no">' + (i + 1) + "</td>" +
        '<td class="name"><input type="text" data-f="name" value="' + esc(room.name) + '" placeholder="Room name"></td>' +
        '<td class="type"><select data-f="use">' + useOptions(room.use) + "</select></td>" +
        '<td class="c-n">' + numInput("length", room.length) + "</td>" +
        '<td class="c-n">' + numInput("width", room.width) + "</td>" +
        '<td class="c-n">' + numInput("height", room.height) + "</td>" +
        '<td class="c-n">' + numInput("targetLux", room.targetLux, std.target === null ? "enter" : std.target) + "</td>" +
        '<td class="fx"><select data-f="fixtureId">' + fxOptions(room) + "</select></td>" +
        '<td class="res c-n" data-o="qty"></td><td class="res c-n" data-o="lux"></td><td data-o="chk"></td>' +
        '<td><button class="x" data-del title="Delete room" aria-label="Delete room">&times;</button></td></tr>';
    }).join("");
    $("emptyRooms").hidden = state.rooms.length > 0;
    $("roomTable").hidden = state.rooms.length === 0;
    for (var i = 0; i < state.rooms.length; i++) fillRow(i);
    renderDetail(true);
    renderSummary();
  }

  var PILL = { ok: "OK", over: "Too bright", warn: "Check", fail: "Too dark", error: "Input needed" };
  function fillRow(i) {
    var tr = $("roomBody").children[i]; if (!tr) return;
    var r = result(state.rooms[i]);
    var cell = function (k) { return tr.querySelector('[data-o="' + k + '"]'); };
    cell("qty").innerHTML = r.status === "error" ? "-" : (r.kind === "surface" ? r.qty + " × " + r1(r.stripLength) + " m" + (r.suppQty ? "<small>+ " + r.suppQty + " spot</small>" : "") : String(r.qty));
    cell("lux").textContent = r.status === "error" ? "-" : r0(r.achieved);
    cell("chk").innerHTML = '<span class="pill ' + r.status + '">' + PILL[r.status] + "</span>";
  }

  function onRoomEdit(e) {
    var el = e.target, f = el.getAttribute("data-f"); if (!f) return;
    var tr = el.closest("tr"), i = Number(tr.getAttribute("data-i")), room = state.rooms[i];
    room[f] = el.value;
    if (f === "height") room.heightAuto = false;
    if ((f === "length" || f === "width") && room.drawing) delete room.drawing;
    if (f === "use") {
      var std = stdById(room.use);
      if (room.heightAuto) { room.height = std.defaultH; tr.querySelector('[data-f="height"]').value = std.defaultH; }
      tr.querySelector('[data-f="targetLux"]').placeholder = std.target === null ? "enter" : std.target;
      tr.querySelector('[data-f="fixtureId"]').innerHTML = fxOptions(room);
    }
    fillRow(i);
    select(i, f === "use" || f === "name");
    renderSummary();
    save();
  }
  function select(i, rebuildExtra) {
    var changed = state.sel !== i;
    state.sel = i;
    var rows = $("roomBody").children;
    for (var k = 0; k < rows.length; k++) rows[k].classList.toggle("sel", k === i);
    renderDetail(changed || rebuildExtra);
  }

  $("roomBody").addEventListener("input", onRoomEdit);
  $("roomBody").addEventListener("change", onRoomEdit);
  $("roomBody").addEventListener("focusin", function (e) { var tr = e.target.closest("tr"); if (tr) select(Number(tr.getAttribute("data-i"))); });
  $("roomBody").addEventListener("click", function (e) {
    var tr = e.target.closest("tr"); if (!tr) return;
    var i = Number(tr.getAttribute("data-i"));
    if (e.target.hasAttribute("data-del")) {
      var nm = state.rooms[i].name || "Room " + (i + 1);
      if (!confirm('Delete "' + nm + '"?')) return;
      state.rooms.splice(i, 1);
      state.sel = Math.max(0, Math.min(state.sel, state.rooms.length - 1));
      renderRooms(); save();
    } else select(i);
  });
  $("btnAdd").addEventListener("click", function () {
    var std = stdById("showroom");
    state.rooms.push({ name: "", use: std.id, length: "", width: "", height: std.defaultH, heightAuto: true, targetLux: "", fixtureId: "", suspension: "", workPlane: "" });
    state.sel = state.rooms.length - 1;
    renderRooms(); save();
    var tr = $("roomBody").lastElementChild;
    if (tr) tr.querySelector('[data-f="name"]').focus();
  });

  /* ---------------- detail panel ---------------- */
  function srcBadge(std) {
    if (std.source.type === "manual") return '<span class="badge manual">GDSI MANUAL</span> ' + esc(std.source.ref);
    if (std.source.type === "is3646") return '<span class="badge supp">IS 3646</span> ' + esc(std.source.ref);
    return '<span class="badge none">ENTER</span> No standard figure';
  }
  function rangeText(std) {
    if (std.target === null) return "Target to be entered";
    var t = std.max !== null ? std.min + " - " + std.max + " lux" : "min " + std.min + " lux";
    return t + (std.cct ? ", " + std.cct + " K" : "");
  }

  function drawPlan(r) {
    var m = 34, bw = 400 - 2 * m, bh = 250;
    var sc = Math.min(bw / r.L, bh / r.W), w = r.L * sc, h = r.W * sc;
    var ox = (400 - w) / 2, oy = m - 10, H = h + oy + 30;
    var grid = sc >= 5; /* 1 m grid inside the room, skipped when it would be too dense */
    var s = '<svg class="plan" viewBox="0 0 400 ' + Math.round(H) + '" role="img" aria-label="Fixture layout plan"><defs>' +
      '<radialGradient id="plGlow"><stop offset="0" class="g0"/><stop offset="1" class="g1"/></radialGradient>' +
      '<pattern id="plGrid" width="' + sc + '" height="' + sc + '" patternUnits="userSpaceOnUse" patternTransform="translate(' + ox + " " + oy + ')"><path d="M' + sc + " 0H0V" + sc + '" class="pl-grid"/></pattern>' +
      '<clipPath id="plClip"><rect x="' + ox + '" y="' + oy + '" width="' + w + '" height="' + h + '"/></clipPath></defs>';
    s += '<rect x="' + ox + '" y="' + oy + '" width="' + w + '" height="' + h + '" class="pl-room"/>';
    if (grid) s += '<rect x="' + ox + '" y="' + oy + '" width="' + w + '" height="' + h + '" fill="url(#plGrid)"/>';
    r.strips.forEach(function (p) {
      s += '<rect x="' + (ox + p.x * sc) + '" y="' + (oy + p.y * sc) + '" width="' + p.w * sc + '" height="' + p.h * sc + '" rx="2" class="pl-strip"/>';
    });
    var half = r.lineLength ? Math.max(3, (r.lineLength * sc) / 2) : 0;
    var pitch = Math.min(r.sx || 1, r.sy || 1) * sc;
    var rad = Math.max(1.8, Math.min(4.5, pitch * 0.16)), glow = Math.max(7, Math.min(30, pitch * 0.62));
    var halo = "", core = "";
    r.positions.forEach(function (p) {
      var x = ox + p.x * sc, y = oy + p.y * sc;
      if (half) {
        var ln = ' x1="' + (x - half) + '" y1="' + y + '" x2="' + (x + half) + '" y2="' + y + '"';
        halo += "<line" + ln + ' class="pl-halo"/>'; core += "<line" + ln + ' class="pl-line"/>';
      } else {
        halo += '<circle cx="' + x + '" cy="' + y + '" r="' + glow + '" fill="url(#plGlow)"/>';
        core += '<circle cx="' + x + '" cy="' + y + '" r="' + rad + '" class="pl-fx"/>';
      }
    });
    s += '<g clip-path="url(#plClip)">' + halo + "</g>" + core;
    s += '<text x="200" y="' + (oy + h + 19) + '" text-anchor="middle" class="pl-dim">' + r2(r.L) + " m" + (grid ? "  ·  grid 1 m" : "") + "</text>";
    s += '<text x="' + (ox - 9) + '" y="' + (oy + h / 2) + '" text-anchor="middle" class="pl-dim" transform="rotate(-90 ' + (ox - 9) + " " + (oy + h / 2) + ')">' + r2(r.W) + " m</text>";
    return s + "</svg>";
  }

  function renderDetail(rebuild) {
    var box = $("detail"), room = state.rooms[state.sel];
    if (!room) { box.innerHTML = '<p class="empty-d">Select a room to see the standard, the calculation and the layout.</p>'; return; }
    var std = stdById(room.use);
    if (rebuild || !$("detailRes")) {
      box.innerHTML = '<div id="detailRes"></div><div class="extra">' +
        '<label>Suspension below ceiling (m)<input type="number" data-x="suspension" min="0" step="0.1" value="' + esc(room.suspension) + '" placeholder="0"></label>' +
        '<label>Work plane height (m)<input type="number" data-x="workPlane" min="0" step="0.05" value="' + esc(room.workPlane) + '" placeholder="' + std.workPlane + '"></label></div>';
    }
    var r = result(room), fx = fxFor(room);
    var h = '<div class="d-head"><h3>' + esc(room.name || "Room " + (state.sel + 1)) + "</h3><span>" + esc(std.name) + "</span></div>";
    h += '<p class="src">' + srcBadge(std) + "<b>" + rangeText(std) + "</b></p>";
    h += '<p class="note">' + esc(std.source.note) + "</p>";
    if (r.status !== "error") {
      /* result meter: required band, design-target tick, achieved marker */
      var lo = std.min !== null && std.min !== undefined ? std.min : r.target, hi = std.max || 0;
      var end = Math.max(r.achieved, hi, r.target, lo) * 1.2 || 1;
      var pc = function (v) { return (Math.max(0, Math.min(v, end)) / end * 100).toFixed(1); };
      h += '<div class="hero ' + r.status + '"><div class="h-row"><div class="h-num"><b>' + r0(r.achieved) + "</b><i>lux</i><span>average on the work plane · target " + r0(r.target) + '</span></div><span class="pill ' + r.status + '">' + PILL[r.status] + "</span></div>" +
        '<div class="meter"><div class="m-band" style="left:' + pc(lo) + "%;width:" + ((hi ? pc(hi) : 100) - pc(lo)).toFixed(1) + '%"></div><div class="m-tick" style="left:' + pc(r.target) + '%"></div><div class="m-dot" style="left:' + pc(r.achieved) + '%"></div></div>' +
        '<div class="m-scale"><span>0</span><span>' + r0(end) + " lux</span></div></div>";
      h += drawPlan(r);
      var qty = r.kind === "surface"
        ? r.qty + " strips x " + r1(r.stripLength) + " m x " + r1(r.moduleWidth) + " m (" + r0(r.coverage * 100) + "% of ceiling)"
        : r.qty + " pcs (" + r.cols + " x " + r.rows + ")";
      if (r.suppQty) qty += "<br>+ " + r.suppQty + " pcs " + esc(r.suppName);
      var sp = r.kind === "surface" ? "pitch " + r2(r.pitch) + " m" : r2(r.sx) + " x " + r2(r.sy) + " m";
      h += '<dl class="kv">' +
        "<dt>Fixture</dt><dd>" + esc(fx.name) + "</dd>" +
        "<dt>Quantity</dt><dd><b>" + qty + "</b></dd>" +
        "<dt>Spacing</dt><dd>" + sp + "</dd>" +
        "<dt>Average illuminance</dt><dd><b>" + r0(r.achieved) + " lux</b> (target " + r0(r.target) + ")</dd>" +
        "<dt>Installed power</dt><dd>" + r0(r.totalWatt) + " W (" + r1(r.lpd) + " W/m2)</dd>" +
        "<dt>Floor area</dt><dd>" + r1(r.area) + " m2</dd>" +
        "<dt>Mounting height above work plane</dt><dd>" + r2(r.Hm) + " m</dd>" +
        "<dt>Room index K</dt><dd>" + r2(r.K) + "</dd>" +
        "<dt>Utilisation factor (generic table)</dt><dd>" + r2(r.UF) + "</dd>" +
        "<dt>Maintenance factor</dt><dd>" + r2(r.MF) + "</dd></dl>";
    }
    if (r.info) h += '<ul class="msgs"><li class="info">' + esc(r.info) + "</li></ul>";
    var notes = r.messages.slice();
    if (r.status !== "error" && !isUser(fx)) notes.push("Generic placeholder fixture - register the real fixture to confirm the quantity.");
    if (room.heightAuto) notes.push("Ceiling height " + room.height + " m is a default - enter the real height" + (room.drawing ? " or upload the ceiling plan (CH texts)." : "."));
    notes = notes.concat(drawingNotes(room));
    h += '<ul class="msgs">' + notes.map(function (t) { return "<li" + (r.status === "error" || r.status === "fail" ? ' class="err"' : "") + ">" + esc(t) + "</li>"; }).join("") + "</ul>";
    $("detailRes").innerHTML = h;
  }
  $("detail").addEventListener("input", function (e) {
    var k = e.target.getAttribute("data-x"), room = state.rooms[state.sel]; if (!k || !room) return;
    room[k] = e.target.value;
    fillRow(state.sel); renderDetail(false); renderSummary(); save();
  });

  function drawingNotes(room) {
    var d = room.drawing, out = []; if (!d) return out;
    out.push("From drawing " + d.file + " (" + r1(d.area) + " m2).");
    if (d.irregular) out.push("Not a rectangle: length x width is the rectangle with the same area and perimeter, so the room index is exact; the layout plan is schematic.");
    if (d.split) out.push("Open-plan area divided between room names - check the boundary.");
    return out;
  }

  /* ---------------- summary ---------------- */
  function renderSummary() {
    var n = state.rooms.length, ok = 0, area = 0, watt = 0, byFx = {}, order = [];
    state.rooms.forEach(function (room) {
      var r = result(room); if (r.status === "error") return;
      if (r.status === "ok" || r.status === "over" || r.status === "warn") ok++;
      area += r.area; watt += r.totalWatt;
      var fx = fxFor(room);
      if (!byFx[fx.id]) { byFx[fx.id] = { name: fx.name, qty: 0, area: 0, surface: fx.kind === "surface" }; order.push(fx.id); }
      if (fx.kind === "surface") byFx[fx.id].area += r.luminousArea; else byFx[fx.id].qty += r.qty;
      if (r.suppQty) {
        if (!byFx[r.suppId]) { byFx[r.suppId] = { name: r.suppName, qty: 0, area: 0, surface: false }; order.push(r.suppId); }
        byFx[r.suppId].qty += r.suppQty;
      }
    });
    if (!n) { $("summary").innerHTML = ""; return; }
    var list = order.map(function (id) { var f = byFx[id]; return "<li><span>" + esc(f.name) + "</span><b>" + (f.surface ? r1(f.area) + " m²" : f.qty + " pcs") + "</b></li>"; }).join("");
    var lpd = area ? watt / area : 0;
    $("summary").innerHTML =
      '<div class="stat"><span class="k">Rooms on target</span><b>' + ok + "<i>/ " + n + '</i></b><div class="track' + (ok < n ? " part" : "") + '"><i style="width:' + (ok / n * 100).toFixed(0) + '%"></i></div></div>' +
      '<div class="stat"><span class="k">Installed power</span><b>' + r1(watt / 1000) + '<i>kW</i></b><span class="s">over ' + r0(area) + " m² of floor</span></div>" +
      '<div class="stat"><span class="k">Power density</span><b>' + r1(lpd) + '<i>W/m²</i></b><span class="s">reference ' + STD.buildingLpd.value + " (" + esc(STD.buildingLpd.ref) + ")</span></div>" +
      '<div class="stat"><span class="k">Fixture totals</span><ul>' + (list || "<li><span>-</span></li>") + "</ul></div>";
  }

  /* ---------------- fixtures tab ---------------- */
  var KIND = { point: "Point", linear: "Linear", surface: "Surface Light" };
  var editingId = null;
  function renderFixtures() {
    $("fxBody").innerHTML = allFixtures().map(function (f) {
      var u = isUser(f), per = f.kind === "surface" ? "/m2" : "";
      return "<tr><td>" + esc(f.name) + (f.note ? '<br><span class="hint">' + esc(f.note) + "</span>" : "") + "</td><td>" + KIND[f.kind] + "</td>" +
        '<td class="c-n">' + r0(f.lm) + " lm" + per + '</td><td class="c-n">' + esc(f.watt) + " W" + per + '</td>' +
        '<td class="c-n">' + (Number(f.watt) > 0 ? r0(f.lm / f.watt) : "-") + '</td><td class="c-n">' + esc(f.cct || "-") + '</td><td class="c-n">' + esc(f.cri || "-") + "</td>" +
        "<td>" + (u ? '<span class="badge reg">REGISTERED</span>' : '<span class="badge gen">GENERIC</span>') + "</td>" +
        "<td>" + (u ? '<button class="link" data-edit="' + esc(f.id) + '">Edit</button><button class="x" data-rm="' + esc(f.id) + '" title="Delete fixture" aria-label="Delete fixture">&times;</button>' : "") + "</td></tr>";
    }).join("");
  }
  function syncFxForm() {
    var k = $("fxForm").elements.kind.value, surf = k === "surface";
    $("lblLm").textContent = surf ? "Luminous flux (lm per m2 of luminous surface)" : "Luminous flux (lm per fixture)";
    $("lblW").textContent = surf ? "Power (W per m2 of luminous surface)" : "Power (W per fixture)";
    $("rowShr").hidden = surf; $("rowLen").hidden = k !== "linear";
  }
  function resetFxForm() {
    editingId = null; $("fxForm").reset(); syncFxForm();
    $("fxFormTitle").textContent = "Register a fixture"; $("fxSubmit").textContent = "Register"; $("fxCancel").hidden = true;
  }
  $("fxForm").elements.kind.addEventListener("change", syncFxForm);
  $("fxCancel").addEventListener("click", resetFxForm);
  $("fxForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var el = $("fxForm").elements;
    var f = { id: editingId || "usr-" + Date.now().toString(36), kind: el.kind.value, name: el.name.value.trim(), lm: Number(el.lm.value), watt: Number(el.watt.value), note: el.note.value.trim() };
    if (el.cct.value) f.cct = Number(el.cct.value);
    if (el.cri.value) f.cri = Number(el.cri.value);
    if (f.kind === "surface") { f.moduleWidth = 1.5; f.gap = 2.4; } else f.shr = Number(el.shr.value) || 1.5;
    if (f.kind === "linear") f.length = Number(el.length.value) || 1.2;
    var at = -1;
    state.userFixtures.forEach(function (x, i) { if (x.id === f.id) at = i; });
    if (at >= 0) state.userFixtures[at] = f; else state.userFixtures.push(f);
    resetFxForm(); renderFixtures(); renderRooms(); save();
  });
  $("fxBody").addEventListener("click", function (e) {
    var id = e.target.getAttribute("data-edit") || e.target.getAttribute("data-rm"); if (!id) return;
    var f = fxById(id); if (!f) return;
    if (e.target.hasAttribute("data-rm")) {
      var used = state.rooms.filter(function (r) { return r.fixtureId === id; }).length;
      if (!confirm('Delete "' + f.name + '"?' + (used ? " " + used + " room(s) using it will go back to the default fixture." : ""))) return;
      state.userFixtures = state.userFixtures.filter(function (x) { return x.id !== id; });
      state.rooms.forEach(function (r) { if (r.fixtureId === id) r.fixtureId = ""; });
      if (editingId === id) resetFxForm();
      renderFixtures(); renderRooms(); save();
      return;
    }
    var el = $("fxForm").elements;
    editingId = id; el.name.value = f.name; el.kind.value = f.kind; el.lm.value = f.lm; el.watt.value = f.watt;
    el.cct.value = f.cct || ""; el.cri.value = f.cri || ""; el.shr.value = f.shr || ""; el.length.value = f.length || ""; el.note.value = f.note || "";
    syncFxForm();
    $("fxFormTitle").textContent = "Edit fixture"; $("fxSubmit").textContent = "Save changes"; $("fxCancel").hidden = false;
    el.name.focus();
  });

  /* ---------------- standards tab ---------------- */
  function renderStandards() {
    var v = function (x) { return x === null ? "-" : x; };
    $("stdBody").innerHTML = STD.spaces.map(function (s) {
      return "<tr><td>" + esc(s.name) + '<br><span class="hint">' + esc(s.group) + '</span></td><td class="c-n">' + v(s.min) + '</td><td class="c-n"><b>' + v(s.target) +
        '</b></td><td class="c-n">' + v(s.max) + '</td><td class="c-n">' + v(s.cct) + "</td><td>" + srcBadge(s) + '</td><td class="hint">' + esc(s.source.note) + "</td></tr>";
    }).join("");
  }

  /* ---------------- files ---------------- */
  function download(name, text, mime) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(text instanceof Blob ? text : new Blob([text], { type: mime }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }
  function fileBase() { return (state.name || "gdsi-lighting").replace(/[\\/:*?"<>|]+/g, "_"); }
  function readJson(input, cb) {
    var file = input.files[0]; if (!file) return;
    var rd = new FileReader();
    rd.onload = function () {
      try { cb(JSON.parse(rd.result)); } catch (e) { alert("This file could not be read. Choose a JSON file exported from this app."); }
      input.value = "";
    };
    rd.readAsText(file);
  }

  $("btnSave").addEventListener("click", function () {
    download(fileBase() + ".json", JSON.stringify({ app: "gdsi-lighting", version: 1, name: state.name, settings: state.settings, rooms: state.rooms, userFixtures: state.userFixtures }, null, 2), "application/json");
  });
  $("btnOpen").addEventListener("click", function () { $("fileOpen").click(); });
  $("fileOpen").addEventListener("change", function () {
    readJson($("fileOpen"), function (p) {
      if (p.app !== "gdsi-lighting" || !Array.isArray(p.rooms)) { alert("This is not a GDSI Lighting project file."); return; }
      if (state.rooms.length && !confirm("Replace the current project with the opened file?")) return;
      applyProject(p); init(); save();
    });
  });
  $("btnFxExport").addEventListener("click", function () {
    if (!state.userFixtures.length) { alert("No registered fixtures to export yet."); return; }
    download("gdsi-fixtures.json", JSON.stringify({ app: "gdsi-lighting-fixtures", version: 1, fixtures: state.userFixtures }, null, 2), "application/json");
  });
  $("btnFxImport").addEventListener("click", function () { $("fileFx").click(); });
  $("fileFx").addEventListener("change", function () {
    readJson($("fileFx"), function (p) {
      if (p.app !== "gdsi-lighting-fixtures" || !Array.isArray(p.fixtures)) { alert("This is not a GDSI Lighting fixture file."); return; }
      p.fixtures.forEach(function (f) {
        if (!f || !f.id || !f.name || !(Number(f.lm) > 0) || !KIND[f.kind]) return;
        var at = -1;
        state.userFixtures.forEach(function (x, i) { if (x.id === f.id) at = i; });
        if (at >= 0) state.userFixtures[at] = f; else state.userFixtures.push(f);
      });
      renderFixtures(); renderRooms(); save();
    });
  });

  $("btnCsv").addEventListener("click", function () {
    if (!state.rooms.length) { alert("Add a room first."); return; }
    var q = function (v) { v = String(v === null || v === undefined ? "" : v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rows = [["No", "Room", "Space type", "Length (m)", "Width (m)", "Area (m2)", "Ceiling height (m)", "Standard", "Required (lux)", "Design target (lux)", "Fixture", "Fixture status", "Qty", "Unit", "Layout", "Average illuminance (lux)", "Power (W)", "W/m2", "Check", "Notes"]];
    state.rooms.forEach(function (room, i) {
      var std = stdById(room.use), fx = fxFor(room), r = result(room), e = r.status === "error";
      var srcName = std.source.type === "manual" ? STD.manualTitle + " " + std.source.ref : std.source.type === "is3646" ? STD.supplementTitle + " " + std.source.ref : "Entered by designer";
      rows.push([i + 1, room.name || "Room " + (i + 1), std.name, room.length, room.width, e ? "" : r1(r.area), room.height, srcName, rangeText(std), e ? "" : C.round(r.target),
        fx.name, isUser(fx) ? "Registered" : "Generic placeholder", e ? "" : (r.kind === "surface" ? r1(r.luminousArea) : r.qty), r.kind === "surface" ? "m2" : "pcs",
        e ? "" : (r.kind === "surface" ? r.qty + " strips x " + r1(r.stripLength) + " m x " + r1(r.moduleWidth) + " m" + (r.suppQty ? " + " + r.suppQty + " pcs " + r.suppName : "") : r.cols + " x " + r.rows + " @ " + r2(r.sx) + " x " + r2(r.sy) + " m"),
        e ? "" : C.round(r.achieved), e ? "" : C.round(r.totalWatt), e ? "" : r1(r.lpd), PILL[r.status], (r.info ? [r.info] : []).concat(r.messages, drawingNotes(room)).join(" / ")]);
    });
    rows.push([]);
    rows.push(["Assumptions", "Maintenance factor " + state.settings.mf, C.UF_TABLES[state.settings.reflectance].label, "Utilisation factor: generic table", "Preliminary sizing - verify with DIALux or the lighting vendor"]);
    download(fileBase() + "-lighting-schedule.csv", "﻿" + rows.map(function (r) { return r.map(q).join(","); }).join("\r\n"), "text/csv;charset=utf-8");
  });

  /* ---------------- Excel schedule (formatted .xlsx, three sheets) ---------------- */
  $("btnXlsx").addEventListener("click", function () {
    if (!state.rooms.length) { alert("Add a room first."); return; }
    var X = window.GDSIXlsx, S = new X.Styles();
    var INK = "1F2328", LINE = "E4E0D8", GOLD = "8E6420", MUTE = "6B7280", ZEBRA = "F8F6F2", TOT = "EFEAE0";
    var st = function (o) { return S.get(o); };
    var body = function (z, o) { var s = { border: { bottom: "thin:" + LINE } }; if (z) s.fill = ZEBRA; for (var k in o) s[k] = o[k]; return st(s); };
    var total = function (o) { var s = { b: 1, fill: TOT, border: { top: "medium:" + INK, bottom: "thin:" + INK } }; for (var k in o) s[k] = o[k]; return st(s); };
    var num = function (v) { v = C.num(v); return v > 0 ? v : null; };
    var issued = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    var project = state.name || "Untitled project";
    var sTitle = st({ b: 1, sz: 20 }), sProj = st({ b: 1, sz: 12, color: GOLD }), sMeta = st({ sz: 9, color: MUTE });
    var sHead = st({ b: 1, sz: 9, color: "FFFFFF", fill: INK, h: "center", wrap: 1 }), sHeadL = st({ b: 1, sz: 9, color: "FFFFFF", fill: INK, h: "left", wrap: 1, indent: 1 });
    var sGroup = st({ b: 1, sz: 9, color: GOLD, fill: "F4EBD9", h: "center", border: { bottom: "medium:" + GOLD, left: "thin:FFFFFF", right: "thin:FFFFFF" } });
    var CHK = { ok: { color: "1C7D4D", fill: "E3F4EA" }, over: { color: "9A5E06", fill: "FDF0D8" }, warn: { color: "9A5E06", fill: "FDF0D8" }, fail: { color: "BF3A2C", fill: "FBE6E3" }, error: { color: "BF3A2C", fill: "FBE6E3" } };
    var banner = function (title) {
      return [{ h: 34, c: [{ v: title, s: sTitle }] }, { h: 20, c: [{ v: project, s: sProj }] },
        { h: 16, c: [{ v: "Issued " + issued + "   |   Preliminary sizing by the lumen method   |   Final verification by DIALux or the lighting vendor", s: sMeta }] }, { h: 8, c: [] }];
    };
    var W1 = [5, 24, 28, 8, 8, 9, 9, 38, 22, 9, 36, 11, 9, 6, 36, 10, 10, 8, 13, 64], W2 = [5, 44, 16, 12, 10, 7, 14, 12, 12, 8, 7, 60], W3 = [30, 9, 9, 9, 9, 46, 80];
    /* row height from the longest wrapped text, so rows keep some air and nothing is clipped */
    var rowH = function (cells, widths) {
      var m = 1;
      cells.forEach(function (c, k) {
        if (!c || typeof c.v !== "string" || !c.v) return;
        var n = 0; c.v.split("\n").forEach(function (part) { n += Math.max(1, Math.ceil(part.length / (widths[k] * 1.1))); });
        if (n > m) m = n;
      });
      return Math.max(22, m * 12.5 + 9);
    };
    var srcText = function (std) { return std.source.type === "manual" ? STD.manualTitle + ", " + std.source.ref : std.source.type === "is3646" ? STD.supplementTitle + ", " + std.source.ref : "Entered by designer"; };

    /* ----- sheet 1: schedule ----- */
    var rows = banner("LIGHTING SCHEDULE"), g = [], heads = ["No", "Room", "Space type", "Length\n(m)", "Width\n(m)", "Area\n(m²)", "Ceiling\n(m)", "Standard", "Required", "Design\n(lux)", "Fixture", "Fixture\nstatus", "Qty", "Unit", "Layout", "Average\n(lux)", "Power\n(W)", "W/m²", "Check", "Notes"];
    for (var i = 0; i < 20; i++) g.push({ v: { 0: "ROOM", 7: "STANDARD", 10: "FIXTURE", 15: "RESULT" }[i] || "", s: sGroup });
    rows.push({ h: 20, c: g });
    rows.push({ h: 32, c: heads.map(function (h, k) { return { v: h, s: [1, 2, 7, 8, 10, 14, 19].indexOf(k) >= 0 ? sHeadL : sHead }; }) });
    var first = rows.length + 1, ok = 0, area = 0, watt = 0, anyGeneric = false, byFx = {}, order = [], used = [];
    var take = function (fx, qty, a, w, room) {
      if (!byFx[fx.id]) { byFx[fx.id] = { fx: fx, qty: 0, area: 0, watt: 0, rooms: [] }; order.push(fx.id); }
      var t = byFx[fx.id]; t.qty += qty; t.area += a; t.watt += w; if (t.rooms.indexOf(room) < 0) t.rooms.push(room);
    };
    state.rooms.forEach(function (room, i) {
      var std = stdById(room.use), fx = fxFor(room), r = result(room), e = r.status === "error", z = i % 2, surf = r.kind === "surface", reg = isUser(fx);
      var name = room.name || "Room " + (i + 1), txt = function (o) { return body(z, Object.assign({ wrap: 1, h: "left", indent: 1 }, o || {})); };
      if (used.indexOf(std) < 0) used.push(std);
      if (!reg) anyGeneric = true;
      if (!e) {
        if (r.status !== "fail") ok++;
        area += r.area; watt += r.totalWatt;
        var sup = r.suppQty ? fxById(r.suppId) : null, supW = sup ? r.suppQty * (C.num(sup.watt) || 0) : 0;
        take(fx, surf ? 0 : r.qty, surf ? r.luminousArea : 0, r.totalWatt - supW, name);
        if (sup) { take(sup, r.suppQty, 0, supW, name); if (!isUser(sup)) anyGeneric = true; }
      }
      var c = CHK[r.status];
      var cells = [
        { v: i + 1, s: body(z, { h: "center", color: MUTE }) }, { v: name, s: txt({ b: 1 }) }, { v: std.name, s: txt() },
        { v: num(room.length), s: body(z, { fmt: "0.00" }) }, { v: num(room.width), s: body(z, { fmt: "0.00" }) }, { v: e ? null : r.area, s: body(z, { fmt: "#,##0.0" }) }, { v: num(room.height), s: body(z, { fmt: "0.00" }) },
        { v: srcText(std), s: txt({ sz: 9 }) }, { v: rangeText(std), s: txt({ sz: 9 }) }, { v: e ? null : C.round(r.target), s: body(z, { fmt: "#,##0" }) },
        { v: fx.name, s: txt() }, { v: reg ? "Registered" : "Generic", s: body(z, { h: "center", sz: 9, b: 1, color: reg ? "1C7D4D" : "9A5E06" }) },
        { v: e ? null : (surf ? r.luminousArea : r.qty), s: body(z, { b: 1, fmt: surf ? "#,##0.0" : "#,##0" }) }, { v: surf ? "m²" : "pcs", s: body(z, { h: "center", sz: 9, color: MUTE }) },
        { v: e ? "" : (surf ? r.qty + " strips × " + r1(r.stripLength) + " m × " + r1(r.moduleWidth) + " m" + (r.suppQty ? "\n+ " + r.suppQty + " pcs " + r.suppName : "") : r.cols + " × " + r.rows + " grid @ " + r2(r.sx) + " × " + r2(r.sy) + " m"), s: txt({ sz: 9 }) },
        { v: e ? null : C.round(r.achieved), s: body(z, { b: 1, fmt: "#,##0" }) }, { v: e ? null : C.round(r.totalWatt), s: body(z, { fmt: "#,##0" }) }, { v: e ? null : C.round(r.lpd, 1), s: body(z, { fmt: "0.0" }) },
        { v: PILL[r.status], s: st({ b: 1, sz: 9, h: "center", color: c.color, fill: c.fill, border: { bottom: "thin:" + LINE, left: "thin:FFFFFF", right: "thin:FFFFFF" } }) },
        { v: (r.info ? [r.info] : []).concat(r.messages, drawingNotes(room)).join("\n"), s: txt({ sz: 9, color: MUTE }) }
      ];
      rows.push({ h: rowH(cells, W1), c: cells });
    });
    var last = rows.length, tr = last + 1, t = [];
    for (i = 0; i < 20; i++) t.push({ v: "", s: total({}) });
    t[0] = { v: "TOTAL", s: total({ h: "left", indent: 1 }) };
    t[5] = { v: C.round(area, 1), f: "SUM(F" + first + ":F" + last + ")", s: total({ fmt: "#,##0.0" }) };
    t[16] = { v: C.round(watt), f: "SUM(Q" + first + ":Q" + last + ")", s: total({ fmt: "#,##0" }) };
    t[17] = { v: area ? C.round(watt / area, 1) : 0, f: "IF(F" + tr + ">0,Q" + tr + "/F" + tr + ",0)", s: total({ fmt: "0.0" }) };
    t[18] = { v: ok + " / " + state.rooms.length + " OK", s: total({ h: "center", sz: 9 }) };
    t[19] = { v: "Power density reference " + STD.buildingLpd.value + " W/m² (" + STD.buildingLpd.ref + ")", s: total({ h: "left", indent: 1, sz: 9, b: 0, color: MUTE }) };
    rows.push({ h: 24, c: t });
    if (anyGeneric) { rows.push({ h: 8, c: [] }); rows.push({ c: [{ v: "Fixtures marked Generic are placeholder assumptions. Register the actual fixtures in the calculator to confirm quantities.", s: st({ i: 1, sz: 9, color: "9A5E06" }) }] }); }
    var schedule = { name: "Lighting Schedule", rows: rows, cols: W1,
      merges: ["A5:G5", "H5:J5", "K5:O5", "P5:T5", "A" + tr + ":E" + tr], freeze: { col: 2, row: 6 }, filter: "A6:T" + last, repeatRows: "5:6", landscape: true, paper: 8, footer: project + " - Lighting Schedule" };

    /* ----- sheet 2: fixture take-off ----- */
    var r2s = banner("FIXTURE TAKE-OFF"), th = ["No", "Fixture", "Type", "Status", "Qty", "Unit", "Output", "Power", "Total power\n(W)", "CCT\n(K)", "CRI", "Used in"];
    r2s.push({ h: 32, c: th.map(function (h, k) { return { v: h, s: [1, 2, 11].indexOf(k) >= 0 ? sHeadL : sHead }; }) });
    var f1 = r2s.length + 1;
    order.forEach(function (id, i) {
      var q = byFx[id], fx = q.fx, z = i % 2, surf = fx.kind === "surface", reg = isUser(fx), txt = function (o) { return body(z, Object.assign({ wrap: 1, h: "left", indent: 1 }, o || {})); };
      var cells = [
        { v: i + 1, s: body(z, { h: "center", color: MUTE }) }, { v: fx.name, s: txt({ b: 1 }) }, { v: KIND[fx.kind], s: txt() },
        { v: reg ? "Registered" : "Generic", s: body(z, { h: "center", sz: 9, b: 1, color: reg ? "1C7D4D" : "9A5E06" }) },
        { v: surf ? C.round(q.area, 1) : q.qty, s: body(z, { b: 1, fmt: surf ? "#,##0.0" : "#,##0" }) }, { v: surf ? "m²" : "pcs", s: body(z, { h: "center", sz: 9, color: MUTE }) },
        { v: C.num(fx.lm) || null, s: body(z, { fmt: surf ? '#,##0" lm/m²"' : '#,##0" lm"' }) }, { v: C.num(fx.watt) || null, s: body(z, { fmt: (C.num(fx.watt) % 1 ? "#,##0.0" : "#,##0") + (surf ? '" W/m²"' : '" W"') }) },
        { v: C.round(q.watt), s: body(z, { fmt: "#,##0" }) }, { v: C.num(fx.cct) || null, s: body(z, { h: "center" }) }, { v: C.num(fx.cri) || null, s: body(z, { h: "center" }) },
        { v: q.rooms.join(", "), s: txt({ sz: 9, color: MUTE }) }
      ];
      r2s.push({ h: rowH(cells, W2), c: cells });
    });
    var l2 = r2s.length, t2 = [];
    for (i = 0; i < 12; i++) t2.push({ v: "", s: total({}) });
    t2[0] = { v: "TOTAL", s: total({ h: "left", indent: 1 }) };
    t2[8] = { v: C.round(watt), f: "SUM(I" + f1 + ":I" + l2 + ")", s: total({ fmt: "#,##0" }) };
    r2s.push({ h: 24, c: t2 });
    var takeoff = { name: "Fixture Take-off", rows: r2s, cols: W2, merges: ["A" + (l2 + 1) + ":D" + (l2 + 1)], freeze: { row: 5 }, repeatRows: "5:5", landscape: true, footer: project + " - Fixture Take-off" };

    /* ----- sheet 3: basis of calculation ----- */
    var r3 = banner("BASIS OF CALCULATION"), m3 = [], kS = st({ b: 1, sz: 9, color: MUTE, v: "top", border: { bottom: "thin:" + LINE } }), vS = st({ wrap: 1, v: "top", border: { bottom: "thin:" + LINE } });
    [["Method", "Lumen method (average illuminance):  N = E × A / (Φ × UF × MF)"],
      ["Maintenance factor (MF)", String(state.settings.mf)],
      ["Room finishes", C.UF_TABLES[state.settings.reflectance].label],
      ["Utilisation factor (UF)", "Generic table by room index and room finishes. Replace with the manufacturer's UF or a DIALux run for the final design."],
      ["Primary standard", STD.manualTitle],
      ["Supplementary standard", STD.supplementTitle + " - used only where the GDSI manual gives no figure"],
      ["Power density reference", STD.buildingLpd.value + " W/m² - " + STD.buildingLpd.ref],
      ["Status of this document", "Preliminary sizing for design coordination. Final verification by DIALux or the lighting vendor using photometric files of the actual fixtures."]
    ].forEach(function (p) {
      var c = [{ v: p[0], s: kS }, { v: p[1], s: vS }]; for (var k = 2; k < 7; k++) c.push({ v: "", s: vS });
      r3.push({ h: rowH([null, { v: p[1] }], [0, 150]), c: c }); m3.push("B" + r3.length + ":G" + r3.length);
    });
    r3.push({ h: 14, c: [] });
    r3.push({ h: 22, c: [{ v: "STANDARDS APPLIED IN THIS PROJECT", s: st({ b: 1, sz: 11, color: GOLD }) }] });
    r3.push({ h: 24, c: ["Space type", "Min\n(lux)", "Design\n(lux)", "Max\n(lux)", "CCT\n(K)", "Source", "Note"].map(function (h, k) { return { v: h, s: k === 0 || k > 4 ? sHeadL : sHead }; }) });
    used.forEach(function (std, i) {
      var z = i % 2, n = function (v) { return { v: v === null || v === undefined ? "-" : v, s: body(z, { h: "center" }) }; }, txt = function (o) { return body(z, Object.assign({ wrap: 1, h: "left", indent: 1 }, o || {})); };
      var cells = [{ v: std.name, s: txt({ b: 1 }) }, n(std.min), { v: std.target === null ? "-" : std.target, s: body(z, { h: "center", b: 1 }) }, n(std.max), n(std.cct), { v: srcText(std), s: txt({ sz: 9 }) }, { v: std.source.note, s: txt({ sz: 9, color: MUTE }) }];
      r3.push({ h: rowH(cells, W3), c: cells });
    });
    var basis = { name: "Basis", rows: r3, cols: W3, merges: m3, landscape: true, footer: project + " - Basis of Calculation" };

    download(fileBase() + "-lighting-schedule.xlsx", X.build([schedule, takeoff, basis], S));
  });

  /* ---------------- whole-drawing import (DXF floor plan / reflected ceiling plan) ---------------- */
  var D = window.GDSIDxf, imp = null;
  var CODEPAGE = { ANSI_949: "euc-kr", ANSI_936: "gbk", ANSI_950: "big5", ANSI_932: "shift_jis", ANSI_874: "windows-874", ANSI_1250: "windows-1250", ANSI_1251: "windows-1251", ANSI_1252: "windows-1252", ANSI_1254: "windows-1254" };
  function decodeDxf(buf) {
    var head = new TextDecoder("latin1").decode(buf.slice(0, 20000));
    var ver = (/\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*AC(\d{4})/.exec(head) || [])[1];
    var cp = (/\$DWGCODEPAGE\s*\r?\n\s*3\s*\r?\n\s*(\S+)/.exec(head) || [])[1];
    if (ver && Number(ver) >= 1021) return new TextDecoder("utf-8").decode(buf); /* AutoCAD 2007+ DXF is UTF-8 */
    try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch (e) { /* legacy code page */ }
    try { return new TextDecoder(CODEPAGE[String(cp).toUpperCase()] || "windows-1252").decode(buf); } catch (e2) { return new TextDecoder("windows-1252").decode(buf); }
  }
  function openDrawing(file) {
    if (!file) return;
    var ext = (file.name.split(".").pop() || "").toLowerCase();
    if (ext === "dwg") { alert("DWG files cannot be read in the browser.\n\nIn AutoCAD: SAVEAS > file type DXF (any version), then upload the DXF."); return; }
    if (ext !== "dxf") { alert("Upload the drawing as a DXF file (floor plan or reflected ceiling plan)."); return; }
    var rd = new FileReader();
    rd.onload = function () {
      var doc;
      try { doc = D.parse(decodeDxf(rd.result)); } catch (e) { alert("This DXF could not be read. Save it again from AutoCAD as DXF and retry."); return; }
      if (!doc.paths.length) { alert("No drawing geometry was found in model space of this DXF."); return; }
      var det = D.detect(doc);
      imp = { file: file.name, doc: doc, det: det, mode: det.mode, layer: det.layer, scale: det.scale, gap: 1.0, split: true, walls: det.wallLayers.slice(), rooms: [], res: null, on: [], sel: -1 };
      $("imp").hidden = false; buildImportControls(); runImport();
    };
    rd.readAsArrayBuffer(file);
  }
  function buildImportControls() {
    var d = imp.det, layers = Object.keys(imp.doc.layers).sort();
    $("impFile").textContent = imp.file + " · " + layers.length + " layers · " + imp.doc.texts.length + " texts" + (d.unitDetected ? "" : " · units not stated in the file - check below");
    var u = $("impUnit"), found = false;
    Array.prototype.forEach.call(u.options, function (o) { if (Math.abs(Number(o.value) - imp.scale) < 1e-9) { o.selected = true; found = true; } });
    if (!found) u.value = "0.001";
    $("impMode").value = imp.mode;
    var ol = d.outlineLayers.map(function (o) { return o.layer; });
    layers.forEach(function (n) { if (imp.doc.layers[n].closed && ol.indexOf(n) < 0) ol.push(n); });
    $("impLayer").innerHTML = ol.length ? ol.map(function (n) {
      var o = d.outlineLayers.filter(function (x) { return x.layer === n; })[0];
      return '<option value="' + esc(n) + '"' + (n === imp.layer ? " selected" : "") + ">" + esc(n) + (o ? " (" + o.rooms + " outlines, " + o.labelled + " named)" : "") + "</option>";
    }).join("") : '<option value="">No closed polylines in this drawing</option>';
    $("impGap").value = imp.gap; $("impSplit").checked = imp.split;
    $("impWalls").innerHTML = layers.filter(function (n) { return imp.doc.layers[n].paths; }).map(function (n) {
      return '<label class="chk"><input type="checkbox" value="' + esc(n) + '"' + (imp.walls.indexOf(n) >= 0 ? " checked" : "") + "> " + esc(n) + " <i>" + imp.doc.layers[n].paths + "</i></label>";
    }).join("");
    syncImportControls();
  }
  function syncImportControls() {
    var w = imp.mode === "walls";
    $("impLayerRow").hidden = w; $("impGapRow").hidden = !w; $("impSplitRow").hidden = !w; $("impWallsRow").hidden = !w;
    $("impWallsN").textContent = "(" + imp.walls.length + ")";
  }
  function runImport() {
    var res = imp.mode === "walls"
      ? D.roomsFromWalls(imp.doc, { wallLayers: imp.walls, scale: imp.scale, gap: imp.gap, split: imp.split })
      : (imp.layer ? D.roomsFromOutlines(imp.doc, { layer: imp.layer, scale: imp.scale }) : { rooms: [] });
    imp.res = res; imp.rooms = res.rooms; imp.sel = -1;
    /* named rooms are ticked; nameless outlines and very large open areas are left for the designer to decide */
    imp.on = res.rooms.map(function (r) { return !!r.name && r.area <= 3000; });
    imp.rooms.forEach(function (r) { r.useSel = r.use || "custom"; r.nameSel = r.name || ""; });
    renderImportList(); drawImport();
  }
  function renderImportList() {
    var stdName = function (id) { return stdById(id).name; };
    $("impBody").innerHTML = imp.rooms.map(function (r, i) {
      var flags = (r.irregular ? '<span class="tag" title="Not a rectangle: length x width is the rectangle with the same area and perimeter">irregular</span>' : "") +
        (r.split ? '<span class="tag warn" title="Open-plan area divided between room names - boundary is approximate">split</span>' : "") +
        (!r.use ? '<span class="tag warn" title="Space type not recognised from the name - choose it">type?</span>' : "");
      return '<tr data-i="' + i + '"' + (i === imp.sel ? ' class="sel"' : "") + '><td class="c-no"><input type="checkbox" data-on' + (imp.on[i] ? " checked" : "") + '><b class="no" style="--h:' + hue(i) + '">' + (i + 1) + "</b></td>" +
        '<td><input type="text" data-k="nameSel" value="' + esc(r.nameSel) + '" placeholder="(no name in the drawing)">' + flags + "</td>" +
        '<td><select data-k="useSel" title="' + esc(stdName(r.useSel)) + '">' + useOptions(r.useSel) + "</select></td>" +
        '<td class="c-n">' + r1(r.area) + '</td><td class="c-n">' + r2(r.L) + " × " + r2(r.W) + '</td><td class="c-n">' + (r.ch ? r2(r.ch) : '<span class="hint">default</span>') + "</td></tr>";
    }).join("");
    var n = imp.on.filter(Boolean).length, msg = [];
    if (!imp.rooms.length) msg.push(imp.mode === "outline" ? "No room outlines on this layer. Try another layer, or switch to 'Wall lines + room names'." : (imp.res.error || "No rooms found. Check the wall layers and the units."));
    else msg.push(imp.rooms.length + " rooms found, " + n + " selected. Nameless outlines and open areas over 3,000 m² are not ticked.");
    if (imp.res.skipped) msg.push(imp.res.skipped + " name(s) sit in space open to the outside and were skipped" + (imp.res.openNames && imp.res.openNames.length ? ": " + imp.res.openNames.slice(0, 6).join(", ") : "") + ". If that is wrong, raise the door-gap width or tick the glazing / door layers.");
    var withCh = imp.rooms.filter(function (r) { return r.ch; }).length;
    if (imp.rooms.length) msg.push(withCh ? withCh + " ceiling height(s) read from CH texts." : "No CH ceiling-height texts - defaults are used; upload the ceiling plan to fill them.");
    $("impMsg").innerHTML = msg.map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("");
    $("impAll").checked = n && n === imp.rooms.length;
    $("impOk").textContent = n ? "Add " + n + " room" + (n > 1 ? "s" : "") : "Add rooms";
    $("impOk").disabled = !n;
  }
  function hue(i) { return (i * 137.5 + 32) % 360; }

  function drawImport() {
    var cv = $("impCanvas"), box = cv.parentNode, dpr = window.devicePixelRatio || 1;
    var Wc = box.clientWidth, Hc = box.clientHeight;
    cv.width = Wc * dpr; cv.height = Hc * dpr; cv.style.width = Wc + "px"; cv.style.height = Hc + "px";
    var g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, Wc, Hc);
    var css = getComputedStyle(document.documentElement), mute = css.getPropertyValue("--line-2").trim();
    var showLayers = {};
    if (imp.mode === "walls") imp.walls.forEach(function (n) { showLayers[n] = 1; }); else showLayers[imp.layer] = 1;
    var paths = imp.doc.paths.filter(function (p) { return showLayers[p.layer]; });
    if (imp.mode === "outline") { /* show the walls too, for orientation */
      var wl = {}; imp.det.wallLayers.forEach(function (n) { wl[n] = 1; });
      paths = imp.doc.paths.filter(function (p) { return wl[p.layer]; }).concat(paths);
    }
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    (imp.rooms.length ? imp.rooms.map(function (r) { return [[r.bb[0], r.bb[1]], [r.bb[2], r.bb[3]]]; }) : paths.map(function (p) { return p.pts; })).forEach(function (pts) {
      pts.forEach(function (q) { if (q[0] < b[0]) b[0] = q[0]; if (q[1] < b[1]) b[1] = q[1]; if (q[0] > b[2]) b[2] = q[0]; if (q[1] > b[3]) b[3] = q[1]; });
    });
    if (!isFinite(b[0])) return;
    var mx = (b[2] - b[0]) * 0.04 + 1e-6, my = (b[3] - b[1]) * 0.04 + 1e-6; b = [b[0] - mx, b[1] - my, b[2] + mx, b[3] + my];
    var k = Math.min(Wc / (b[2] - b[0]), Hc / (b[3] - b[1])), ox = (Wc - (b[2] - b[0]) * k) / 2, oy = (Hc - (b[3] - b[1]) * k) / 2;
    var X = function (x) { return ox + (x - b[0]) * k; }, Y = function (y) { return Hc - oy - (y - b[1]) * k; };
    /* rooms */
    if (imp.mode === "walls" && imp.res.raster) {
      var R = imp.res.raster, off = document.createElement("canvas"); off.width = R.nx; off.height = R.ny;
      var og = off.getContext("2d"), im = og.createImageData(R.nx, R.ny), px = im.data, col = {};
      imp.rooms.forEach(function (r, i) {
        var c = hsl(hue(i), imp.on[i] ? 0.62 : 0.0, imp.on[i] ? 0.55 : 0.6), a = i === imp.sel ? 200 : imp.on[i] ? 110 : 45;
        col[r.regionId] = [c[0], c[1], c[2], a];
      });
      for (var y = 0; y < R.ny; y++) for (var x = 0; x < R.nx; x++) {
        var c2 = col[R.label[y * R.nx + x]]; if (!c2) continue;
        var o = ((R.ny - 1 - y) * R.nx + x) * 4; px[o] = c2[0]; px[o + 1] = c2[1]; px[o + 2] = c2[2]; px[o + 3] = c2[3];
      }
      og.putImageData(im, 0, 0);
      var wx0 = R.origin[0] - R.pad * R.cell / R.scale, wy0 = R.origin[1] - R.pad * R.cell / R.scale, wx1 = wx0 + R.nx * R.cell / R.scale, wy1 = wy0 + R.ny * R.cell / R.scale;
      g.imageSmoothingEnabled = false;
      g.drawImage(off, X(wx0), Y(wy1), X(wx1) - X(wx0), Y(wy0) - Y(wy1));
    } else {
      imp.rooms.forEach(function (r, i) {
        var c = hsl(hue(i), imp.on[i] ? 0.62 : 0, imp.on[i] ? 0.55 : 0.6);
        g.beginPath(); r.outline.forEach(function (q, j) { if (j) g.lineTo(X(q[0]), Y(q[1])); else g.moveTo(X(q[0]), Y(q[1])); }); g.closePath();
        g.fillStyle = "rgba(" + c.join(",") + "," + (i === imp.sel ? 0.8 : imp.on[i] ? 0.42 : 0.16) + ")"; g.fill();
        g.strokeStyle = "rgba(" + c.join(",") + ",0.95)"; g.lineWidth = i === imp.sel ? 2 : 1; g.stroke();
      });
    }
    /* drawing lines */
    g.strokeStyle = mute; g.lineWidth = 0.7; g.beginPath();
    paths.forEach(function (p) {
      var pts = p.pts; g.moveTo(X(pts[0][0]), Y(pts[0][1]));
      for (var j = 1; j < pts.length; j++) g.lineTo(X(pts[j][0]), Y(pts[j][1]));
      if (p.closed) g.lineTo(X(pts[0][0]), Y(pts[0][1]));
    });
    g.stroke();
    /* room numbers */
    g.font = "600 11px Inter, Segoe UI, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    imp.rooms.forEach(function (r, i) {
      var x0 = X(r.labelX), y0 = Y(r.labelY), t = String(i + 1), w = g.measureText(t).width + 9;
      g.fillStyle = imp.on[i] ? "hsl(" + hue(i) + ",62%,40%)" : "rgba(120,120,120,.75)";
      g.beginPath(); g.roundRect ? g.roundRect(x0 - w / 2, y0 - 8, w, 16, 8) : g.rect(x0 - w / 2, y0 - 8, w, 16); g.fill();
      g.fillStyle = "#fff"; g.fillText(t, x0, y0 + 0.5);
    });
    imp.view = { X: X, Y: Y, k: k, b: b, ox: ox, oy: oy, Hc: Hc };
  }
  function hsl(h, s, l) {
    var a = s * Math.min(l, 1 - l), f = function (n) { var k2 = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k2 - 3, 9 - k2, 1)))); };
    return [f(0), f(8), f(4)];
  }
  /* click on the drawing selects the room under the cursor */
  $("impCanvas").addEventListener("click", function (e) {
    if (!imp || !imp.view) return;
    var rc = e.target.getBoundingClientRect(), v = imp.view, px2 = e.clientX - rc.left, py2 = e.clientY - rc.top;
    var wx = v.b[0] + (px2 - v.ox) / v.k, wy = v.b[1] + (v.Hc - v.oy - py2) / v.k, hit = -1;
    if (imp.mode === "walls" && imp.res.raster) {
      var R = imp.res.raster, gx = Math.floor((wx - R.origin[0]) * R.scale / R.cell + R.pad), gy = Math.floor((wy - R.origin[1]) * R.scale / R.cell + R.pad);
      var id = gx >= 0 && gy >= 0 && gx < R.nx && gy < R.ny ? R.label[gy * R.nx + gx] : 0;
      imp.rooms.forEach(function (r, i) { if (r.regionId === id) hit = i; });
    } else {
      var best = Infinity;
      imp.rooms.forEach(function (r, i) { if (r.area < best && wx >= r.bb[0] && wx <= r.bb[2] && wy >= r.bb[1] && wy <= r.bb[3] && pointIn(wx, wy, r.outline)) { best = r.area; hit = i; } });
    }
    if (hit < 0) return;
    imp.on[hit] = imp.sel === hit ? !imp.on[hit] : imp.on[hit];
    imp.sel = hit; renderImportList(); drawImport();
    var tr = $("impBody").children[hit]; if (tr) tr.scrollIntoView({ block: "nearest" });
  });
  function pointIn(x, y, pts) {
    var c = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) if ((pts[i][1] > y) !== (pts[j][1] > y) && x < (pts[j][0] - pts[i][0]) * (y - pts[i][1]) / (pts[j][1] - pts[i][1]) + pts[i][0]) c = !c;
    return c;
  }
  $("impBody").addEventListener("change", function (e) {
    var tr = e.target.closest("tr"); if (!tr) return; var i = Number(tr.getAttribute("data-i"));
    if (e.target.hasAttribute("data-on")) { imp.on[i] = e.target.checked; renderImportList(); drawImport(); return; }
    var k = e.target.getAttribute("data-k"); if (k) imp.rooms[i][k] = e.target.value;
  });
  $("impBody").addEventListener("input", function (e) {
    var tr = e.target.closest("tr"), k = e.target.getAttribute("data-k"); if (tr && k) imp.rooms[Number(tr.getAttribute("data-i"))][k] = e.target.value;
  });
  $("impBody").addEventListener("click", function (e) {
    var tr = e.target.closest("tr"); if (!tr || /INPUT|SELECT/.test(e.target.tagName)) return;
    imp.sel = Number(tr.getAttribute("data-i")); renderImportList(); drawImport();
  });
  $("impAll").addEventListener("change", function () { var v = $("impAll").checked; imp.on = imp.rooms.map(function () { return v; }); renderImportList(); drawImport(); });
  $("impUnit").addEventListener("change", function () { imp.scale = Number($("impUnit").value); runImport(); });
  $("impMode").addEventListener("change", function () { imp.mode = $("impMode").value; syncImportControls(); runImport(); });
  $("impLayer").addEventListener("change", function () { imp.layer = $("impLayer").value; runImport(); });
  $("impGap").addEventListener("change", function () { var v = C.num($("impGap").value); imp.gap = v === null || v < 0 ? 1 : Math.min(v, 6); $("impGap").value = imp.gap; runImport(); });
  $("impSplit").addEventListener("change", function () { imp.split = $("impSplit").checked; runImport(); });
  $("impWalls").addEventListener("change", function () {
    imp.walls = Array.prototype.filter.call($("impWalls").querySelectorAll("input"), function (x) { return x.checked; }).map(function (x) { return x.value; });
    syncImportControls(); runImport();
  });
  function closeImport() { $("imp").hidden = true; imp = null; }
  $("impClose").addEventListener("click", closeImport);
  $("impCancel").addEventListener("click", closeImport);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && imp) closeImport(); });
  window.addEventListener("resize", function () { if (imp) drawImport(); });

  $("impOk").addEventListener("click", function () {
    var replace = document.querySelector('input[name="impMerge"]:checked').value === "replace", upd = $("impUpd").checked;
    if (replace && state.rooms.length && !confirm("Replace the " + state.rooms.length + " current room(s) with the rooms from the drawing?")) return;
    var before = replace ? [] : state.rooms.slice(), used = [], added = 0, updated = 0;
    var key = function (s) { return String(s || "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim(); };
    if (replace) state.rooms = [];
    imp.rooms.forEach(function (r, i) {
      if (!imp.on[i]) return;
      var use = r.useSel || "custom", std = stdById(use), name = r.nameSel.trim();
      var L = C.round(r.L, 2), W = C.round(r.W, 2);
      var drawing = { file: imp.file, area: C.round(r.area, 2), irregular: !!r.irregular, split: !!r.split };
      var match = null;
      if (upd && name) before.forEach(function (x) { if (!match && used.indexOf(x) < 0 && key(x.name) === key(name)) match = x; });
      if (match) {
        used.push(match);
        if (r.ch) { match.height = r.ch; match.heightAuto = false; }
        if (!C.num(match.length) || !C.num(match.width) || match.drawing) { match.length = L; match.width = W; match.drawing = drawing; }
        updated++;
        return;
      }
      state.rooms.push({ name: name, use: use, length: L, width: W, height: r.ch || std.defaultH, heightAuto: !r.ch, targetLux: "", fixtureId: "", suspension: "", workPlane: "", drawing: drawing });
      added++;
    });
    closeImport();
    state.sel = Math.max(0, state.rooms.length - added);
    renderRooms(); save();
    toast(added + " room(s) added" + (updated ? ", " + updated + " updated by name" : "") + " from the drawing.");
  });
  function toast(t) {
    var el = document.createElement("div"); el.className = "toast"; el.textContent = t; document.body.appendChild(el);
    setTimeout(function () { el.classList.add("out"); }, 3200); setTimeout(function () { el.remove(); }, 3800);
  }

  $("btnImport").addEventListener("click", function () { $("fileDwg").click(); });
  $("fileDwg").addEventListener("change", function () { var f = $("fileDwg").files[0]; $("fileDwg").value = ""; openDrawing(f); });
  /* drag and drop anywhere on the page */
  var dragN = 0;
  document.addEventListener("dragenter", function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, "Files") >= 0) { dragN++; $("dropHint").hidden = false; } });
  document.addEventListener("dragleave", function () { dragN = Math.max(0, dragN - 1); if (!dragN) $("dropHint").hidden = true; });
  document.addEventListener("dragover", function (e) { e.preventDefault(); });
  document.addEventListener("drop", function (e) {
    e.preventDefault(); dragN = 0; $("dropHint").hidden = true;
    var f = e.dataTransfer && e.dataTransfer.files[0]; if (!f) return;
    if (/\.json$/i.test(f.name)) return;
    openDrawing(f);
  });

  /* ---------------- header ---------------- */
  $("tabs").addEventListener("click", function (e) {
    var t = e.target.getAttribute("data-tab"); if (!t) return;
    Array.prototype.forEach.call($("tabs").children, function (b) { b.classList.toggle("on", b === e.target); });
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (s) { s.classList.toggle("on", s.id === "tab-" + t); });
  });
  $("projName").addEventListener("input", function () { state.name = $("projName").value; save(); });
  $("btnTheme").addEventListener("click", function () {
    var root = document.documentElement, next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("gdsiLighting.theme", next); } catch (e) { /* storage unavailable */ }
  });
  $("setMf").addEventListener("change", function () {
    var v = C.num($("setMf").value); if (!v || v < 0.5 || v > 1) v = 0.8;
    state.settings.mf = v; $("setMf").value = v; renderRooms(); save();
  });
  $("setRefl").addEventListener("change", function () { state.settings.reflectance = $("setRefl").value; renderRooms(); save(); });

  function init() {
    $("projName").value = state.name;
    $("setMf").value = state.settings.mf;
    $("setRefl").innerHTML = Object.keys(C.UF_TABLES).map(function (k) { return '<option value="' + k + '"' + (k === state.settings.reflectance ? " selected" : "") + ">" + esc(C.UF_TABLES[k].label) + "</option>"; }).join("");
    resetFxForm(); renderFixtures(); renderStandards(); renderRooms();
  }
  init();
})();
