"use strict";

(() => {
  let instanceCount = 0;

  function element(tag, className, text) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== undefined) item.textContent = text;
    return item;
  }

  const opposite = (label) => label.replace(/[LRAPHF]/g, (letter) => ({ L: "R", R: "L", A: "P", P: "A", H: "F", F: "H" })[letter]);

  function orientation(value) {
    if (!value || typeof value !== "object") return null;
    const edges = {};
    for (const edge of ["top", "right", "bottom", "left"]) {
      const label = value[edge];
      if (typeof label !== "string" || !/^[LRAPHF]{1,3}$/.test(label)) return null;
      if (new Set(label).size !== label.length || ["LR", "AP", "HF"].some((axis) => [...axis].every((letter) => label.includes(letter)))) return null;
      edges[edge] = label;
    }
    if (edges.right.length === 1 && edges.bottom.length === 1 && ["LR", "AP", "HF"].some((axis) => axis.includes(edges.right) && axis.includes(edges.bottom))) return null;
    return opposite(edges.top) === edges.bottom && opposite(edges.left) === edges.right ? edges : null;
  }

  function mount(root, manifest, options = {}) {
    if (!(root instanceof Element)) throw new Error("A viewer container is required.");
    if (root.healthDBScanViewer) root.healthDBScanViewer.destroy();
    const id = `scan-viewer-${++instanceCount}`;
    const baseUrl = new URL(options.baseUrl || location.href, location.href);
    const toFrame = (frame, defaultOrientation) => {
      const src = typeof frame === "string" ? frame : frame && frame.src;
      if (typeof src !== "string" || !src.trim()) return null;
      try {
        const url = new URL(src, baseUrl);
        if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return null;
        if (!/\.(png|jpe?g|webp)$/i.test(url.pathname)) return null;
        const hasOrientation = frame && typeof frame === "object" && Object.hasOwn(frame, "orientation");
        return { src: url.href, orientation: orientation(hasOrientation ? frame.orientation : defaultOrientation) };
      } catch {
        return null;
      }
    };
    const studies = (Array.isArray(manifest?.studies) ? manifest.studies : []).map((study, studyIndex) => ({
      id: String(study.id ?? studyIndex),
      title: String(study.title || "Scan"),
      date: typeof study.date === "string" ? study.date : "",
      series: (Array.isArray(study.series) ? study.series : []).map((series, seriesIndex) => ({
        id: String(series.id ?? seriesIndex),
        title: String(series.title || "Series"),
        frames: (Array.isArray(series.frames) ? series.frames : []).map((frame) => toFrame(frame, series.orientation)).filter(Boolean),
        startIndex: Number.isInteger(series.startIndex) ? series.startIndex : null
      })).filter((series) => series.frames.length)
    })).filter((study) => study.series.length);

    if (!studies.length) {
      root.replaceChildren(element("p", "scan-empty", "No scans available."));
      const empty = { destroy() { root.replaceChildren(); delete root.healthDBScanViewer; } };
      root.healthDBScanViewer = empty;
      return empty;
    }

    const abort = new AbortController();
    const listen = (target, type, handler, settings = {}) => target.addEventListener(type, handler, { ...settings, signal: abort.signal });
    const view = element("div", "scan-viewer");
    const selectors = element("div", "scan-selectors");
    const studyLabel = element("label", "scan-selector", "Study");
    const studySelect = element("select");
    studySelect.id = `${id}-study`;
    studyLabel.htmlFor = studySelect.id;
    studyLabel.append(studySelect);
    const seriesLabel = element("label", "scan-selector", "Series");
    const seriesSelect = element("select");
    seriesSelect.id = `${id}-series`;
    seriesLabel.htmlFor = seriesSelect.id;
    seriesLabel.append(seriesSelect);
    selectors.append(studyLabel, seriesLabel);

    const stage = element("div", "scan-stage");
    stage.tabIndex = 0;
    stage.setAttribute("role", "region");
    stage.setAttribute("aria-label", "Scan images. Use arrow keys to change slice.");
    const scanImage = element("img", "scan-image");
    scanImage.draggable = false;
    scanImage.hidden = true;
    const message = element("p", "scan-message", "Loading image…");
    const announcement = element("span", "scan-sr-only");
    announcement.setAttribute("role", "status");
    stage.append(scanImage, message, announcement);
    const orientationLabels = {};
    for (const edge of ["top", "right", "bottom", "left"]) {
      const label = element("span", `scan-orientation scan-orientation-${edge}`);
      label.hidden = true;
      label.setAttribute("aria-hidden", "true");
      orientationLabels[edge] = label;
      stage.append(label);
    }

    const controls = element("div", "scan-controls");
    const position = element("div", "scan-position");
    const counter = element("span", "scan-counter");
    const steps = element("div", "scan-step-buttons");
    const previous = element("button", "", "Previous");
    const next = element("button", "", "Next");
    previous.type = next.type = "button";
    previous.setAttribute("aria-label", "Previous slice");
    next.setAttribute("aria-label", "Next slice");
    steps.append(previous, next);
    position.append(counter, steps);
    const slider = element("input", "scan-slider");
    slider.type = "range";
    slider.min = "1";
    slider.step = "1";
    slider.setAttribute("aria-label", "Slice");
    const bottom = element("div", "scan-bottom");
    const hint = element("p", "scan-hint", "Scroll or use arrow keys to browse.");
    const zoomControls = element("div", "scan-zoom");
    const zoomOut = element("button", "", "−");
    const zoomIn = element("button", "", "+");
    const reset = element("button", "", "Reset");
    zoomOut.type = zoomIn.type = reset.type = "button";
    zoomOut.setAttribute("aria-label", "Zoom out");
    zoomIn.setAttribute("aria-label", "Zoom in");
    const zoomLabel = element("span", "scan-zoom-label", "100%");
    zoomControls.append(zoomOut, zoomLabel, zoomIn, reset);
    bottom.append(hint, zoomControls);
    controls.append(position, slider, bottom);
    const note = element("p", "scan-note", "Display copies · Fixed window settings");
    const legend = element("p", "scan-orientation-legend", "L/R left/right · A/P front/back · H/F head/feet");
    legend.title = "Combined letters indicate an angled image plane, with the main direction first.";
    legend.hidden = true;
    view.append(selectors, stage, controls, note, legend);
    root.replaceChildren(view);

    let studyIndex = 0;
    let seriesIndex = 0;
    let sliceIndex = 0;
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let pointer = null;
    let requestId = 0;
    let currentLoader = null;
    let wheelSum = 0;
    let lastWheel = 0;
    let destroyed = false;
    const currentSeries = () => studies[studyIndex].series[seriesIndex];

    function option(title, value) {
      const item = element("option", "", title);
      item.value = String(value);
      return item;
    }

    studies.forEach((study, index) => studySelect.append(option(study.date ? `${study.title} · ${study.date}` : study.title, index)));

    function transform() {
      const maxX = stage.clientWidth * (zoom - 1) / 2;
      const maxY = stage.clientHeight * (zoom - 1) / 2;
      panX = Math.max(-maxX, Math.min(maxX, panX));
      panY = Math.max(-maxY, Math.min(maxY, panY));
      scanImage.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
      stage.classList.toggle("is-zoomed", zoom > 1);
      zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
      zoomOut.disabled = zoom <= 1;
      zoomIn.disabled = zoom >= 4;
      reset.disabled = zoom === 1 && panX === 0 && panY === 0;
    }

    function resetView() { zoom = 1; panX = panY = 0; transform(); }

    function showOrientation(edges) {
      const meanings = { L: "Left", R: "Right", A: "Anterior", P: "Posterior", H: "Head", F: "Feet" };
      for (const [edge, label] of Object.entries(orientationLabels)) {
        label.hidden = !edges;
        label.textContent = edges?.[edge] || "";
        label.title = edges ? `${edge}: ${[...edges[edge]].map((letter) => meanings[letter]).join(" / ")}` : "";
      }
      if (edges) scanImage.setAttribute("aria-description", Object.entries(edges).map(([edge, label]) => `${edge}: ${[...label].map((letter) => meanings[letter]).join(" / ")}`).join("; "));
      else scanImage.removeAttribute("aria-description");
    }

    function showSlice(index) {
      const series = currentSeries();
      sliceIndex = Math.max(0, Math.min(series.frames.length - 1, index));
      counter.textContent = `Slice ${sliceIndex + 1} / ${series.frames.length}`;
      slider.max = String(series.frames.length);
      slider.value = String(sliceIndex + 1);
      slider.setAttribute("aria-valuetext", `${sliceIndex + 1} of ${series.frames.length}`);
      slider.disabled = series.frames.length === 1;
      previous.disabled = sliceIndex === 0;
      next.disabled = sliceIndex === series.frames.length - 1;
      announcement.textContent = `${series.title}, slice ${sliceIndex + 1} of ${series.frames.length}`;
      const expected = ++requestId;
      const frame = series.frames[sliceIndex];
      const src = frame.src;
      scanImage.hidden = true;
      showOrientation(null);
      legend.hidden = !frame.orientation;
      message.hidden = false;
      message.textContent = "Loading image…";
      if (currentLoader) { currentLoader.onload = null; currentLoader.onerror = null; }
      const loader = new Image();
      currentLoader = loader;
      loader.onload = () => {
        if (destroyed || expected !== requestId) return;
        scanImage.alt = `${studies[studyIndex].title}, ${series.title}, slice ${sliceIndex + 1} of ${series.frames.length}`;
        scanImage.src = src;
        scanImage.hidden = false;
        message.hidden = true;
        showOrientation(frame.orientation);
        transform();
        for (const neighbor of [sliceIndex - 1, sliceIndex + 1]) {
          if (series.frames[neighbor]) { const preload = new Image(); preload.src = series.frames[neighbor].src; }
        }
      };
      loader.onerror = () => {
        if (destroyed || expected !== requestId) return;
        scanImage.removeAttribute("src");
        scanImage.hidden = true;
        legend.hidden = true;
        message.hidden = false;
        message.textContent = "This image could not be loaded.";
      };
      loader.src = src;
    }

    function selectSeries(index, initialSlice = null) {
      seriesIndex = index;
      seriesSelect.value = String(index);
      const series = currentSeries();
      const initial = Number.isInteger(initialSlice) ? initialSlice - 1 : series.startIndex === null ? Math.floor((series.frames.length - 1) / 2) : series.startIndex;
      resetView();
      showSlice(initial);
    }

    function selectStudy(index, initialSelection = null) {
      studyIndex = index;
      studySelect.value = String(index);
      seriesSelect.replaceChildren(...studies[index].series.map((series, i) => option(series.title, i)));
      const selectedSeries = initialSelection ? studies[index].series.findIndex((series) => series.id === initialSelection.series) : 0;
      selectSeries(selectedSeries < 0 ? 0 : selectedSeries, selectedSeries < 0 ? null : initialSelection?.slice);
    }

    listen(studySelect, "change", () => selectStudy(Number(studySelect.value)));
    listen(seriesSelect, "change", () => selectSeries(Number(seriesSelect.value)));
    listen(previous, "click", () => showSlice(sliceIndex - 1));
    listen(next, "click", () => showSlice(sliceIndex + 1));
    listen(slider, "input", () => showSlice(Number(slider.value) - 1));
    listen(stage, "keydown", (event) => {
      const offsets = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1, PageDown: 10, PageUp: -10 };
      if (event.key in offsets) { event.preventDefault(); showSlice(sliceIndex + offsets[event.key]); }
      else if (event.key === "Home") { event.preventDefault(); showSlice(0); }
      else if (event.key === "End") { event.preventDefault(); showSlice(currentSeries().frames.length - 1); }
    });
    listen(stage, "wheel", (event) => {
      if (currentSeries().frames.length < 2 || event.ctrlKey || event.metaKey) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastWheel > 180) wheelSum = 0;
      lastWheel = now;
      wheelSum += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1);
      if (Math.abs(wheelSum) >= 28) { showSlice(sliceIndex + Math.sign(wheelSum)); wheelSum = 0; }
    }, { passive: false });
    listen(zoomIn, "click", () => { zoom = Math.min(4, zoom + .25); transform(); });
    listen(zoomOut, "click", () => { zoom = Math.max(1, zoom - .25); transform(); });
    listen(reset, "click", resetView);
    listen(stage, "pointerdown", (event) => {
      stage.focus({ preventScroll: true });
      if (zoom <= 1 || event.button !== 0) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, panX, panY };
      stage.setPointerCapture(event.pointerId);
      stage.classList.add("is-dragging");
    });
    listen(stage, "pointermove", (event) => {
      if (!pointer || pointer.id !== event.pointerId) return;
      panX = pointer.panX + event.clientX - pointer.x;
      panY = pointer.panY + event.clientY - pointer.y;
      transform();
    });
    const endDrag = () => { pointer = null; stage.classList.remove("is-dragging"); };
    listen(stage, "pointerup", endDrag);
    listen(stage, "pointercancel", endDrag);
    listen(stage, "lostpointercapture", endDrag);
    listen(window, "resize", transform);
    const selectedStudy = studies.findIndex((study) => study.id === options.initial?.study);
    selectStudy(selectedStudy < 0 ? 0 : selectedStudy, selectedStudy < 0 ? null : options.initial);

    const api = {
      getSelection() {
        return { study: studies[studyIndex].id, series: currentSeries().id, slice: sliceIndex + 1 };
      },
      destroy() {
        destroyed = true;
        requestId++;
        if (currentLoader) { currentLoader.onload = null; currentLoader.onerror = null; }
        abort.abort();
        root.replaceChildren();
        delete root.healthDBScanViewer;
      }
    };
    root.healthDBScanViewer = api;
    return api;
  }

  window.HealthDBScanViewer = Object.freeze({ mount });
})();
