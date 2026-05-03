/* ============================================
   INSPECTION FORM LOGIC — v3
   ============================================
   Architecture:
   - One form, no mode toggle
   - Universal `issues[]` array — quick-add chips, section "Add Issue" buttons,
     and the custom button all create issue cards
   - Status drives routing (informational/repaired/estimate)
   - Editable catalog persisted to localStorage (shared key with walkthrough)
   - No scroll-to-bottom: confirmation toast slides in instead
   ============================================ */

const FORM_KEY = "inspection_v3";
const INSP_CATALOG_KEY = "bwc_inspection_catalog";

// ===== Default inspection catalog =====
// `contexts` lists which sections show this chip:
//   "life-safety", "water", "water-heater", "all" (always shown in the full catalog)
const DEFAULT_INSP_CATALOG = [
  { id: "smoke-alarm",       name: "Smoke Alarm",        description: "Replaced smoke alarm",                        parts: 80,  labor: 0,   contexts: ["life-safety", "all"] },
  { id: "combo-alarm",       name: "Combo Alarm",        description: "Replaced combo alarm (smoke/CO)",             parts: 80,  labor: 0,   contexts: ["life-safety", "all"] },
  { id: "recaulk-bath-sink", name: "Recaulk Bath Sink",  description: "Recaulked bath sink",                         parts: 25,  labor: 100, contexts: ["water", "all"] },
  { id: "recaulk-kit-sink",  name: "Recaulk Kitchen Sink", description: "Recaulked kitchen sink",                    parts: 25,  labor: 125, contexts: ["water", "all"] },
  { id: "recaulk-tub",       name: "Recaulk Tub/Shower", description: "Recaulked tub/shower surround",               parts: 35,  labor: 140, contexts: ["water", "all"] },
  { id: "angle-stops",       name: "Replace Angle Stops", description: "Replaced angle stops & supply lines",        parts: 35,  labor: 145, contexts: ["water", "all"] },
  { id: "p-trap",            name: "Replace P-Trap",     description: "Replaced P-trap",                             parts: 25,  labor: 90,  contexts: ["water", "all"] },
  { id: "toilet-flapper",    name: "Toilet Flapper",     description: "Replaced toilet flapper",                     parts: 15,  labor: 60,  contexts: ["water", "all"] },
  { id: "faucet-cartridge",  name: "Faucet Cartridge",   description: "Replaced faucet cartridge",                   parts: 25,  labor: 85,  contexts: ["water", "all"] },
  { id: "drain-snake",       name: "Drain Snaking",      description: "Snaked drain",                                parts: 0,   labor: 125, contexts: ["all"] },
  { id: "seismic-strapping", name: "Seismic Strapping",  description: "Installed double seismic strapping",          parts: 30,  labor: 95,  contexts: ["water-heater", "all"] },
];

// ===== State =====
let catalog = [];
let overviewPhotos = [];   // [{ id, label, photo }]
let wetAreas = [];         // [{ id, num, label, status, notes, photos }]
let waterHeaterPhotos = [];
let hazards = [];          // [{ id, num, category, description, severity, photos }]
let issues = [];           // [{ id, num, location, description, status, partsCost, laborCost, photos, sourceCatalogId }]

// Counters
let nextOverviewNum = 1;
let nextWetAreaNum = 1;
let nextHazardNum = 1;
let nextIssueNum = 1;

// Constants
const OVERVIEW_LABELS = [
  "Front / Exterior", "Living Room", "Kitchen", "Bedroom", "Master Bedroom",
  "Bathroom", "Master Bathroom", "Hallway", "Yard / Backyard", "Front Yard",
  "Garage", "Laundry", "Other",
];

const HAZARD_CATEGORIES = [
  "Overgrown vegetation / trees",
  "Loose weather head / electrical",
  "Damaged fencing or gates",
  "Trip hazard (walkway, stairs)",
  "Drainage issue",
  "Pest evidence",
  "Roof issue (visible from ground)",
  "Yard / landscape condition",
  "Other",
];

// ============================================
// INIT
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("inspectionDate").value = BWC.todayISO();
  document.getElementById("reportIdDisplay").textContent = BWC.peekId("INS");

  loadCatalog();

  const draft = BWC.loadDraft(FORM_KEY);
  if (draft) restoreDraft(draft);

  wireOverviewPhotos();
  wireWetAreas();
  wireWaterHeater();
  wireHazards();
  wireIssues();
  wireSectionAddIssueButtons();
  wireCatalogManager();
  wireActions();
  wireLightbox();

  // Render quick-add chips into every chip container
  renderAllChipContainers();

  // Seed wet areas only if first time (empty + no draft)
  if (wetAreas.length === 0) {
    addWetArea({ label: "Kitchen" });
    addWetArea({ label: "Bathroom" });
  }

  document.getElementById("inspectionForm").addEventListener("input", autosaveAndUpdate);
  document.getElementById("inspectionForm").addEventListener("change", autosaveAndUpdate);

  updateAutoSections();
});

function autosaveAndUpdate() {
  autosave();
  updateAutoSections();
}

// ============================================
// CATALOG (load/save/edit)
// ============================================
function loadCatalog() {
  try {
    const saved = localStorage.getItem(INSP_CATALOG_KEY);
    catalog = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_INSP_CATALOG));
  } catch (e) {
    catalog = JSON.parse(JSON.stringify(DEFAULT_INSP_CATALOG));
  }
}

function saveCatalog() {
  localStorage.setItem(INSP_CATALOG_KEY, JSON.stringify(catalog));
}

// ============================================
// QUICK-ADD CHIPS
// ============================================
function renderAllChipContainers() {
  document.querySelectorAll('[data-chips-context]').forEach((container) => {
    const context = container.dataset.chipsContext;
    renderChipsForContext(container, context);
  });
}

function renderChipsForContext(container, context) {
  container.innerHTML = "";

  catalog.forEach((item) => {
    if (!item.contexts.includes(context)) return;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "quick-add-chip";
    const total = (Number(item.parts) || 0) + (Number(item.labor) || 0);
    chip.innerHTML = `
      <span class="qa-label">${esc(item.name)}</span>
      <span class="qa-price">${BWC.money(total)}</span>
    `;
    chip.addEventListener("click", () => addIssueFromCatalog(item, container));
    container.appendChild(chip);
  });
}

// ============================================
// ISSUES (universal — replaces "findings")
// ============================================
function wireIssues() {
  document.getElementById("addIssueBtn").addEventListener("click", () => {
    const issue = createBlankIssue("");
    issues.push(issue);
    renderIssue(issue);
    autosaveAndUpdate();
    BWC.toast("Issue added");
    flashIssueCard(issue.id);
  });
}

function wireSectionAddIssueButtons() {
  document.querySelectorAll('[data-add-issue-from]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const location = btn.dataset.addIssueFrom;
      const issue = createBlankIssue(location);
      issues.push(issue);
      renderIssue(issue);
      autosaveAndUpdate();
      BWC.toast(`Issue added — ${location}`);
      flashIssueCard(issue.id);
    });
  });
}

function createBlankIssue(location) {
  return {
    id: crypto.randomUUID(),
    num: nextIssueNum++,
    location: location || "",
    description: "",
    status: "informational",
    partsCost: "",
    laborCost: "",
    photos: [],
    sourceCatalogId: null,
  };
}

function addIssueFromCatalog(catalogItem, originContainer) {
  const issue = {
    id: crypto.randomUUID(),
    num: nextIssueNum++,
    location: locationFromContext(originContainer),
    description: catalogItem.description,
    status: "repaired", // catalog items default to repaired-on-site
    partsCost: String(catalogItem.parts || 0),
    laborCost: String(catalogItem.labor || 0),
    photos: [],
    sourceCatalogId: catalogItem.id,
  };
  issues.push(issue);
  renderIssue(issue);
  autosaveAndUpdate();
  BWC.toast(`Added: ${catalogItem.name}`);
  flashIssueCard(issue.id);
}

function locationFromContext(container) {
  if (!container) return "";
  const ctx = container.dataset.chipsContext;
  return {
    "life-safety": "Life-Safety",
    "water": "",
    "water-heater": "Water Heater",
    "all": "",
  }[ctx] || "";
}

function flashIssueCard(issueId) {
  setTimeout(() => {
    const card = document.querySelector(`[data-issue-id="${issueId}"]`);
    if (!card) return;
    card.classList.add("flash-new");
    setTimeout(() => card.classList.remove("flash-new"), 1400);
  }, 60);
}

function renderIssue(f) {
  const list = document.getElementById("issuesList");
  const card = document.createElement("div");
  card.className = `item-card ${statusClass(f.status)}`;
  card.dataset.issueId = f.id;
  card.innerHTML = `
    <div class="item-num">No. ${String(f.num).padStart(2, "0")}</div>
    <div class="field-row">
      <div class="field">
        <label class="label">Location</label>
        <input type="text" class="f-location" value="${esc(f.location)}" placeholder="Kitchen, Bath, Bedroom…" />
      </div>
      <div class="field">
        <label class="label">Status</label>
        <div class="status-pills">
          <label class="status-pill ${f.status === "informational" ? "active-info" : ""}">
            <input type="radio" name="status-${f.id}" value="informational" ${f.status === "informational" ? "checked" : ""} />
            Info
          </label>
          <label class="status-pill ${f.status === "repaired" ? "active-repair" : ""}">
            <input type="radio" name="status-${f.id}" value="repaired" ${f.status === "repaired" ? "checked" : ""} />
            Repaired
          </label>
          <label class="status-pill ${f.status === "estimate" ? "active-estimate" : ""}">
            <input type="radio" name="status-${f.id}" value="estimate" ${f.status === "estimate" ? "checked" : ""} />
            Needs Estimate
          </label>
        </div>
      </div>
    </div>
    <div class="field">
      <label class="label">Description</label>
      <textarea class="f-description" placeholder="What did you find or fix?">${esc(f.description)}</textarea>
    </div>
    <div class="cost-row ${f.status === "repaired" || f.status === "estimate" ? "" : "hidden"}">
      <div class="field" style="margin: 0">
        <label class="label">Parts $</label>
        <input type="number" step="0.01" min="0" class="f-parts" value="${f.partsCost}" placeholder="0.00" />
      </div>
      <div class="field" style="margin: 0">
        <label class="label">Labor $</label>
        <input type="number" step="0.01" min="0" class="f-labor" value="${f.laborCost}" placeholder="0.00" />
      </div>
      <div class="field" style="margin: 0">
        <label class="label">Line Total</label>
        <input type="text" class="f-total" readonly value="${BWC.money((Number(f.partsCost) || 0) + (Number(f.laborCost) || 0))}" />
      </div>
    </div>
    <div class="photo-row">
      <div class="photos-container" style="display: flex; gap: 8px; flex-wrap: wrap;"></div>
      <label class="add-photo">
        +
        <input type="file" accept="image/*" capture="environment" multiple style="display: none" class="f-photo-input" />
      </label>
    </div>
    <div class="item-actions">
      <button type="button" class="remove-item">Remove</button>
    </div>
  `;
  list.appendChild(card);
  wireIssueCard(card, f);
  renderIssuePhotos(card, f);
}

function statusClass(s) {
  if (s === "repaired") return "repaired";
  if (s === "estimate") return "estimate-needed";
  return "informational";
}

function wireIssueCard(card, f) {
  card.querySelectorAll(`input[name="status-${f.id}"]`).forEach((r) => {
    r.addEventListener("change", (e) => {
      f.status = e.target.value;
      card.classList.remove("repaired", "estimate-needed", "informational");
      card.classList.add(statusClass(f.status));
      card.querySelectorAll(".status-pill").forEach((p) => {
        p.classList.remove("active-info", "active-repair", "active-estimate");
      });
      const activePill = e.target.closest(".status-pill");
      if (f.status === "informational") activePill.classList.add("active-info");
      if (f.status === "repaired") activePill.classList.add("active-repair");
      if (f.status === "estimate") activePill.classList.add("active-estimate");
      const costRow = card.querySelector(".cost-row");
      if (f.status === "repaired" || f.status === "estimate") {
        costRow.classList.remove("hidden");
      } else {
        costRow.classList.add("hidden");
      }
      autosaveAndUpdate();
    });
  });

  card.querySelector(".f-location").addEventListener("input", (e) => {
    f.location = e.target.value;
    autosave();
  });
  card.querySelector(".f-description").addEventListener("input", (e) => {
    f.description = e.target.value;
    autosave();
  });

  const partsInput = card.querySelector(".f-parts");
  const laborInput = card.querySelector(".f-labor");
  const totalInput = card.querySelector(".f-total");

  function updateLineTotal() {
    const t = (Number(f.partsCost) || 0) + (Number(f.laborCost) || 0);
    totalInput.value = BWC.money(t);
    updateAutoSections();
  }

  partsInput.addEventListener("input", (e) => {
    f.partsCost = e.target.value;
    updateLineTotal();
    autosave();
  });
  laborInput.addEventListener("input", (e) => {
    f.laborCost = e.target.value;
    updateLineTotal();
    autosave();
  });

  const photoInput = card.querySelector(".f-photo-input");
  photoInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      try {
        const photo = await BWC.processPhoto(file);
        f.photos.push(photo);
      } catch (err) {
        console.warn("Photo error:", err);
      }
    }
    renderIssuePhotos(card, f);
    autosave();
    photoInput.value = "";
  });

  card.querySelector(".remove-item").addEventListener("click", () => {
    if (confirm("Remove this issue?")) {
      issues = issues.filter((x) => x.id !== f.id);
      card.remove();
      autosaveAndUpdate();
    }
  });
}

function renderIssuePhotos(card, f) {
  const container = card.querySelector(".photos-container");
  container.innerHTML = "";
  f.photos.forEach((p, idx) => {
    const thumb = document.createElement("div");
    thumb.className = "photo-thumb";
    thumb.innerHTML = `<img src="${p.dataUrl}" alt="photo" /><button type="button" class="remove">×</button>`;
    thumb.querySelector("img").addEventListener("click", () => openLightbox(p.dataUrl));
    thumb.querySelector(".remove").addEventListener("click", (e) => {
      e.stopPropagation();
      f.photos.splice(idx, 1);
      renderIssuePhotos(card, f);
      autosave();
    });
    container.appendChild(thumb);
  });
}

// ============================================
// OVERVIEW PHOTOS
// ============================================
function wireOverviewPhotos() {
  document.getElementById("addOverviewBtn").addEventListener("click", () => {
    addOverviewPhoto();
  });
}

function addOverviewPhoto(seed = null) {
  const item = {
    id: seed?.id || crypto.randomUUID(),
    label: seed?.label || "Front / Exterior",
    photo: seed?.photo || null,
  };
  overviewPhotos.push(item);
  renderOverviewPhoto(item);
  autosave();
}

function renderOverviewPhoto(item) {
  const list = document.getElementById("overviewPhotos");
  const row = document.createElement("div");
  row.className = "overview-photo-item";
  row.dataset.id = item.id;
  const optionsHTML = OVERVIEW_LABELS.map(
    (label) => `<option value="${esc(label)}" ${label === item.label ? "selected" : ""}>${esc(label)}</option>`
  ).join("");
  row.innerHTML = `
    <select class="label-select">${optionsHTML}</select>
    <div class="photo-cell"></div>
    <button type="button" class="overview-photo-remove" aria-label="remove">×</button>
  `;
  list.appendChild(row);

  row.querySelector(".label-select").addEventListener("change", (e) => {
    item.label = e.target.value;
    autosave();
  });

  renderOverviewPhotoCell(row, item);

  row.querySelector(".overview-photo-remove").addEventListener("click", () => {
    if (confirm("Remove this photo?")) {
      overviewPhotos = overviewPhotos.filter((p) => p.id !== item.id);
      row.remove();
      autosave();
    }
  });
}

function renderOverviewPhotoCell(row, item) {
  const cell = row.querySelector(".photo-cell");
  cell.innerHTML = "";
  if (item.photo) {
    const thumb = document.createElement("div");
    thumb.className = "overview-photo-thumb";
    thumb.innerHTML = `<img src="${item.photo.dataUrl}" alt="photo" />`;
    thumb.querySelector("img").addEventListener("click", () => openLightbox(item.photo.dataUrl));
    cell.appendChild(thumb);
  } else {
    const empty = document.createElement("label");
    empty.className = "overview-photo-empty";
    empty.innerHTML = `+
      <input type="file" accept="image/*" capture="environment" />`;
    empty.querySelector("input").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        item.photo = await BWC.processPhoto(file);
        renderOverviewPhotoCell(row, item);
        autosave();
      } catch (err) {
        console.warn("Photo error:", err);
      }
    });
    cell.appendChild(empty);
  }
}

// ============================================
// WET AREAS — simplified 1-line per area
// ============================================
function wireWetAreas() {
  document.getElementById("addWetAreaBtn").addEventListener("click", () => {
    addWetArea({});
  });
}

// IMPORTANT FIX from v2 bug: always build full default object,
// then merge seed properties on top
function addWetArea(seed) {
  seed = seed || {};
  const item = {
    id: seed.id || crypto.randomUUID(),
    num: seed.num || nextWetAreaNum,
    label: seed.label || `Wet Area ${nextWetAreaNum}`,
    status: seed.status || "good", // good | issue | repaired
    notes: seed.notes || "",
    photos: Array.isArray(seed.photos) ? seed.photos : [],
  };
  if (seed.num && seed.num >= nextWetAreaNum) nextWetAreaNum = seed.num + 1;
  else if (!seed.num) nextWetAreaNum++;

  wetAreas.push(item);
  renderWetArea(item);
  autosave();
}

function renderWetArea(item) {
  const list = document.getElementById("wetAreaList");
  const card = document.createElement("div");
  card.className = "sub-card wet-area-card";
  card.dataset.id = item.id;

  const sn = (s) => `wa-${item.id}-${s}`;

  card.innerHTML = `
    <div class="sub-card-header">
      <input type="text" class="wa-label-input" value="${esc(item.label)}" placeholder="Master Bath, Kitchen…" />
      <button type="button" class="sub-card-remove">Remove</button>
    </div>

    <div class="sub-field">
      <label class="label">Status</label>
      <div class="status-buttons">
        <input type="radio" name="${sn("status")}" id="${sn("good")}" value="good" ${item.status === "good" ? "checked" : ""} />
        <label for="${sn("good")}" class="status-ok">Good</label>
        <input type="radio" name="${sn("status")}" id="${sn("issue")}" value="issue" ${item.status === "issue" ? "checked" : ""} />
        <label for="${sn("issue")}" class="status-issue">Issue</label>
        <input type="radio" name="${sn("status")}" id="${sn("repaired")}" value="repaired" ${item.status === "repaired" ? "checked" : ""} />
        <label for="${sn("repaired")}" class="status-replaced">Repaired</label>
      </div>
    </div>

    <div class="sub-field">
      <label class="photo-button wa-photo-btn">
        <span class="icon">+</span>
        <span class="text">Add photo</span>
        <input type="file" accept="image/*" capture="environment" multiple class="wa-photo-input" />
      </label>
      <div class="photo-strip wa-photo-strip" style="margin-bottom: var(--s3);"></div>
      <textarea class="wa-notes" placeholder="Notes about this wet area…">${esc(item.notes)}</textarea>
    </div>
  `;

  list.appendChild(card);
  wireWetArea(card, item);
  renderWetAreaPhotos(card, item);
}

function wireWetArea(card, item) {
  card.querySelector(".wa-label-input").addEventListener("input", (e) => {
    item.label = e.target.value;
    autosave();
  });

  card.querySelectorAll('input[type="radio"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      item.status = e.target.value;
      autosave();
    });
  });

  card.querySelector(".wa-notes").addEventListener("input", (e) => {
    item.notes = e.target.value;
    autosave();
  });

  const photoInput = card.querySelector(".wa-photo-input");
  photoInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      try {
        const photo = await BWC.processPhoto(file);
        item.photos.push(photo); // safe — photos always initialized as array
      } catch (err) {
        console.warn("Photo error:", err);
      }
    }
    renderWetAreaPhotos(card, item);
    autosave();
    photoInput.value = "";
  });

  card.querySelector(".sub-card-remove").addEventListener("click", () => {
    if (confirm(`Remove "${item.label}"?`)) {
      wetAreas = wetAreas.filter((w) => w.id !== item.id);
      card.remove();
      autosave();
    }
  });
}

function renderWetAreaPhotos(card, item) {
  const strip = card.querySelector(".wa-photo-strip");
  const btn = card.querySelector(".wa-photo-btn");
  strip.innerHTML = "";
  item.photos.forEach((p, idx) => {
    const thumb = document.createElement("div");
    thumb.className = "photo-thumb";
    thumb.innerHTML = `<img src="${p.dataUrl}" alt="photo" /><button type="button" class="remove">×</button>`;
    thumb.querySelector("img").addEventListener("click", () => openLightbox(p.dataUrl));
    thumb.querySelector(".remove").addEventListener("click", (e) => {
      e.stopPropagation();
      item.photos.splice(idx, 1);
      renderWetAreaPhotos(card, item);
      autosave();
    });
    strip.appendChild(thumb);
  });
  btn.classList.toggle("has-photos", item.photos.length > 0);
  btn.querySelector(".text").textContent =
    item.photos.length > 0 ? `${item.photos.length} photo${item.photos.length === 1 ? "" : "s"}` : "Add photo";
}

// ============================================
// WATER HEATER
// ============================================
function wireWaterHeater() {
  document.querySelectorAll('input[name="whPresent"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      const detail = document.getElementById("waterHeaterDetail");
      detail.style.display = e.target.value === "yes" ? "block" : "none";
      autosave();
    });
  });

  const input = document.querySelector(".wh-photo-input");
  input.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      try {
        const photo = await BWC.processPhoto(file);
        waterHeaterPhotos.push(photo);
      } catch (err) {
        console.warn("Photo error:", err);
      }
    }
    renderWaterHeaterPhotos();
    autosave();
    input.value = "";
  });
}

function renderWaterHeaterPhotos() {
  const strip = document.getElementById("whPhotoStrip");
  const btn = document.getElementById("whPhotoBtn");
  strip.innerHTML = "";
  waterHeaterPhotos.forEach((p, idx) => {
    const thumb = document.createElement("div");
    thumb.className = "photo-thumb";
    thumb.innerHTML = `<img src="${p.dataUrl}" alt="photo" /><button type="button" class="remove">×</button>`;
    thumb.querySelector("img").addEventListener("click", () => openLightbox(p.dataUrl));
    thumb.querySelector(".remove").addEventListener("click", (e) => {
      e.stopPropagation();
      waterHeaterPhotos.splice(idx, 1);
      renderWaterHeaterPhotos();
      autosave();
    });
    strip.appendChild(thumb);
  });
  btn.classList.toggle("has-photos", waterHeaterPhotos.length > 0);
  btn.querySelector(".text").textContent =
    waterHeaterPhotos.length > 0 ? `${waterHeaterPhotos.length} photo${waterHeaterPhotos.length === 1 ? "" : "s"}` : "Add photo";
}

// ============================================
// HAZARDS
// ============================================
function wireHazards() {
  document.getElementById("addHazardBtn").addEventListener("click", () => {
    addHazard({});
  });
}

function addHazard(seed) {
  seed = seed || {};
  const item = {
    id: seed.id || crypto.randomUUID(),
    num: seed.num || nextHazardNum,
    category: seed.category || HAZARD_CATEGORIES[0],
    description: seed.description || "",
    severity: seed.severity || "address",
    photos: Array.isArray(seed.photos) ? seed.photos : [],
  };
  if (seed.num && seed.num >= nextHazardNum) nextHazardNum = seed.num + 1;
  else if (!seed.num) nextHazardNum++;
  hazards.push(item);
  renderHazard(item);
  autosave();
}

function renderHazard(item) {
  const list = document.getElementById("hazardList");
  const card = document.createElement("div");
  card.className = "sub-card";
  card.dataset.id = item.id;
  const sn = (s) => `hz-${item.id}-${s}`;
  const optionsHTML = HAZARD_CATEGORIES.map(
    (c) => `<option value="${esc(c)}" ${c === item.category ? "selected" : ""}>${esc(c)}</option>`
  ).join("");

  card.innerHTML = `
    <div class="sub-card-header">
      <span class="sub-card-title">No. ${String(item.num).padStart(2, "0")}</span>
      <button type="button" class="sub-card-remove">Remove</button>
    </div>

    <div class="sub-field">
      <label class="label">Category</label>
      <select class="hz-category">${optionsHTML}</select>
    </div>

    <div class="sub-field">
      <label class="label">Description</label>
      <textarea class="hz-description" placeholder="What did you observe?">${esc(item.description)}</textarea>
    </div>

    <div class="sub-field">
      <label class="label">Severity</label>
      <div class="status-buttons severity-buttons">
        <input type="radio" name="${sn("sev")}" id="${sn("sev-info")}" value="info" ${item.severity === "info" ? "checked" : ""} />
        <label for="${sn("sev-info")}" class="sev-info">Informational</label>
        <input type="radio" name="${sn("sev")}" id="${sn("sev-address")}" value="address" ${item.severity === "address" ? "checked" : ""} />
        <label for="${sn("sev-address")}" class="sev-address">Should Address</label>
        <input type="radio" name="${sn("sev")}" id="${sn("sev-urgent")}" value="urgent" ${item.severity === "urgent" ? "checked" : ""} />
        <label for="${sn("sev-urgent")}" class="sev-urgent">Urgent / Safety</label>
      </div>
    </div>

    <div class="sub-field">
      <label class="photo-button hz-photo-btn">
        <span class="icon">+</span>
        <span class="text">Add photo</span>
        <input type="file" accept="image/*" capture="environment" multiple class="hz-photo-input" />
      </label>
      <div class="photo-strip hz-photo-strip"></div>
    </div>
  `;
  list.appendChild(card);
  wireHazard(card, item);
  renderHazardPhotos(card, item);
}

function wireHazard(card, item) {
  card.querySelector(".hz-category").addEventListener("change", (e) => {
    item.category = e.target.value;
    autosave();
  });
  card.querySelector(".hz-description").addEventListener("input", (e) => {
    item.description = e.target.value;
    autosave();
  });
  card.querySelectorAll('input[type="radio"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      item.severity = e.target.value;
      autosave();
    });
  });

  const photoInput = card.querySelector(".hz-photo-input");
  photoInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      try {
        const photo = await BWC.processPhoto(file);
        item.photos.push(photo);
      } catch (err) {
        console.warn("Photo error:", err);
      }
    }
    renderHazardPhotos(card, item);
    autosave();
    photoInput.value = "";
  });

  card.querySelector(".sub-card-remove").addEventListener("click", () => {
    if (confirm("Remove this hazard?")) {
      hazards = hazards.filter((h) => h.id !== item.id);
      card.remove();
      autosave();
    }
  });
}

function renderHazardPhotos(card, item) {
  const strip = card.querySelector(".hz-photo-strip");
  const btn = card.querySelector(".hz-photo-btn");
  strip.innerHTML = "";
  item.photos.forEach((p, idx) => {
    const thumb = document.createElement("div");
    thumb.className = "photo-thumb";
    thumb.innerHTML = `<img src="${p.dataUrl}" alt="photo" /><button type="button" class="remove">×</button>`;
    thumb.querySelector("img").addEventListener("click", () => openLightbox(p.dataUrl));
    thumb.querySelector(".remove").addEventListener("click", (e) => {
      e.stopPropagation();
      item.photos.splice(idx, 1);
      renderHazardPhotos(card, item);
      autosave();
    });
    strip.appendChild(thumb);
  });
  btn.classList.toggle("has-photos", item.photos.length > 0);
  btn.querySelector(".text").textContent =
    item.photos.length > 0 ? `${item.photos.length} photo${item.photos.length === 1 ? "" : "s"}` : "Add photo";
}

// ============================================
// CATALOG MANAGER (modal — mirrors walkthrough)
// ============================================
function wireCatalogManager() {
  const panel = document.getElementById("catalogPanel");
  const openBtn = document.getElementById("manageCatalogBtn");
  const closeBtn = document.getElementById("closeCatalogBtn");
  const addBtn = document.getElementById("addCatalogItemBtn");

  openBtn.addEventListener("click", () => {
    renderCatalogEditor();
    panel.style.display = "block";
  });
  closeBtn.addEventListener("click", () => {
    panel.style.display = "none";
    renderAllChipContainers(); // refresh all chip rows after edits
  });
  addBtn.addEventListener("click", () => {
    catalog.push({
      id: `custom-${Date.now()}`,
      name: "New Item",
      description: "",
      parts: 0,
      labor: 0,
      contexts: ["all"],
    });
    saveCatalog();
    renderCatalogEditor();
  });
}

function renderCatalogEditor() {
  const el = document.getElementById("catalogEditor");
  el.innerHTML = "";

  catalog.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "catalog-edit-row";
    row.innerHTML = `
      <div class="field-row">
        <div class="field" style="flex: 2;">
          <label class="label">Name</label>
          <input type="text" data-idx="${idx}" data-field="name" value="${esc(item.name)}" />
        </div>
        <div class="field">
          <label class="label">Parts $</label>
          <input type="number" step="0.01" data-idx="${idx}" data-field="parts" value="${item.parts}" />
        </div>
        <div class="field">
          <label class="label">Labor $</label>
          <input type="number" step="0.01" data-idx="${idx}" data-field="labor" value="${item.labor}" />
        </div>
      </div>
      <div class="field">
        <label class="label">Description (autofills into the issue card)</label>
        <input type="text" data-idx="${idx}" data-field="description" value="${esc(item.description)}" />
      </div>
      <div class="field">
        <label class="label">Show in sections</label>
        <div class="catalog-context-toggles">
          ${["life-safety", "water", "water-heater", "all"].map((ctx) => `
            <label class="ctx-toggle">
              <input type="checkbox" data-idx="${idx}" data-context="${ctx}" ${item.contexts.includes(ctx) ? "checked" : ""} />
              <span>${ctxLabel(ctx)}</span>
            </label>
          `).join("")}
        </div>
        <p class="helper">Tip: "All" makes the chip appear in the full catalog above the Issues list.</p>
      </div>
      <button type="button" class="remove-item" data-remove="${idx}">Remove from catalog</button>
    `;
    el.appendChild(row);
  });

  // Wire field inputs
  el.querySelectorAll("input[data-field]").forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = +e.target.dataset.idx;
      const field = e.target.dataset.field;
      if (field === "parts" || field === "labor") {
        catalog[idx][field] = parseFloat(e.target.value) || 0;
      } else {
        catalog[idx][field] = e.target.value;
      }
      saveCatalog();
    });
  });

  // Wire context checkboxes
  el.querySelectorAll("input[data-context]").forEach((input) => {
    input.addEventListener("change", (e) => {
      const idx = +e.target.dataset.idx;
      const ctx = e.target.dataset.context;
      const item = catalog[idx];
      if (e.target.checked) {
        if (!item.contexts.includes(ctx)) item.contexts.push(ctx);
      } else {
        item.contexts = item.contexts.filter((c) => c !== ctx);
      }
      saveCatalog();
    });
  });

  // Wire remove buttons
  el.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = +e.target.dataset.remove;
      if (confirm(`Remove "${catalog[idx].name}" from catalog?`)) {
        catalog.splice(idx, 1);
        saveCatalog();
        renderCatalogEditor();
      }
    });
  });
}

function ctxLabel(ctx) {
  return {
    "life-safety": "Life-Safety",
    "water": "Water",
    "water-heater": "Water Heater",
    "all": "Full Catalog (always visible)",
  }[ctx] || ctx;
}

// ============================================
// AUTO SECTIONS (invoice + estimate counts)
// ============================================
function updateAutoSections() {
  const repaired = issues.filter((i) => i.status === "repaired");
  const needsEst = issues.filter((i) => i.status === "estimate");

  const invoiceSection = document.getElementById("invoiceSection");
  const estimateSection = document.getElementById("estimateSection");

  if (repaired.length === 0) {
    invoiceSection.style.display = "none";
  } else {
    invoiceSection.style.display = "block";
    let parts = 0, labor = 0;
    repaired.forEach((i) => {
      parts += Number(i.partsCost) || 0;
      labor += Number(i.laborCost) || 0;
    });
    document.getElementById("totalParts").textContent = BWC.money(parts);
    document.getElementById("totalLabor").textContent = BWC.money(labor);
    const grand = parts + labor;
    document.getElementById("totalGrand").textContent = BWC.money(grand);
    const warn = document.getElementById("thresholdWarning");
    if (grand > 500) warn.classList.add("show");
    else warn.classList.remove("show");
  }

  if (needsEst.length === 0) {
    estimateSection.style.display = "none";
  } else {
    estimateSection.style.display = "block";
    document.getElementById("estimateCount").textContent = needsEst.length;
  }
}

// ============================================
// AUTOSAVE / DRAFT
// ============================================
function autosave() {
  BWC.saveDraft(FORM_KEY, collectFormData());
}

function collectFormData() {
  const f = (id) => document.getElementById(id);
  const radioVal = (name) =>
    document.querySelector(`input[name="${name}"]:checked`)?.value || null;

  return {
    propertyAddress: f("propertyAddress").value,
    unitNumber: f("unitNumber").value,
    inspectionDate: f("inspectionDate").value,
    tenantPresent: radioVal("tenantPresent"),
    tenantName: f("tenantName").value,
    condition: radioVal("condition"),
    overviewPhotos,
    overviewNotes: f("overviewNotes").value,
    smokeWorking: f("smokeWorking").value,
    smokeTotal: f("smokeTotal").value,
    smokeReplaced: f("smokeReplaced").value,
    comboWorking: f("comboWorking").value,
    comboTotal: f("comboTotal").value,
    comboReplaced: f("comboReplaced").value,
    alarmsHardwired: radioVal("alarmsHardwired"),
    wetAreas,
    waterNotes: f("waterNotes").value,
    whPresent: radioVal("whPresent"),
    whLocation: f("whLocation").value,
    whType: f("whType").value,
    whStraps: radioVal("whStraps"),
    whCondition: radioVal("whCondition"),
    whTP: radioVal("whTP"),
    whLeaks: radioVal("whLeaks"),
    whNotes: f("whNotes").value,
    waterHeaterPhotos,
    hazards,
    issues,
    nextOverviewNum, nextWetAreaNum, nextHazardNum, nextIssueNum,
  };
}

function restoreDraft(d) {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el && v !== undefined && v !== null) el.value = v;
  };
  const setRadio = (name, val) => {
    if (!val) return;
    const r = document.querySelector(`input[name="${name}"][value="${val}"]`);
    if (r) r.checked = true;
  };

  set("propertyAddress", d.propertyAddress);
  set("unitNumber", d.unitNumber);
  set("inspectionDate", d.inspectionDate || BWC.todayISO());
  setRadio("tenantPresent", d.tenantPresent);
  set("tenantName", d.tenantName);
  setRadio("condition", d.condition);
  set("overviewNotes", d.overviewNotes);
  set("smokeWorking", d.smokeWorking);
  set("smokeTotal", d.smokeTotal);
  set("smokeReplaced", d.smokeReplaced);
  set("comboWorking", d.comboWorking);
  set("comboTotal", d.comboTotal);
  set("comboReplaced", d.comboReplaced);
  setRadio("alarmsHardwired", d.alarmsHardwired);
  set("waterNotes", d.waterNotes);
  setRadio("whPresent", d.whPresent);
  if (d.whPresent === "no") {
    document.getElementById("waterHeaterDetail").style.display = "none";
  }
  set("whLocation", d.whLocation);
  set("whType", d.whType);
  setRadio("whStraps", d.whStraps);
  setRadio("whCondition", d.whCondition);
  setRadio("whTP", d.whTP);
  setRadio("whLeaks", d.whLeaks);
  set("whNotes", d.whNotes);

  if (d.nextOverviewNum) nextOverviewNum = d.nextOverviewNum;
  if (d.nextWetAreaNum) nextWetAreaNum = d.nextWetAreaNum;
  if (d.nextHazardNum) nextHazardNum = d.nextHazardNum;
  if (d.nextIssueNum) nextIssueNum = d.nextIssueNum;

  if (Array.isArray(d.overviewPhotos)) d.overviewPhotos.forEach((p) => addOverviewPhoto(p));
  if (Array.isArray(d.wetAreas)) d.wetAreas.forEach((w) => addWetArea(w));
  if (Array.isArray(d.waterHeaterPhotos)) {
    waterHeaterPhotos = d.waterHeaterPhotos;
    renderWaterHeaterPhotos();
  }
  if (Array.isArray(d.hazards)) d.hazards.forEach((h) => addHazard(h));
  if (Array.isArray(d.issues)) d.issues.forEach((i) => {
    issues.push(i);
    if (i.num >= nextIssueNum) nextIssueNum = i.num + 1;
    renderIssue(i);
  });
}

// ============================================
// ACTIONS
// ============================================
function wireActions() {
  document.getElementById("generatePdfBtn").addEventListener("click", generatePdf);
  document.getElementById("exportJsonBtn").addEventListener("click", exportJson);
  document.getElementById("exportEstimateBtn").addEventListener("click", exportToWalkthrough);
  document.getElementById("clearBtn").addEventListener("click", clearForm);
}

function exportJson() {
  const data = collectFormData();
  // Strip photo dataUrls for size — keep counts
  const stripPhotos = (arr) =>
    Array.isArray(arr)
      ? arr.map((x) => ({ ...x, photoCount: (x.photos || []).length, photos: undefined }))
      : [];

  const exportData = {
    documentType: "inspection_report",
    documentId: BWC.peekId("INS"),
    generatedAt: new Date().toISOString(),
    property: {
      address: data.propertyAddress,
      unit: data.unitNumber,
      inspectionDate: data.inspectionDate,
      tenantPresent: data.tenantPresent,
      tenantName: data.tenantName,
    },
    overview: {
      condition: data.condition,
      notes: data.overviewNotes,
      photoCount: data.overviewPhotos.length,
    },
    lifesafety: {
      smoke: { working: data.smokeWorking, total: data.smokeTotal, replaced: data.smokeReplaced },
      combo: { working: data.comboWorking, total: data.comboTotal, replaced: data.comboReplaced },
      hardwired: data.alarmsHardwired,
    },
    waterHeater: data.whPresent === "yes" ? {
      location: data.whLocation,
      type: data.whType,
      straps: data.whStraps,
      condition: data.whCondition,
      tpDrain: data.whTP,
      leaks: data.whLeaks,
      notes: data.whNotes,
      photoCount: data.waterHeaterPhotos.length,
    } : null,
    wetAreas: stripPhotos(data.wetAreas),
    hazards: stripPhotos(data.hazards),
    issues: stripPhotos(data.issues),
    invoiceItems: data.issues.filter((i) => i.status === "repaired").map((i) => ({
      location: i.location,
      description: i.description,
      parts: Number(i.partsCost) || 0,
      labor: Number(i.laborCost) || 0,
      total: (Number(i.partsCost) || 0) + (Number(i.laborCost) || 0),
    })),
    estimateItems: data.issues.filter((i) => i.status === "estimate").map((i) => ({
      location: i.location,
      description: i.description,
      parts: Number(i.partsCost) || 0,
      labor: Number(i.laborCost) || 0,
    })),
  };
  const fname = `inspection_${(data.propertyAddress || "untitled").replace(/[^\w]+/g, "_")}_${data.inspectionDate}.json`;
  BWC.downloadJSON(fname, exportData);
  BWC.toast("JSON exported");
}

function exportToWalkthrough() {
  const needsEst = issues.filter((i) => i.status === "estimate");
  if (needsEst.length === 0) {
    alert("No issues marked 'Needs Estimate' to send.");
    return;
  }
  const handoff = {
    sourceInspectionId: BWC.peekId("INS"),
    propertyAddress: document.getElementById("propertyAddress").value,
    unitNumber: document.getElementById("unitNumber").value,
    items: needsEst.map((i) => ({
      location: i.location,
      description: i.description,
      partsCost: i.partsCost,
      laborCost: i.laborCost,
      photos: i.photos,
    })),
  };
  localStorage.setItem("bwc_walkthrough_handoff", JSON.stringify(handoff));
  BWC.toast("Items handed off");
  setTimeout(() => {
    if (confirm("Open Walkthrough form now?")) {
      window.location.href = "walkthrough.html?from=inspection";
    }
  }, 600);
}

function clearForm() {
  if (!confirm("Clear all form data? Draft will be deleted (catalog stays).")) return;
  BWC.clearDraft(FORM_KEY);
  location.reload();
}

// ============================================
// HELPERS
// ============================================
function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function wireLightbox() {
  const lb = document.getElementById("lightbox");
  lb.addEventListener("click", () => lb.classList.remove("show"));
}
function openLightbox(src) {
  const lb = document.getElementById("lightbox");
  document.getElementById("lightboxImg").src = src;
  lb.classList.add("show");
}

// ============================================
// PDF GENERATION
// ============================================
async function generatePdf() {
  const data = collectFormData();
  if (!data.propertyAddress) {
    alert("Property address is required.");
    document.getElementById("propertyAddress").focus();
    return;
  }
  BWC.toast("Generating report...");

  const reportId = BWC.nextId("INS");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const c = BWC.colors;
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 50;
  const contentW = pageW - margin * 2;

  const headerOpts = { docType: "Inspection Report", docId: reportId };
  let y = BWC.pdfHeader(doc, headerOpts);

  // PREPARED FOR / PROPERTY
  doc.setTextColor(...c.inkFaint);
  doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text("PREPARED FOR", margin, y, { charSpace: 1.2 });
  doc.text("PROPERTY", margin + contentW / 2, y, { charSpace: 1.2 });

  doc.setTextColor(...c.deepNavy);
  doc.setFontSize(11); doc.setFont("helvetica", "normal");
  doc.text("S&L Property Management", margin, y + 14);
  const propAddr = data.unitNumber ? `${data.propertyAddress}, ${data.unitNumber}` : data.propertyAddress;
  const addrLines = doc.splitTextToSize(propAddr, contentW / 2 - 10);
  doc.text(addrLines, margin + contentW / 2, y + 14);

  doc.setFontSize(9); doc.setTextColor(...c.inkSoft);
  doc.text("Property Management", margin, y + 28);
  y += 50 + (addrLines.length - 1) * 12;

  // I. Inspection meta
  y = BWC.pdfSectionTitle(doc, y, "I", "Inspection Information");
  BWC.pdfField(doc, margin, y, "Date", BWC.formatDate(data.inspectionDate));
  BWC.pdfField(doc, margin + contentW / 3, y, "Tenant",
    data.tenantPresent === "yes" ? `Yes — ${data.tenantName || "n/a"}` : "No");
  BWC.pdfField(doc, margin + (contentW * 2) / 3, y, "Inspector", BWC.contact.contact);
  y += 32;

  // II. Property Overview
  y = BWC.ensureRoom(doc, y, 40, headerOpts);
  y = BWC.pdfSectionTitle(doc, y, "II", "Property Overview");

  doc.setTextColor(...c.inkFaint);
  doc.setFontSize(7); doc.setFont("helvetica", "bold");
  doc.text("OVERALL CONDITION", margin, y, { charSpace: 1.2 });
  doc.setTextColor(...c.deepNavy);
  doc.setFontSize(13); doc.setFont("helvetica", "italic");
  const condLabel = (data.condition || "good").replace(/^./, (m) => m.toUpperCase());
  doc.text(condLabel, margin, y + 18);
  y += 32;

  if (data.overviewNotes && data.overviewNotes.trim()) {
    y = BWC.ensureRoom(doc, y, 40, headerOpts);
    doc.setTextColor(...c.inkFaint);
    doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text("WALKTHROUGH NOTES", margin, y, { charSpace: 1.2 });
    y += 12;
    doc.setTextColor(...c.deepNavy);
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(data.overviewNotes, contentW);
    doc.text(lines, margin, y);
    y += lines.length * 12 + 14;
  }

  // III. Life-Safety
  y = BWC.ensureRoom(doc, y, 80, headerOpts);
  y = BWC.pdfSectionTitle(doc, y, "III", "Life-Safety Systems");
  const lsRows = [
    {
      label: "Smoke Alarms",
      val: `${data.smokeWorking || 0} of ${data.smokeTotal || 0} working${data.smokeReplaced && data.smokeReplaced !== "0" ? ` · ${data.smokeReplaced} replaced` : ""}`,
    },
    {
      label: "Combo Alarms (Smoke/CO)",
      val: `${data.comboWorking || 0} of ${data.comboTotal || 0} working${data.comboReplaced && data.comboReplaced !== "0" ? ` · ${data.comboReplaced} replaced` : ""}`,
    },
    {
      label: "Hardwiring (LA Code)",
      val: data.alarmsHardwired === "yes" ? "All hardwired" :
           data.alarmsHardwired === "partial" ? "Partial" :
           data.alarmsHardwired === "no" ? "Battery only" : "Not noted",
    },
  ];
  y = drawChecksTable(doc, lsRows, y, margin, contentW, headerOpts);
  y += 10;

  // IV. Water Inspection
  if (data.wetAreas.length > 0) {
    y = BWC.ensureRoom(doc, y, 60, headerOpts);
    y = BWC.pdfSectionTitle(doc, y, "IV", "Water Inspection");

    for (const w of data.wetAreas) {
      y = BWC.ensureRoom(doc, y, 60, headerOpts);
      doc.setTextColor(...c.deepNavy);
      doc.setFont("helvetica", "italic"); doc.setFontSize(12);
      doc.text(w.label || "Wet Area", margin, y);

      const statusText = wetAreaStatusLabel(w.status);
      const statusColor = w.status === "issue" ? c.danger : w.status === "repaired" ? c.waveBlue : c.success;
      doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.setTextColor(...statusColor);
      doc.text(statusText.toUpperCase(), margin + contentW, y, { align: "right", charSpace: 1.4 });
      y += 14;

      // Notes
      if (w.notes && w.notes.trim()) {
        doc.setTextColor(...c.inkSoft);
        doc.setFontSize(9); doc.setFont("helvetica", "italic");
        const lines = doc.splitTextToSize(w.notes, contentW);
        doc.text(lines, margin, y);
        y += lines.length * 11 + 4;
      }

      // Photos (up to 3)
      const photos = (w.photos || []).slice(0, 3);
      if (photos.length > 0) {
        const boxW = 110, boxH = 70, gap = 6;
        y = BWC.ensureRoom(doc, y, boxH + 8, headerOpts);
        for (let i = 0; i < photos.length; i++) {
          await BWC.pdfPhoto(doc, photos[i].dataUrl, margin + i * (boxW + gap), y, boxW, boxH);
        }
        y += boxH + 8;
      }
      y += 6;
    }

    if (data.waterNotes && data.waterNotes.trim()) {
      y = BWC.ensureRoom(doc, y, 40, headerOpts);
      doc.setTextColor(...c.inkFaint);
      doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.text("OTHER WATER NOTES", margin, y, { charSpace: 1.2 });
      y += 12;
      doc.setTextColor(...c.deepNavy);
      doc.setFontSize(10); doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(data.waterNotes, contentW);
      doc.text(lines, margin, y);
      y += lines.length * 12 + 14;
    }
  }

  // V. Water Heater
  if (data.whPresent === "yes") {
    y = BWC.ensureRoom(doc, y, 100, headerOpts);
    y = BWC.pdfSectionTitle(doc, y, "V", "Water Heater");

    const rows = [
      { label: "Location", val: data.whLocation || "—" },
      { label: "Type", val: whTypeLabel(data.whType) },
      { label: "Seismic Strapping", val: strapLabel(data.whStraps) },
      { label: "Condition", val: whConditionLabel(data.whCondition) },
      { label: "T&P Drain Pipe", val: data.whTP === "ok" ? "Proper" : "Issue noted" },
      { label: "Leaks / Rust", val: data.whLeaks === "none" ? "None" : "Visible" },
    ];
    y = drawChecksTable(doc, rows, y, margin, contentW, headerOpts);

    if (data.whNotes && data.whNotes.trim()) {
      doc.setTextColor(...c.inkSoft);
      doc.setFontSize(9); doc.setFont("helvetica", "italic");
      const lines = doc.splitTextToSize(data.whNotes, contentW);
      doc.text(lines, margin, y);
      y += lines.length * 11 + 8;
    }

    // Water heater photos (up to 2)
    const whPhotos = (data.waterHeaterPhotos || []).slice(0, 2);
    if (whPhotos.length > 0) {
      const boxW = 130, boxH = 90, gap = 8;
      y = BWC.ensureRoom(doc, y, boxH + 8, headerOpts);
      for (let i = 0; i < whPhotos.length; i++) {
        await BWC.pdfPhoto(doc, whPhotos[i].dataUrl, margin + i * (boxW + gap), y, boxW, boxH);
      }
      y += boxH + 8;
    }
    y += 8;
  }

  // VI. Hazards
  if (data.hazards.length > 0) {
    y = BWC.ensureRoom(doc, y, 60, headerOpts);
    y = BWC.pdfSectionTitle(doc, y, "VI", "Hazards & Property Conditions");

    for (const h of data.hazards) {
      const sevColor = h.severity === "urgent" ? c.danger : h.severity === "address" ? c.waveBlue : c.inkSoft;
      const sevLabel = h.severity === "urgent" ? "URGENT" : h.severity === "address" ? "SHOULD ADDRESS" : "INFORMATIONAL";

      const photosToShow = (h.photos || []).slice(0, 2);
      const cardH = 50 + (h.description ? 24 : 0) + (photosToShow.length > 0 ? 70 : 0);
      y = BWC.ensureRoom(doc, y, cardH + 10, headerOpts);

      doc.setFillColor(...sevColor);
      doc.rect(margin, y, 3, cardH, "F");

      doc.setTextColor(...c.deepNavy);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10);
      doc.text(h.category, margin + 14, y + 12);

      doc.setFont("helvetica", "bold"); doc.setFontSize(7);
      doc.setTextColor(...sevColor);
      doc.text(sevLabel, margin + contentW - 4, y + 12, { align: "right", charSpace: 1.2 });

      let cy = y + 28;
      if (h.description) {
        doc.setTextColor(...c.ink);
        doc.setFont("helvetica", "normal"); doc.setFontSize(10);
        const lines = doc.splitTextToSize(h.description, contentW - 20);
        doc.text(lines, margin + 14, cy);
        cy += lines.length * 12 + 4;
      }

      if (photosToShow.length > 0) {
        const boxW = 100, boxH = 60, gap = 6;
        for (let i = 0; i < photosToShow.length; i++) {
          await BWC.pdfPhoto(doc, photosToShow[i].dataUrl, margin + 14 + i * (boxW + gap), cy, boxW, boxH);
        }
        cy += boxH + 4;
      }
      y = cy + 12;
    }
  }

  // VII. Issues & Repairs
  if (data.issues.length > 0) {
    y = BWC.ensureRoom(doc, y, 60, headerOpts);
    y = BWC.pdfSectionTitle(doc, y, "VII", "Issues & Repairs");

    for (const f of data.issues) {
      const photosToShow = (f.photos || []).slice(0, 4);
      const photoRows = Math.ceil(photosToShow.length / 4);
      const cardHeight = 50 + (f.description ? 30 : 0) + (photosToShow.length > 0 ? 90 * photoRows : 0);
      y = BWC.ensureRoom(doc, y, cardHeight + 20, headerOpts);

      const accentColor = f.status === "repaired" ? c.success : f.status === "estimate" ? c.waveBlue : c.rule;
      doc.setFillColor(...accentColor);
      doc.rect(margin, y, 3, cardHeight, "F");

      doc.setTextColor(...c.inkFaint);
      doc.setFont("helvetica", "italic"); doc.setFontSize(9);
      doc.text(`No. ${String(f.num).padStart(2, "0")}`, margin + 14, y + 12);

      doc.setTextColor(...c.deepNavy);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text(f.location || "Unspecified", margin + 60, y + 12);

      const badge = f.status === "repaired" ? "REPAIRED ON-SITE" : f.status === "estimate" ? "NEEDS ESTIMATE" : "INFORMATIONAL";
      doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.setTextColor(...accentColor);
      doc.text(badge, margin + contentW - 4, y + 12, { align: "right", charSpace: 1.2 });

      let cardY = y + 28;
      if (f.description) {
        doc.setTextColor(...c.ink);
        doc.setFont("helvetica", "normal"); doc.setFontSize(10);
        const descLines = doc.splitTextToSize(f.description, contentW - 20);
        doc.text(descLines, margin + 14, cardY);
        cardY += descLines.length * 12 + 6;
      }

      if ((f.status === "repaired" || f.status === "estimate") && (f.partsCost || f.laborCost)) {
        const total = (Number(f.partsCost) || 0) + (Number(f.laborCost) || 0);
        doc.setFontSize(8); doc.setTextColor(...c.inkSoft); doc.setFont("helvetica", "normal");
        doc.text(`Parts ${BWC.money(f.partsCost || 0)}   ·   Labor ${BWC.money(f.laborCost || 0)}   ·   Line Total ${BWC.money(total)}`, margin + 14, cardY);
        cardY += 14;
      }

      if (photosToShow.length > 0) {
        const photoBoxW = 110, photoBoxH = 75, gap = 6;
        for (let i = 0; i < photosToShow.length; i++) {
          const col = i % 4;
          const row = Math.floor(i / 4);
          await BWC.pdfPhoto(doc, photosToShow[i].dataUrl, margin + 14 + col * (photoBoxW + gap), cardY + row * (photoBoxH + gap), photoBoxW, photoBoxH);
        }
        cardY += photoBoxH * photoRows + (photoRows - 1) * gap + 6;

        if (f.photos.length > photosToShow.length) {
          doc.setTextColor(...c.inkFaint);
          doc.setFont("helvetica", "italic"); doc.setFontSize(8);
          doc.text(`+ ${f.photos.length - photosToShow.length} additional photo(s) on file`, margin + 14, cardY);
          cardY += 10;
        }
      }
      y = cardY + 14;
    }
  }

  // VIII. INVOICE
  const repairs = data.issues.filter((i) => i.status === "repaired");
  if (repairs.length > 0) {
    let parts = 0, labor = 0;
    repairs.forEach((f) => {
      parts += Number(f.partsCost) || 0;
      labor += Number(f.laborCost) || 0;
    });
    const total = parts + labor;

    const invoiceHeight = 40 + repairs.length * 18 + 80;
    y = BWC.ensureRoom(doc, y, invoiceHeight, headerOpts);
    y = BWC.pdfSectionTitle(doc, y, "VIII", "On-Site Repair Invoice");
    const invoiceId = BWC.nextId("INV");

    doc.setTextColor(...c.inkFaint);
    doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text("INVOICE NO.", margin, y, { charSpace: 1.2 });
    doc.text("BILL TO", margin + contentW / 2, y, { charSpace: 1.2 });

    doc.setTextColor(...c.deepNavy);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(invoiceId, margin, y + 14);
    doc.text("S&L Property Management", margin + contentW / 2, y + 14);
    doc.setFontSize(9); doc.setTextColor(...c.inkSoft);
    doc.text(`Property: ${propAddr}`, margin + contentW / 2, y + 26);
    y += 44;

    doc.setDrawColor(...c.rule); doc.setLineWidth(0.4);
    doc.line(margin, y, margin + contentW, y);
    doc.setTextColor(...c.inkFaint); doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.text("DESCRIPTION", margin + 4, y + 11, { charSpace: 1 });
    doc.text("PARTS", margin + contentW - 220, y + 11, { align: "right", charSpace: 1 });
    doc.text("LABOR", margin + contentW - 110, y + 11, { align: "right", charSpace: 1 });
    doc.text("TOTAL", margin + contentW - 4, y + 11, { align: "right", charSpace: 1 });
    y += 18;
    doc.line(margin, y, margin + contentW, y);

    repairs.forEach((f) => {
      y += 16;
      const lineTotal = (Number(f.partsCost) || 0) + (Number(f.laborCost) || 0);
      doc.setTextColor(...c.deepNavy); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      const descText = `${f.location || "Repair"}${f.description ? " — " + f.description : ""}`;
      const truncDesc = doc.splitTextToSize(descText, contentW - 240)[0] || descText;
      doc.text(truncDesc, margin + 4, y);
      doc.text(BWC.money(f.partsCost || 0), margin + contentW - 220, y, { align: "right" });
      doc.text(BWC.money(f.laborCost || 0), margin + contentW - 110, y, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(BWC.money(lineTotal), margin + contentW - 4, y, { align: "right" });
    });

    y += 8; doc.line(margin, y, margin + contentW, y); y += 16;

    doc.setFont("helvetica", "normal"); doc.setTextColor(...c.inkSoft); doc.setFontSize(9);
    doc.text("Parts & Materials", margin + contentW - 110, y, { align: "right" });
    doc.setTextColor(...c.deepNavy);
    doc.text(BWC.money(parts), margin + contentW - 4, y, { align: "right" });
    y += 14;
    doc.setTextColor(...c.inkSoft);
    doc.text("Labor", margin + contentW - 110, y, { align: "right" });
    doc.setTextColor(...c.deepNavy);
    doc.text(BWC.money(labor), margin + contentW - 4, y, { align: "right" });
    y += 18;

    doc.setFillColor(...c.bone);
    doc.rect(margin + contentW - 220, y - 4, 220, 26, "F");
    doc.setTextColor(...c.deepNavy); doc.setFont("helvetica", "italic"); doc.setFontSize(11);
    doc.text("Total Due", margin + contentW - 110, y + 12, { align: "right" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text(BWC.money(total), margin + contentW - 6, y + 12, { align: "right" });
    y += 36;

    doc.setTextColor(...c.inkFaint); doc.setFont("helvetica", "italic"); doc.setFontSize(8);
    if (total <= 500) {
      doc.text("Within $500 on-site repair authorization per S&L Property Management.", margin, y);
    } else {
      doc.setTextColor(...c.danger);
      doc.text("Exceeds $500 — requires written approval before completion.", margin, y);
    }
    y += 16;
  }

  // IX. ESTIMATE FOLLOWUPS
  const needsEst = data.issues.filter((i) => i.status === "estimate");
  if (needsEst.length > 0) {
    y = BWC.ensureRoom(doc, y, 60 + needsEst.length * 14, headerOpts);
    y += 8;
    y = BWC.pdfSectionTitle(doc, y, "IX", "Items Requiring Estimate");
    doc.setTextColor(...c.inkSoft); doc.setFontSize(9); doc.setFont("helvetica", "italic");
    doc.text("The following items exceed on-site authorization or require additional scoping. A separate estimate will follow.", margin, y, { maxWidth: contentW });
    y += 18;
    doc.setFont("helvetica", "normal"); doc.setTextColor(...c.deepNavy);
    needsEst.forEach((f) => {
      doc.setFontSize(9);
      doc.text(`•  ${f.location || "Unspecified"} — ${f.description || ""}`, margin, y, { maxWidth: contentW });
      y += 14;
    });
  }

  // X. PHOTO APPENDIX
  if (data.overviewPhotos.filter((p) => p.photo).length > 0) {
    doc.addPage();
    let ay = BWC.pdfHeader(doc, headerOpts);
    ay = BWC.pdfSectionTitle(doc, ay, "X", "Photo Appendix — Property Overview");

    const photosWithImages = data.overviewPhotos.filter((p) => p.photo);
    const photoW = (contentW - 12) / 2;
    const photoH = 140;
    const labelH = 18;
    const gap = 12;

    for (let i = 0; i < photosWithImages.length; i++) {
      const col = i % 2;
      const row = Math.floor(i / 2) % 3;
      const x = margin + col * (photoW + gap);
      const yPos = ay + row * (photoH + labelH + gap);

      if (i > 0 && i % 6 === 0) {
        doc.addPage();
        ay = BWC.pdfHeader(doc, headerOpts);
        ay = BWC.pdfSectionTitle(doc, ay, "X", "Photo Appendix — Property Overview (cont.)");
      }

      await BWC.pdfPhoto(doc, photosWithImages[i].photo.dataUrl, x, yPos, photoW, photoH);

      doc.setTextColor(...c.inkSoft);
      doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text(photosWithImages[i].label.toUpperCase(), x, yPos + photoH + 12, { charSpace: 1.2 });
    }
  }

  // FOOTERS
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    BWC.pdfFooter(doc, i, totalPages);
  }

  const fname = `${reportId}_${(data.propertyAddress || "report").replace(/[^\w]+/g, "_").slice(0, 40)}.pdf`;
  doc.save(fname);
  BWC.toast("PDF saved");
  document.getElementById("reportIdDisplay").textContent = BWC.peekId("INS");
}

// ============================================
// PDF HELPERS
// ============================================
function drawChecksTable(doc, rows, y, margin, contentW, headerOpts) {
  const c = BWC.colors;
  const rowH = 20;
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setDrawColor(...c.rule); doc.setLineWidth(0.3);
  doc.line(margin, y - 2, margin + contentW, y - 2);
  let curY = y;
  for (let i = 0; i < rows.length; i++) {
    if (curY + rowH > pageHeight - 90) {
      doc.addPage();
      curY = BWC.pdfHeader(doc, headerOpts);
      doc.setDrawColor(...c.rule); doc.setLineWidth(0.3);
      doc.line(margin, curY - 2, margin + contentW, curY - 2);
    }
    const row = rows[i];
    doc.setTextColor(...c.inkSoft); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(row.label, margin + 4, curY + 12);

    const isIssue = /issue|leak|miss|broken|damage|fail|battery only|attention|exceeds|needs/i.test(row.val);
    doc.setTextColor(...(isIssue ? c.danger : c.deepNavy));
    doc.setFont("helvetica", isIssue ? "bold" : "normal");
    doc.text(row.val, margin + contentW - 4, curY + 12, { align: "right" });

    doc.line(margin, curY + rowH - 2, margin + contentW, curY + rowH - 2);
    curY += rowH;
  }
  return curY + 8;
}

function wetAreaStatusLabel(s) {
  return { good: "Good", issue: "Issue", repaired: "Repaired" }[s] || s;
}
function strapLabel(s) {
  return { double: "Double straps", single: "Single only", missing: "Missing", replaced: "Installed today" }[s] || "Not noted";
}
function whConditionLabel(s) {
  return { good: "Good", aging: "Aging", failing: "Failing" }[s] || s;
}
function whTypeLabel(s) {
  return {
    gas: "Gas tank", electric: "Electric tank",
    "tankless-gas": "Tankless (gas)", "tankless-electric": "Tankless (electric)",
  }[s] || "—";
}
