"use strict";

// Values are resolved from the same snapshot as Labs, never copied into this index.
async function loadInfectiousDisease(labs) {
  const root = $("infectious-disease");
  try {
    const response = await fetch(assetUrl("data/infectious-disease.json"));
    if (!response.ok) throw new Error("Appointment review unavailable");
    const data = await response.json();
    if (data.labSnapshot !== labs.exportedAt) throw new Error("Appointment review needs a snapshot refresh");
    const catalog = new Map(labs.markers.map((marker) => [marker.key, marker]));
    const groups = data.groups.map((group) => ({ ...group, rows: group.rows.map((row) => {
      const marker = catalog.get(row.key);
      const matches = marker?.results.filter((r) => r.date === row.date && r.source === row.source);
      if (matches?.length !== 1) throw new Error("A selected result needs review");
      return { ...row, marker, result: matches[0] };
    }) }));
    const filters = [["all", "All findings"], ["pain", "Soft-tissue pain"], ["throat", "Throat phlegm"], ["urine", "Nocturia"], ["gut", "Gut"], ["bone", "Low bone density"], ["other", "Other symptoms"]];
    let activeFilter = "all";
    let allOpen = false;

    const referenceLinks = (keys = []) => {
      const wrap = make("span", undefined, "id-references");
      keys.forEach((key) => {
        const source = data.sources[key];
        const link = make("a", source.label);
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        wrap.append(link);
      });
      return wrap;
    };
    const paragraph = (text, refs) => {
      const p = make("p", text);
      if (refs?.length) p.append(" ", referenceLinks(refs));
      return p;
    };
    const storedRange = (row) => {
      if (row.reference) return row.reference;
      const {low, high} = row.result;
      if (numeric(low) && numeric(high)) return `Recorded interval ${formatValue(low)}–${formatValue(high)}`;
      if (numeric(high)) return `Recorded upper bound ${formatValue(high)}`;
      if (numeric(low)) return `Recorded lower bound ${formatValue(low)}`;
      return "No interval recorded";
    };
    const resultUnit = (unit) => ["Qualitative", "Text", "Description", "Status", "Result", "PCR"].includes(unit) ? "" : unit;
    const resultRow = (row) => {
      const tr = make("tr");
      const name = make("th");
      name.scope = "row";
      const link = make("a", row.marker.name);
      link.href = `?test=${encodeURIComponent(row.key)}#labs`;
      link.title = `Open full history: ${row.marker.name}`;
      link.addEventListener("click", (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        selectMarker(row.marker);
        const url = new URL(window.location.href);
        url.hash = "labs";
        history.replaceState(null, "", url);
        $("labs").scrollIntoView({ behavior: "smooth", block: "start" });
      });
      name.append(link);
      if (row.specimen) name.append(make("small", row.specimen, "id-specimen"));
      const value = make("td");
      value.append(make("strong", formatValue(row.result.value)), make("span", resultUnit(row.marker.unit), "id-unit"), make("small", storedRange(row), "id-range"));
      const date = make("td");
      date.append(make("time", formatDate(row.date)), make("small", formatSource(row.source), "id-source"), make("small", row.provenance, "id-provenance"));
      date.querySelector("time").dateTime = row.date;
      const note = make("td", row.note);
      if (row.citations?.length) note.append(" ", referenceLinks(row.citations));
      tr.append(name, value, date, note);
      return tr;
    };

    $("id-review-date").textContent = `Reviewed ${formatDate(data.reviewedAt)} · Labs through ${formatDate(labs.lastDate)}`;
    $("id-intro").textContent = data.intro;
    $("id-scope").textContent = data.scope;
    $("id-summary-stats").textContent = `${data.resultCount} selected results · ${data.markerCount} tests · ${data.octoberResultCount}/32 October results`;
    data.highlights.forEach((highlight) => {
      const item = make("div", undefined, "id-highlight");
      item.append(make("h3", highlight.title), make("p", highlight.text));
      $("id-highlights").append(item);
    });
    data.symptoms.forEach((symptom) => {
      const card = make("article", undefined, "id-symptom");
      card.append(make("p", symptom.label, "id-label"), make("h3", symptom.title), make("p", symptom.text));
      const question = make("div", undefined, "id-card-question");
      question.append(make("strong", "Discuss"), paragraph(symptom.question, symptom.refs));
      const button = make("button", "View relevant results →", "id-text-button");
      button.type = "button";
      button.setAttribute("aria-label", `View results relevant to ${symptom.title.toLowerCase()}`);
      button.addEventListener("click", () => {
        activeFilter = symptom.id;
        allOpen = true;
        $("id-search").value = "";
        updateFilters();
        renderResults();
        $("id-results").scrollIntoView({ behavior: "smooth", block: "start" });
      });
      card.append(question, button);
      $("id-symptoms").append(card);
    });
    data.context.forEach((item) => {
      const article = make("article", undefined, "id-context-item");
      article.append(make("h4", item.title), make("p", item.source, "id-label"), paragraph(item.text, item.refs));
      if (item.link) {
        const link = make("a", item.linkText);
        link.href = item.link;
        article.append(link);
      }
      $("id-context-content").append(article);
    });
    data.questions.forEach((item) => {
      const li = make("li");
      li.append(make("strong", item.title), paragraph(item.text, item.refs));
      $("id-questions-list").append(li);
    });
    data.notes.forEach((text) => $("id-notes-list").append(make("li", text)));
    const buttons = filters.map(([id, label]) => {
      const button = make("button", label, "id-filter");
      button.type = "button";
      button.addEventListener("click", () => { activeFilter = id; allOpen = id !== "all"; updateFilters(); renderResults(); });
      $("id-filters").append(button);
      return {id, button};
    });
    function updateFilters() {
      buttons.forEach(({id, button}) => button.setAttribute("aria-pressed", String(id === activeFilter)));
    }
    function renderResults() {
      const search = $("id-search").value.trim().toLocaleLowerCase();
      let total = 0;
      $("id-result-groups").replaceChildren();
      groups.forEach((group) => {
        const rows = group.rows.filter((row) => (activeFilter === "all" || row.tags.includes(activeFilter)) &&
          `${row.marker.name} ${row.specimen || ""} ${row.note} ${row.result.value} ${row.date} ${formatDate(row.date)} ${group.title}`.toLocaleLowerCase().includes(search));
        if (!rows.length) return;
        total += rows.length;
        const details = make("details", undefined, "id-result-group");
        details.open = allOpen;
        const summary = make("summary");
        summary.append(make("span", group.title), make("span", `${rows.length} results`, "id-group-count"));
        const content = make("div", undefined, "id-group-body");
        content.append(make("p", group.description, "id-group-description"));
        const scroll = make("div", undefined, "id-table-scroll");
        const table = make("table", undefined, "id-table");
        table.append(make("caption", group.title, "sr-only"));
        const head = make("thead");
        const tr = make("tr");
        ["Test · full history", "Recorded result", "Date & source", "Relevance & limits"].forEach((label) => {
          const th = make("th", label); th.scope = "col"; tr.append(th);
        });
        head.append(tr);
        const body = make("tbody");
        rows.forEach((row) => body.append(resultRow(row)));
        table.append(head, body); scroll.append(table); content.append(scroll); details.append(summary, content);
        $("id-result-groups").append(details);
      });
      $("id-result-count").textContent = `${total} of ${data.resultCount} selected results`;
      $("id-empty").hidden = total !== 0;
      $("id-expand").textContent = allOpen ? "Collapse groups" : "Expand groups";
    }
    $("id-search").addEventListener("input", () => { allOpen = true; renderResults(); });
    $("id-expand").addEventListener("click", () => { allOpen = !allOpen; renderResults(); });
    $("id-clear").addEventListener("click", () => { activeFilter = "all"; $("id-search").value = ""; allOpen = false; updateFilters(); renderResults(); });
    $("share-id-review").addEventListener("click", () => copyLink("infectious-disease"));

    // Printing always includes every selected result, even after filtering.
    let printState = null;
    function preparePrint() {
      if (printState) return;
      printState = {activeFilter, allOpen, search: $("id-search").value,
        open: [...root.querySelectorAll("details[id]")].map((el) => [el.id, el.open])};
      activeFilter = "all"; allOpen = true; $("id-search").value = "";
      updateFilters(); renderResults();
      root.querySelectorAll("details").forEach((el) => { el.open = true; });
      document.body.classList.add("print-id-review");
    }
    function finishPrint() {
      if (!printState) return;
      activeFilter = printState.activeFilter; allOpen = printState.allOpen; $("id-search").value = printState.search;
      printState.open.forEach(([id, open]) => { $(id).open = open; });
      printState = null;
      document.body.classList.remove("print-id-review");
      updateFilters(); renderResults();
    }
    $("print-id-review").addEventListener("click", () => {
      preparePrint();
      try { window.print(); } finally { finishPrint(); }
    });
    window.addEventListener("afterprint", finishPrint);
    updateFilters(); renderResults();
    $("id-loading").hidden = true;
    $("id-content").hidden = false;
  } catch (error) {
    console.error(error);
    $("id-loading").textContent = "The appointment review could not load. Refresh to try again; the full lab history is available below.";
    $("id-loading").setAttribute("role", "alert");
  }
}
