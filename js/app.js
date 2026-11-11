/* GDSI Lighting Calculator - UI (stage 1: manual room entry). */
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
    if (room.heightAuto) notes.push("Ceiling height " + room.height + " m is a default - enter the real height.");
    h += '<ul class="msgs">' + notes.map(function (t) { return "<li" + (r.status === "error" || r.status === "fail" ? ' class="err"' : "") + ">" + esc(t) + "</li>"; }).join("") + "</ul>";
    $("detailRes").innerHTML = h;
  }
  $("detail").addEventListener("input", function (e) {
    var k = e.target.getAttribute("data-x"), room = state.rooms[state.sel]; if (!k || !room) return;
    room[k] = e.target.value;
    fillRow(state.sel); renderDetail(false); renderSummary(); save();
  });

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
        e ? "" : C.round(r.achieved), e ? "" : C.round(r.totalWatt), e ? "" : r1(r.lpd), PILL[r.status], (r.info ? [r.info] : []).concat(r.messages).join(" / ")]);
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
        { v: (r.info ? [r.info] : []).concat(r.messages).join("\n"), s: txt({ sz: 9, color: MUTE }) }
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
