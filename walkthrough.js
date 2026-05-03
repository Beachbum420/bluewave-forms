/* ============================================
   WALKTHROUGH ESTIMATE FORM LOGIC
   ============================================ */

const FORM_KEY = "walkthrough";
const CATALOG_KEY = "bwc_catalog";

// Default catalog seeded on first load
const DEFAULT_CATALOG = [
  { id: "smoke-alarm", name: "Smoke Alarm — Replace", price: 80, unit: "each" },
  { id: "combo-alarm", name: "Combo Alarm — Replace", price: 80, unit: "each" },
  { id: "recaulk-bath-sink", name: "Recaulk Bathroom Sink", price: 125, unit: "each" },
  { id: "recaulk-kitchen-sink", name: "Recaulk Kitchen Sink", price: 150, unit: "each" },
  { id: "recaulk-tub", name: "Recaulk Tub / Shower", price: 175, unit: "each" },
];

let catalog = [];
let lineItems = []; // [{ id, name, description, qty, price, photos: [] }]
let nextItemNum = 1;

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("walkthroughDate").value = BWC.todayISO();
  document.getElementById("estimateIdDisplay").textContent = BWC.peekId("EST");

  loadCatalog();
  renderCatalog();

  const draft = BWC.loadDraft(FORM_KEY);
  if (draft) restoreDraft(draft);

  // Check for handoff from inspection form
  checkInspectionHandoff();

  wireActions();
  wireLightbox();

  document.getElementById("walkthroughForm").addEventListener("input", () => {
    autosave();
    updateTotals();
  });
  document.getElementById("walkthroughForm").addEventListener("change", () => {
    autosave();
    updateTotals();
  });

  updateTotals();
});

// ===== CATALOG =====
function loadCatalog() {
  try {
    const saved = localStorage.getItem(CATALOG_KEY);
    catalog = saved ? JSON.parse(saved) : [...DEFAULT_CATALOG];
  } catch (e) {
    catalog = [...DEFAULT_CATALOG];
  }
}

function saveCatalog() {
  localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
}

function renderCatalog() {
  const el = document.getElementById("catalog");
  el.innerHTML = "";
  catalog.forEach((item) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "catalog-item";
    btn.innerHTML = `
      <span class="name">${esc(item.name)}</span>
      <span class="price">${BWC.money(item.price)} / ${esc(item.unit)}</span>
    `;
    btn.addEventListener("click", () => {
      addLineItem({
        name: item.name,
        description: "",
        qty: 1,
        price: item.price,
      });
    });
    el.appendChild(btn);
  });
}

function renderCatalogEditor() {
  const el = document.getElementById("catalogEditor");
  el.innerHTML = "";
  catalog.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "field-row thirds";
    row.style.alignItems = "end";
    row.style.gap = "8px";
    row.innerHTML = `
      <div class="field">
        <label class="label">Name</label>
        <input type="text" data-idx="${idx}" data-field="name" value="${esc(item.name)}" />
      </div>
      <div class="field">
        <label class="label">Price</label>
        <input type="number" step="0.01" data-idx="${idx}" data-field="price" value="${item.price}" />
      </div>
      <div class="field">
        <label class="label">Unit</label>
        <input type="text" data-idx="${idx}" data-field="unit" value="${esc(item.unit)}" />
      </div>
      <button type="button" class="remove-item" data-remove="${idx}" style="margin-bottom: 12px;">Remove</button>
    `;
    el.appendChild(row);
  });
  el.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", (e) => {
      const idx = +e.target.dataset.idx;
      const field = e.target.dataset.field;
      catalog[idx][field] =
        field === "price" ? parseFloat(e.target.value) || 0 : e.target.value;
      saveCatalog();
      renderCatalog();
    });
  });
  el.querySelectorAll("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = +e.target.dataset.remove;
      catalog.splice(idx, 1);
      saveCatalog();
      renderCatalog();
      renderCatalogEditor();
    });
  });
}

// ===== LINE ITEMS =====
function addLineItem(data) {
  const item = {
    id: crypto.randomUUID(),
    num: nextItemNum++,
    name: data.name || "",
    description: data.description || "",
    qty: data.qty || 1,
    price: data.price || 0,
    photos: data.photos || [],
    location: data.location || "",
  };
  lineItems.push(item);
  renderLineItem(item);
  hideEmptyMsg();
  updateTotals();
  autosave();
}

function renderLineItem(item) {
  const list = document.getElementById("lineItems");
  const card = document.createElement("div");
  card.className = "item-card";
  card.dataset.itemId = item.id;
  card.innerHTML = `
    <div class="item-num">№ ${String(item.num).padStart(2, "0")}</div>

    <div class="field">
      <label class="label">Item / Service</label>
      <input type="text" class="i-name" value="${esc(item.name)}" placeholder="What's the line item?" />
    </div>

    <div class="field-row">
      <div class="field" style="margin: 0">
        <label class="label">Location</label>
        <input type="text" class="i-location" value="${esc(item.location)}" placeholder="Kitchen, Bath 1, Exterior…" />
      </div>
      <div class="field" style="margin: 0">
        <label class="label">Description</label>
        <input type="text" class="i-description" value="${esc(item.description)}" placeholder="Optional detail" />
      </div>
    </div>

    <div class="cost-row">
      <div class="field" style="margin: 0">
        <label class="label">Qty</label>
        <input type="number" min="0" step="0.5" class="i-qty" value="${item.qty}" />
      </div>
      <div class="field" style="margin: 0">
        <label class="label">Unit Price $</label>
        <input type="number" min="0" step="0.01" class="i-price" value="${item.price}" />
      </div>
      <div class="field" style="margin: 0">
        <label class="label">Line Total</label>
        <input type="text" class="i-total" readonly value="${BWC.money(item.qty * item.price)}" />
      </div>
    </div>

    <div class="photo-row">
      <div class="photos-container" style="display: flex; gap: 8px; flex-wrap: wrap;"></div>
      <label class="add-photo">
        +
        <input type="file" accept="image/*" capture="environment" multiple style="display: none" class="i-photo-input" />
      </label>
    </div>

    <div class="item-actions">
      <button type="button" class="remove-item">Remove item</button>
    </div>
  `;
  list.appendChild(card);
  wireLineItemCard(card, item);
  renderItemPhotos(card, item);
}

function wireLineItemCard(card, item) {
  card.querySelector(".i-name").addEventListener("input", (e) => {
    item.name = e.target.value;
    autosave();
  });
  card.querySelector(".i-location").addEventListener("input", (e) => {
    item.location = e.target.value;
    autosave();
  });
  card.querySelector(".i-description").addEventListener("input", (e) => {
    item.description = e.target.value;
    autosave();
  });

  const qtyInput = card.querySelector(".i-qty");
  const priceInput = card.querySelector(".i-price");
  const totalInput = card.querySelector(".i-total");

  function updateLineTotal() {
    const t = (Number(item.qty) || 0) * (Number(item.price) || 0);
    totalInput.value = BWC.money(t);
    updateTotals();
  }

  qtyInput.addEventListener("input", (e) => {
    item.qty = parseFloat(e.target.value) || 0;
    updateLineTotal();
    autosave();
  });
  priceInput.addEventListener("input", (e) => {
    item.price = parseFloat(e.target.value) || 0;
    updateLineTotal();
    autosave();
  });

  // Photos
  const photoInput = card.querySelector(".i-photo-input");
  photoInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      try {
        const photo = await BWC.processPhoto(file);
        item.photos.push(photo);
      } catch (err) {
        console.warn("Photo processing failed:", err);
      }
    }
    renderItemPhotos(card, item);
    autosave();
    photoInput.value = "";
  });

  card.querySelector(".remove-item").addEventListener("click", () => {
    if (confirm("Remove this item?")) {
      lineItems = lineItems.filter((x) => x.id !== item.id);
      card.remove();
      updateTotals();
      hideEmptyMsg();
      autosave();
    }
  });
}

function renderItemPhotos(card, item) {
  const container = card.querySelector(".photos-container");
  container.innerHTML = "";
  item.photos.forEach((p, idx) => {
    const thumb = document.createElement("div");
    thumb.className = "photo-thumb";
    thumb.innerHTML = `
      <img src="${p.dataUrl}" alt="photo" />
      <button type="button" class="remove" aria-label="remove">×</button>
    `;
    thumb.querySelector("img").addEventListener("click", () => {
      openLightbox(p.dataUrl);
    });
    thumb.querySelector(".remove").addEventListener("click", (e) => {
      e.stopPropagation();
      item.photos.splice(idx, 1);
      renderItemPhotos(card, item);
      autosave();
    });
    container.appendChild(thumb);
  });
}

function hideEmptyMsg() {
  document.getElementById("emptyLineMessage").style.display =
    lineItems.length === 0 ? "block" : "none";
}

// ===== TOTALS =====
function updateTotals() {
  const subtotal = lineItems.reduce(
    (sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0),
    0
  );
  document.getElementById("subtotalDisplay").textContent = BWC.money(subtotal);
  document.getElementById("grandTotalDisplay").textContent = BWC.money(subtotal);
  document.getElementById("totalsSection").style.display =
    lineItems.length > 0 ? "block" : "none";
}

// ===== AUTOSAVE =====
function autosave() {
  const data = collectFormData();
  BWC.saveDraft(FORM_KEY, data);
}

function collectFormData() {
  return {
    customerName: val("customerName"),
    customerEmail: val("customerEmail"),
    customerPhone: val("customerPhone"),
    propertyAddress: val("propertyAddress"),
    walkthroughDate: val("walkthroughDate"),
    referenceId: val("referenceId"),
    scopeNotes: val("scopeNotes"),
    lineItems: lineItems,
    nextItemNum: nextItemNum,
  };
}

function val(id) {
  return document.getElementById(id).value;
}

function restoreDraft(d) {
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el && v !== undefined && v !== null) el.value = v;
  };
  set("customerName", d.customerName);
  set("customerEmail", d.customerEmail);
  set("customerPhone", d.customerPhone);
  set("propertyAddress", d.propertyAddress);
  set("walkthroughDate", d.walkthroughDate || BWC.todayISO());
  set("referenceId", d.referenceId);
  set("scopeNotes", d.scopeNotes);
  if (d.nextItemNum) nextItemNum = d.nextItemNum;
  if (Array.isArray(d.lineItems)) {
    d.lineItems.forEach((item) => addLineItem(item));
  }
}

function checkInspectionHandoff() {
  const url = new URL(window.location.href);
  if (url.searchParams.get("from") === "inspection") {
    const handoffRaw = localStorage.getItem("bwc_walkthrough_handoff");
    if (handoffRaw) {
      try {
        const handoff = JSON.parse(handoffRaw);
        // Pre-populate property address
        if (handoff.propertyAddress) {
          document.getElementById("propertyAddress").value =
            handoff.propertyAddress + (handoff.unitNumber ? `, ${handoff.unitNumber}` : "");
        }
        if (handoff.sourceInspectionId) {
          document.getElementById("referenceId").value = handoff.sourceInspectionId;
        }
        if (handoff.items) {
          handoff.items.forEach((item) => {
            addLineItem({
              name: item.location || "Repair",
              description: item.description,
              location: item.location,
              qty: 1,
              price: (Number(item.partsCost) || 0) + (Number(item.laborCost) || 0),
              photos: item.photos || [],
            });
          });
        }
        localStorage.removeItem("bwc_walkthrough_handoff");
        BWC.toast("Items imported from inspection");
      } catch (e) {
        console.warn("Handoff parse failed:", e);
      }
    }
  }
}

// ===== ACTIONS =====
function wireActions() {
  document.getElementById("generatePdfBtn").addEventListener("click", generatePdf);
  document.getElementById("exportJsonBtn").addEventListener("click", exportJson);
  document.getElementById("clearBtn").addEventListener("click", clearForm);
  document.getElementById("addCustomBtn").addEventListener("click", () => {
    addLineItem({ name: "", description: "", qty: 1, price: 0 });
  });

  // Catalog management
  document.getElementById("manageCatalogBtn").addEventListener("click", () => {
    renderCatalogEditor();
    document.getElementById("catalogPanel").style.display = "block";
  });
  document.getElementById("closeCatalogBtn").addEventListener("click", () => {
    document.getElementById("catalogPanel").style.display = "none";
  });
  document.getElementById("addCatalogItemBtn").addEventListener("click", () => {
    catalog.push({
      id: "custom-" + Date.now(),
      name: "New Item",
      price: 0,
      unit: "each",
    });
    saveCatalog();
    renderCatalog();
    renderCatalogEditor();
  });
}

function exportJson() {
  const data = collectFormData();
  const exportData = {
    ...data,
    documentType: "walkthrough_estimate",
    documentId: BWC.peekId("EST"),
    generatedAt: new Date().toISOString(),
    subtotal: data.lineItems.reduce(
      (s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0),
      0
    ),
    lineItems: data.lineItems.map((i) => ({
      ...i,
      photoCount: i.photos.length,
      lineTotal: (Number(i.qty) || 0) * (Number(i.price) || 0),
      photos: undefined,
    })),
  };
  const fname = `estimate_${(data.customerName || "untitled").replace(/[^\w]+/g, "_")}_${data.walkthroughDate}.json`;
  BWC.downloadJSON(fname, exportData);
  BWC.toast("JSON exported");
}

function clearForm() {
  if (!confirm("Clear all form data? Draft will be deleted.")) return;
  BWC.clearDraft(FORM_KEY);
  location.reload();
}

function esc(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
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
// PDF — ESTIMATE
// ============================================
async function generatePdf() {
  const data = collectFormData();
  if (!data.customerName) {
    alert("Customer name is required.");
    document.getElementById("customerName").focus();
    return;
  }
  if (lineItems.length === 0) {
    alert("Add at least one line item before generating.");
    return;
  }

  BWC.toast("Generating estimate...");

  const estimateId = BWC.nextId("EST");
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const c = BWC.colors;
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 50;
  const contentW = pageW - margin * 2;

  const headerOpts = { docType: "Estimate", docId: estimateId };
  let y = BWC.pdfHeader(doc, headerOpts);

  // Customer / property block
  doc.setTextColor(...c.inkFaint);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("PREPARED FOR", margin, y, { charSpace: 1.2 });
  doc.text("PROPERTY", margin + contentW / 2, y, { charSpace: 1.2 });

  doc.setTextColor(...c.deepNavy);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(data.customerName, margin, y + 14);

  const addrLines = doc.splitTextToSize(data.propertyAddress || "—", contentW / 2 - 10);
  doc.text(addrLines, margin + contentW / 2, y + 14);

  let metaY = y + 28;
  doc.setFontSize(9);
  doc.setTextColor(...c.inkSoft);
  if (data.customerEmail) {
    doc.text(data.customerEmail, margin, metaY);
    metaY += 12;
  }
  if (data.customerPhone) {
    doc.text(data.customerPhone, margin, metaY);
    metaY += 12;
  }

  y = Math.max(metaY, y + 28 + addrLines.length * 12) + 20;

  // Estimate meta
  y = BWC.pdfSectionTitle(doc, y, "I", "Estimate Details");
  const col1 = margin;
  const col2 = margin + contentW / 3;
  const col3 = margin + (contentW * 2) / 3;
  BWC.pdfField(doc, col1, y, "Date Prepared", BWC.formatDate(data.walkthroughDate));
  BWC.pdfField(doc, col2, y, "Valid Until", validUntil(data.walkthroughDate));
  BWC.pdfField(doc, col3, y, "Reference", data.referenceId || "—");
  y += 32;

  // Scope notes
  if (data.scopeNotes && data.scopeNotes.trim()) {
    y = BWC.ensureRoom(doc, y, 60, headerOpts);
    doc.setTextColor(...c.inkFaint);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("PROJECT SCOPE", margin, y, { charSpace: 1.2 });
    y += 12;
    doc.setTextColor(...c.deepNavy);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const scopeLines = doc.splitTextToSize(data.scopeNotes, contentW);
    doc.text(scopeLines, margin, y);
    y += scopeLines.length * 12 + 14;
  }

  // ===== LINE ITEMS =====
  y = BWC.ensureRoom(doc, y, 60, headerOpts);
  y = BWC.pdfSectionTitle(doc, y, "II", "Scope of Work");

  // Table header
  doc.setDrawColor(...c.rule);
  doc.setLineWidth(0.4);
  doc.line(margin, y, margin + contentW, y);
  doc.setTextColor(...c.inkFaint);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("ITEM / DESCRIPTION", margin + 4, y + 11, { charSpace: 1 });
  doc.text("QTY", margin + contentW - 200, y + 11, { align: "right", charSpace: 1 });
  doc.text("UNIT", margin + contentW - 130, y + 11, { align: "right", charSpace: 1 });
  doc.text("LINE TOTAL", margin + contentW - 4, y + 11, { align: "right", charSpace: 1 });
  y += 18;
  doc.line(margin, y, margin + contentW, y);

  for (const item of lineItems) {
    const lineTotal = (Number(item.qty) || 0) * (Number(item.price) || 0);
    const photosToShow = item.photos.slice(0, 1);
    const hasPhoto = photosToShow.length > 0;

    // Row content height calc
    const descText = [item.location, item.description].filter(Boolean).join(" — ");
    const nameText = item.name || "Item";
    const descLines = descText
      ? doc.splitTextToSize(descText, contentW - 220 - (hasPhoto ? 70 : 0))
      : [];
    const rowHeight = Math.max(28, hasPhoto ? 60 : 28) + descLines.length * 11;

    y = BWC.ensureRoom(doc, y, rowHeight + 10, headerOpts);
    y += 14;

    // Photo
    if (hasPhoto) {
      await BWC.pdfPhoto(doc, photosToShow[0].dataUrl, margin + 4, y - 8, 56, 56);
    }

    // Item name
    const textX = margin + (hasPhoto ? 70 : 4);
    doc.setTextColor(...c.deepNavy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(nameText, textX, y);

    // Description
    if (descLines.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...c.inkSoft);
      doc.text(descLines, textX, y + 12);
    }

    // Qty / Unit / Line total
    doc.setTextColor(...c.deepNavy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(String(item.qty || 0), margin + contentW - 200, y, { align: "right" });
    doc.text(BWC.money(item.price), margin + contentW - 130, y, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(BWC.money(lineTotal), margin + contentW - 4, y, { align: "right" });

    if (hasPhoto) y += 60 - 14;
    else y += descLines.length * 11 + 6;

    doc.setDrawColor(...c.rule);
    doc.setLineWidth(0.2);
    doc.line(margin, y + 4, margin + contentW, y + 4);
    y += 4;
  }

  y += 10;

  // ===== TOTALS =====
  const subtotal = lineItems.reduce(
    (s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0),
    0
  );

  y = BWC.ensureRoom(doc, y, 80, headerOpts);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...c.inkSoft);
  doc.text("Subtotal", margin + contentW - 110, y, { align: "right" });
  doc.setTextColor(...c.deepNavy);
  doc.text(BWC.money(subtotal), margin + contentW - 4, y, { align: "right" });
  y += 14;

  // Grand total
  y += 6;
  doc.setFillColor(...c.bone);
  doc.rect(margin + contentW - 240, y - 4, 240, 30, "F");
  doc.setTextColor(...c.deepNavy);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(11);
  doc.text("Estimated Total", margin + contentW - 130, y + 14, {
    align: "right",
  });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(BWC.money(subtotal), margin + contentW - 6, y + 14, {
    align: "right",
  });
  y += 44;

  // Terms / signature line
  y = BWC.ensureRoom(doc, y, 80, headerOpts);
  doc.setTextColor(...c.inkFaint);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("TERMS", margin, y, { charSpace: 1.2 });
  y += 12;
  doc.setTextColor(...c.inkSoft);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const terms = [
    "Estimate valid for 30 days from date prepared.",
    "Final invoice may vary based on unforeseen conditions discovered during work.",
    "50% deposit due at project start; balance due upon completion.",
    "Work performed under California GC License #1153965.",
  ];
  terms.forEach((t) => {
    doc.text("•  " + t, margin, y);
    y += 11;
  });

  y += 14;

  // Signature lines
  y = BWC.ensureRoom(doc, y, 60, headerOpts);
  doc.setDrawColor(...c.rule);
  doc.setLineWidth(0.5);
  doc.line(margin, y + 30, margin + contentW / 2 - 10, y + 30);
  doc.line(margin + contentW / 2 + 10, y + 30, margin + contentW, y + 30);

  doc.setTextColor(...c.inkFaint);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("CUSTOMER ACCEPTANCE & DATE", margin, y + 42, { charSpace: 1.2 });
  doc.text("BLUE WAVE CONSTRUCTION", margin + contentW / 2 + 10, y + 42, {
    charSpace: 1.2,
  });

  // ===== FOOTER =====
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    BWC.pdfFooter(doc, i, totalPages);
  }

  const fname = `${estimateId}_${(data.customerName || "estimate").replace(/[^\w]+/g, "_").slice(0, 40)}.pdf`;
  doc.save(fname);
  BWC.toast("Estimate saved");
  document.getElementById("estimateIdDisplay").textContent = BWC.peekId("EST");
}

function validUntil(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + 30);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
