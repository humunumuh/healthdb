"use strict";

const $ = (id) => document.getElementById(id);
const assetUrl = (path) => `${path}?v=20261008-6`;
const dateFormat = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const numberFormat = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 20 });
const state = { markers: [], selected: null, showAll: false, toastTimer: null };
const make = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const numeric = (value) => typeof value === "number" && Number.isFinite(value);
const dateValue = (date) => Date.parse(date + "T12:00:00Z");
const formatDate = (date) => dateFormat.format(new Date(dateValue(date)));
const formatValue = (value) => value === null ? "Not recorded" : numeric(value) ? numberFormat.format(value) : String(value);
const formatSource = (source) => source.replace(/^Laboratory /, "Lab ");
function rangeText(result) {
  if (numeric(result.low) && numeric(result.high)) return `${formatValue(result.low)}–${formatValue(result.high)}`;
  if (numeric(result.low)) return `≥ ${formatValue(result.low)}`;
  if (numeric(result.high)) return `≤ ${formatValue(result.high)}`;
  return "Not recorded";
}
function comparison(result) {
  if (!numeric(result.value)) return { label: "Not compared", className: "none" };
  if (numeric(result.low) && result.value < result.low) return { label: "Below range", className: "low" };
  if (numeric(result.high) && result.value > result.high) return { label: "Above range", className: "high" };
  if (numeric(result.low) && numeric(result.high)) return { label: "Within range", className: "within" };
  if (numeric(result.low) || numeric(result.high)) return { label: "Meets limit", className: "within" };
  return { label: "No range", className: "none" };
}
function badge(result) {
  const status = comparison(result);
  return make("span", status.label, `status ${status.className}`);
}

function renderCase(data) {
  $("case-summary").textContent = data.summary;
  data.observations.forEach((text) => $("observations").append(make("li", text)));
  data.findings.forEach((finding) => {
    const item = make("div", undefined, "finding");
    item.append(make("h3", finding.title), make("p", finding.detail));
    $("findings").append(item);
  });
  $("leading-hypothesis").textContent = data.hypotheses.leading;
  $("other-hypotheses").replaceWith(make("ul", undefined, "hypothesis-list"));
  const hypotheses = document.querySelector(".hypothesis-list");
  hypotheses.before(make("h3", "Other hypotheses"));
  data.hypotheses.others.forEach((text) => hypotheses.append(make("li", text)));
  data.treatments.forEach((treatment) => {
    const item = make("li");
    item.append(make("strong", treatment.name + ": "), document.createTextNode(treatment.detail));
    $("treatments").append(item);
  });
  data.questions.forEach((text) => $("questions").append(make("li", text)));
  data.reports.forEach((report) => {
    const card = make("article", undefined, "report-card");
    const thumbnail = make("a", undefined, "report-thumbnail");
    thumbnail.href = assetUrl(report.image);
    thumbnail.target = "_blank";
    thumbnail.rel = "noopener";
    thumbnail.setAttribute("aria-label", `Open ${report.title}, ${report.kind.toLowerCase()}`);
    const image = make("img");
    image.src = assetUrl(report.image);
    image.alt = `${report.title} — ${report.kind.toLowerCase()}`;
    image.loading = "lazy";
    thumbnail.append(image);
    const copy = make("div", undefined, "report-copy");
    const kind = report.kind === "Report transcription" ? "Transcription" : "Original excerpt";
    copy.append(make("p", `${formatDate(report.date)} · ${kind}`, "report-kind"), make("h3", report.title));
    const links = make("div", undefined, "report-links");
    const link = make("a", "Image");
    link.setAttribute("aria-label", `Image: ${report.title}`);
    link.href = assetUrl(report.image);
    link.target = "_blank";
    link.rel = "noopener";
    links.append(link);
    if (report.pdf) {
      const pdf = make("a", "PDF");
      pdf.setAttribute("aria-label", `PDF: ${report.title}`);
      pdf.href = assetUrl(report.pdf);
      pdf.target = "_blank";
      pdf.rel = "noopener";
      links.append(pdf);
    }
    copy.append(links);
    if (report.pages && report.pages.length > 1) {
      const pages = make("div", undefined, "report-pages");
      report.pages.forEach((path, index) => {
        const page = make("a", `Page ${index + 1}`);
        page.href = assetUrl(path);
        page.target = "_blank";
        page.rel = "noopener";
        pages.append(page);
      });
      copy.append(pages);
    }
    card.append(thumbnail, copy);
    $("report-grid").append(card);
  });
}

function renderList() {
  const search = $("test-search").value.trim().toLocaleLowerCase();
  const category = $("category-filter").value;
  const matches = state.markers.filter((marker) => (!category || marker.category === category) && `${marker.name} ${marker.unit}`.toLocaleLowerCase().includes(search));
  $("test-count").textContent = `${matches.length} of ${state.markers.length} tests`;
  $("test-list").replaceChildren();
  if (!matches.length) $("test-list").append(make("p", "No tests", "small-note"));
  matches.forEach((marker) => {
    const button = make("button", undefined, "test-button");
    button.type = "button";
    button.setAttribute("aria-pressed", String(state.selected?.key === marker.key));
    button.append(make("span", marker.name), make("small", marker.results.length));
    button.addEventListener("click", () => selectMarker(marker));
    $("test-list").append(button);
  });
}

function selectMarker(marker, updateUrl = true) {
  state.selected = marker;
  state.showAll = false;
  $("outside-only").checked = false;
  $("test-category").textContent = marker.category;
  $("test-name").textContent = marker.name;
  $("test-unit").textContent = marker.unit;
  $("table-caption").textContent = `${marker.name}: recorded collection history`;
  const latest = marker.results[marker.results.length - 1];
  const main = make("div", undefined, "latest-main");
  main.append(make("div", formatValue(latest.value), "latest-value"), make("span", "Latest", "latest-label"));
  const meta = make("div", undefined, "latest-meta");
  meta.append(make("div", formatDate(latest.date)), make("div", `Range: ${rangeText(latest)}`), make("div", formatSource(latest.source)));
  $("latest-results").replaceChildren(main, meta, badge(latest));
  renderChart(marker);
  renderRows();
  renderList();
  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("test", marker.key);
    window.history.replaceState(null, "", url);
  }
}

function renderRows() {
  const results = [...state.selected.results].reverse();
  const outside = $("outside-only").checked;
  const matches = outside ? results.filter((result) => ["low", "high"].includes(comparison(result).className)) : results;
  const shown = state.showAll ? matches : matches.slice(0, 10);
  $("result-rows").replaceChildren();
  shown.forEach((result) => {
    const row = make("tr");
    row.append(make("td", formatDate(result.date)), make("td", formatValue(result.value)), make("td", rangeText(result)));
    const statusCell = make("td");
    statusCell.append(badge(result));
    row.append(statusCell, make("td", formatSource(result.source)));
    $("result-rows").append(row);
  });
  if (!shown.length) {
    const cell = make("td", "No results");
    cell.colSpan = 5;
    const row = make("tr");
    row.append(cell);
    $("result-rows").append(row);
  }
  $("row-note").textContent = `${shown.length} of ${matches.length} results`;
  $("show-all").hidden = matches.length <= 10;
  $("show-all").textContent = state.showAll ? "Latest 10" : `All ${matches.length}`;
}

const svgNS = "http://www.w3.org/2000/svg";
function svgNode(tag, attrs = {}, text) {
  const node = document.createElementNS(svgNS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  if (text !== undefined) node.textContent = text;
  return node;
}
function renderChart(marker) {
  const points = marker.results.filter((result) => numeric(result.value));
  $("chart").replaceChildren();
  if (!points.length) {
    $("chart").append(make("p", "No numeric values", "empty-chart"));
    $("chart-note").textContent = "";
    return;
  }
  const width = 720, height = 245, left = 54, right = 18, top = 20, bottom = 36;
  const dates = points.map((p) => dateValue(p.date));
  const values = points.flatMap((p) => [p.value, p.low, p.high].filter(numeric));
  const minDate = Math.min(...dates), maxDate = Math.max(...dates);
  let minValue = Math.min(...values), maxValue = Math.max(...values);
  const margin = (maxValue - minValue || Math.max(Math.abs(maxValue), 1)) * .15;
  minValue -= margin;
  maxValue += margin;
  if (values.every((v) => v >= 0)) minValue = Math.max(0, minValue);
  const x = (date) => minDate === maxDate ? (width + left - right) / 2 : left + (dateValue(date) - minDate) / (maxDate - minDate) * (width - left - right);
  const y = (value) => top + (maxValue - value) / (maxValue - minValue) * (height - top - bottom);
  const svg = svgNode("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-labelledby": "chart-title chart-description" });
  svg.append(svgNode("title", { id: "chart-title" }, `${marker.name}: exact numerical results over time`));
  svg.append(svgNode("desc", { id: "chart-description" }, "Green points show recorded values. Grey vertical lines show the lower and upper recorded reference limits for that collection, when both are available. The table contains all results and dates."));
  for (let i = 0; i <= 4; i++) {
    const value = minValue + (maxValue - minValue) * i / 4;
    const pos = y(value);
    svg.append(svgNode("line", { x1: left, x2: width - right, y1: pos, y2: pos, stroke: "#e8ece4", "stroke-width": 1 }));
    svg.append(svgNode("text", { x: left - 9, y: pos + 4, "text-anchor": "end", fill: "#67736d", "font-size": 12 }, new Intl.NumberFormat("en-AU", { maximumSignificantDigits: 3 }).format(value)));
  }
  const dateTicks = minDate === maxDate ? [minDate] : [minDate, (minDate + maxDate) / 2, maxDate];
  dateTicks.forEach((date, index) => {
    const pos = minDate === maxDate ? (width + left - right) / 2 : left + (date - minDate) / (maxDate - minDate) * (width - left - right);
    const label = new Intl.DateTimeFormat("en-AU", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(date));
    svg.append(svgNode("text", { x: pos, y: height - 10, "text-anchor": dateTicks.length === 1 ? "middle" : index === 0 ? "start" : index === 2 ? "end" : "middle", fill: "#67736d", "font-size": 12 }, label));
  });
  points.forEach((point) => {
    if (!numeric(point.low) || !numeric(point.high)) return;
    const pos = x(point.date);
    const interval = svgNode("g");
    interval.append(svgNode("title", {}, `${formatDate(point.date)}: recorded range ${rangeText(point)}`));
    interval.append(svgNode("line", { x1: pos, x2: pos, y1: y(point.low), y2: y(point.high), stroke: "#c9d5c8", "stroke-width": 4, "stroke-linecap": "round" }));
    svg.append(interval);
  });
  let segment = [];
  const drawSegment = () => {
    if (segment.length > 1) svg.append(svgNode("polyline", { points: segment.map((p) => `${x(p.date)},${y(p.value)}`).join(" "), fill: "none", stroke: "#174c40", "stroke-width": 1.8 }));
    segment = [];
  };
  marker.results.forEach((result) => {
    if (numeric(result.value)) segment.push(result);
    else drawSegment();
  });
  drawSegment();
  points.forEach((point) => {
    const dot = svgNode("circle", { cx: x(point.date), cy: y(point.value), r: 4, fill: "#174c40", stroke: "white", "stroke-width": 1.5 });
    dot.append(svgNode("title", {}, `${formatDate(point.date)}: ${formatValue(point.value)} ${marker.unit}; range ${rangeText(point)}; ${point.source}`));
    svg.append(dot);
  });
  $("chart").append(svg);
  const omitted = marker.results.length - points.length;
  $("chart-note").replaceChildren(make("span", "Results", "legend-results"), make("span", "Reference range", "legend-range"));
  if (omitted) $("chart-note").append(make("span", `${omitted} unplotted`));
}

async function copyLink(section, testKey, scanSelection) {
  const url = new URL(window.location.href);
  url.search = "";
  if (testKey) url.searchParams.set("test", testKey);
  if (scanSelection) {
    url.searchParams.set("scan", scanSelection.study);
    url.searchParams.set("series", scanSelection.series);
    url.searchParams.set("slice", scanSelection.slice);
  }
  url.hash = section;
  let copied = false;
  try {
    await navigator.clipboard.writeText(url.href);
    copied = true;
  } catch {
    const input = make("textarea");
    input.value = url.href;
    input.className = "sr-only";
    document.body.append(input);
    input.select();
    try { copied = document.execCommand("copy"); } catch { copied = false; }
    input.remove();
  }
  $("toast").textContent = copied ? "Copied" : url.href;
  $("toast").classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => $("toast").classList.remove("show"), copied ? 3500 : 30000);
}

async function load() {
  try {
    const responses = await Promise.all([fetch(assetUrl("data/case.json")), fetch(assetUrl("data/labs.json"))]);
    if (responses.some((response) => !response.ok)) throw new Error("The data files could not be loaded.");
    const [caseData, labs] = await Promise.all(responses.map((response) => response.json()));
    renderCase(caseData);
    state.markers = labs.markers;
    $("data-stats").replaceChildren();
    [[numberFormat.format(labs.resultCount), "results"], [labs.markerCount, "tests"], [`${labs.firstDate.slice(0, 4)}–${labs.lastDate.slice(0, 4)}`, "dates"]].forEach(([value, label]) => {
      const stat = make("div", undefined, "stat");
      stat.append(make("strong", value), make("span", label));
      $("data-stats").append(stat);
    });
    [...new Set(state.markers.map((marker) => marker.category))].sort().forEach((category) => {
      const option = make("option", category);
      option.value = category;
      $("category-filter").append(option);
    });
    const key = new URL(window.location.href).searchParams.get("test");
    selectMarker(state.markers.find((marker) => marker.key === key) || state.markers.find((marker) => marker.key === "alp") || state.markers[0], false);
    $("test-search").addEventListener("input", renderList);
    $("category-filter").addEventListener("change", renderList);
    $("outside-only").addEventListener("change", () => { state.showAll = false; renderRows(); });
    $("show-all").addEventListener("click", () => { state.showAll = !state.showAll; renderRows(); });
    $("share-test").addEventListener("click", () => copyLink("labs", state.selected.key));
    $("share-reports").addEventListener("click", () => copyLink("reports"));
    $("share-scans").addEventListener("click", () => copyLink("scans", null, $("scan-viewer").healthDBScanViewer?.getSelection?.()));
    const sectionId = window.location.hash.slice(1);
    if (["labs", "scans", "reports", "overview"].includes(sectionId)) {
      $(sectionId).scrollIntoView({ behavior: "instant", block: "start" });
    }
  } catch (error) {
    console.error(error);
    $("load-error").textContent = "Could not load. Refresh the page.";
    $("load-error").hidden = false;
    $("test-detail").hidden = true;
    $("data-stats").textContent = "Data unavailable";
    $("case-summary").textContent = "Could not load. Refresh the page.";
  }
}
load();
