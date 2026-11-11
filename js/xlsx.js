/* Minimal styled XLSX writer (no dependencies): zip container + SpreadsheetML with fonts, fills, borders, number formats. */
(function () {
  "use strict";
  var enc = new TextEncoder();
  var MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  var HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

  /* ---------- zip (stored, no compression) ---------- */
  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    var parts = [], central = [], offset = 0, d = new Date();
    var time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(10, time, true); lh.setUint16(12, date, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    });
    var csize = central.reduce(function (a, p) { return a + p.length; }, 0);
    var e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  function esc(s) {
    return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }
  function colName(i) { var s = ""; for (i += 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; }

  /* ---------- style registry ----------
     spec: { b, i, sz, color, fill, fmt, h (left|center|right), v (top|center), wrap, border: { top|bottom|left|right: "thin:RRGGBB" } } */
  function Styles() {
    this.fonts = []; this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    this.borders = []; this.fmts = []; this.xfs = []; this.cache = {};
    this.get({});
  }
  function intern(list, xml) { var i = list.indexOf(xml); if (i < 0) { list.push(xml); i = list.length - 1; } return i; }
  Styles.prototype.get = function (s) {
    var key = JSON.stringify(s);
    if (key in this.cache) return this.cache[key];
    var font = intern(this.fonts, "<font>" + (s.b ? "<b/>" : "") + (s.i ? "<i/>" : "") + '<sz val="' + (s.sz || 10) + '"/><color rgb="FF' + (s.color || "1F2328") + '"/><name val="Calibri"/><family val="2"/></font>');
    var fill = s.fill ? intern(this.fills, '<fill><patternFill patternType="solid"><fgColor rgb="FF' + s.fill + '"/><bgColor indexed="64"/></patternFill></fill>') : 0;
    var b = s.border || {};
    var side = function (n) { if (!b[n]) return "<" + n + "/>"; var p = b[n].split(":"); return "<" + n + ' style="' + p[0] + '"><color rgb="FF' + p[1] + '"/></' + n + ">"; };
    var border = intern(this.borders, "<border>" + side("left") + side("right") + side("top") + side("bottom") + "<diagonal/></border>");
    var fmt = s.fmt ? 164 + intern(this.fmts, s.fmt) : 0;
    this.xfs.push('<xf numFmtId="' + fmt + '" fontId="' + font + '" fillId="' + fill + '" borderId="' + border + '" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
      "<alignment" + (s.h ? ' horizontal="' + s.h + '"' : "") + ' vertical="' + (s.v || "center") + '"' + (s.wrap ? ' wrapText="1"' : "") + (s.indent ? ' indent="' + s.indent + '"' : "") + "/></xf>");
    return (this.cache[key] = this.xfs.length - 1);
  };
  Styles.prototype.xml = function () {
    var list = function (tag, a) { return "<" + tag + ' count="' + a.length + '">' + a.join("") + "</" + tag + ">"; };
    return HEAD + '<styleSheet xmlns="' + MAIN + '">' +
      (this.fmts.length ? list("numFmts", this.fmts.map(function (f, i) { return '<numFmt numFmtId="' + (164 + i) + '" formatCode="' + esc(f) + '"/>'; })) : "") +
      list("fonts", this.fonts) + list("fills", this.fills) + list("borders", this.borders) +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' + list("cellXfs", this.xfs) +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  };

  /* ---------- worksheet ----------
     o: { name, rows: [{ h, c: [{ v, s, f }] }], cols: [width], merges: ["A1:C1"], freeze: { col, row }, filter: "A6:T12",
          repeatRows: "5:6", paper, landscape, footer } */
  function sheetXml(o, active) {
    var x = HEAD + '<worksheet xmlns="' + MAIN + '"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>';
    x += '<sheetViews><sheetView showGridLines="0"' + (active ? ' tabSelected="1"' : "") + ' workbookViewId="0">';
    if (o.freeze) {
      var fc = o.freeze.col || 0, fr = o.freeze.row || 0, pane = fc && fr ? "bottomRight" : fr ? "bottomLeft" : "topRight";
      x += "<pane" + (fc ? ' xSplit="' + fc + '"' : "") + (fr ? ' ySplit="' + fr + '"' : "") + ' topLeftCell="' + colName(fc) + (fr + 1) + '" activePane="' + pane + '" state="frozen"/>' +
        '<selection pane="' + pane + '" activeCell="' + colName(fc) + (fr + 1) + '" sqref="' + colName(fc) + (fr + 1) + '"/>';
    }
    x += '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>';
    if (o.cols) x += "<cols>" + o.cols.map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join("") + "</cols>";
    x += "<sheetData>";
    o.rows.forEach(function (row, ri) {
      x += '<row r="' + (ri + 1) + '"' + (row.h ? ' ht="' + row.h + '" customHeight="1"' : "") + ">";
      (row.c || []).forEach(function (cell, ci) {
        if (!cell) return;
        var ref = ' r="' + colName(ci) + (ri + 1) + '"' + (cell.s ? ' s="' + cell.s + '"' : ""), v = cell.v;
        var num = typeof v === "number" && isFinite(v);
        if (cell.f) x += "<c" + ref + "><f>" + esc(cell.f) + "</f>" + (num ? "<v>" + v + "</v>" : "") + "</c>";
        else if (num) x += "<c" + ref + "><v>" + v + "</v></c>";
        else if (v === null || v === undefined || v === "") x += "<c" + ref + "/>";
        else x += "<c" + ref + ' t="inlineStr"><is><t xml:space="preserve">' + esc(v) + "</t></is></c>";
      });
      x += "</row>";
    });
    x += "</sheetData>";
    if (o.filter) x += '<autoFilter ref="' + o.filter + '"/>';
    if (o.merges && o.merges.length) x += '<mergeCells count="' + o.merges.length + '">' + o.merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join("") + "</mergeCells>";
    x += '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.6" header="0.3" footer="0.3"/>';
    x += '<pageSetup paperSize="' + (o.paper || 9) + '" orientation="' + (o.landscape ? "landscape" : "portrait") + '" fitToWidth="1" fitToHeight="0"/>';
    if (o.footer) x += "<headerFooter><oddFooter>" + esc("&L&8" + o.footer + "&R&8Page &P of &N") + "</oddFooter></headerFooter>";
    return x + "</worksheet>";
  }

  function build(sheets, styles) {
    var q = function (n) { return "'" + n.replace(/'/g, "''") + "'"; };
    var names = "";
    sheets.forEach(function (s, i) {
      if (s.repeatRows) names += '<definedName name="_xlnm.Print_Titles" localSheetId="' + i + '">' + esc(q(s.name) + "!$" + s.repeatRows.replace(":", ":$")) + "</definedName>";
      if (s.filter) names += '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">' + esc(q(s.name) + "!" + s.filter.replace(/([A-Z]+)(\d+)/g, "$$$1$$$2")) + "</definedName>";
    });
    var files = [
      { name: "[Content_Types].xml", text: HEAD + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join("") +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
      { name: "_rels/.rels", text: HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: "xl/workbook.xml", text: HEAD + '<workbook xmlns="' + MAIN + '" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="15000"/></bookViews><sheets>' +
          sheets.map(function (s, i) { return '<sheet name="' + esc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join("") + "</sheets>" +
          (names ? "<definedNames>" + names + "</definedNames>" : "") + '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>' },
      { name: "xl/_rels/workbook.xml.rels", text: HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join("") +
          '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
      { name: "xl/styles.xml", text: styles.xml() }
    ];
    sheets.forEach(function (s, i) { files.push({ name: "xl/worksheets/sheet" + (i + 1) + ".xml", text: sheetXml(s, i === 0) }); });
    return zip(files);
  }

  window.GDSIXlsx = { Styles: Styles, build: build, colName: colName };
})();
