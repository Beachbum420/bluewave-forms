/* ============================================
   CUSTOMER INTAKE FORM LOGIC
   ============================================
   Customer-facing punchlist form.
   - Repeating line items with photos + optional category
   - Submits as multipart/form-data to Formspree (so photos attach)
   - Auto-saves draft locally so customer doesn't lose progress
   - Shows thank-you panel after success
   ============================================ */

// ⚠️ Set this to your Formspree endpoint URL.
// Example: "https://formspree.io/f/xkgjabcd"
// Until set, submissions just download as JSON instead.
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xeenelwj";

const FORM_KEY = "customer_intake";

const CATEGORIES = [
  "—",
  "Plumbing",
  "Electrical",
  "Carpentry / Framing",
  "Drywall / Paint",
  "Flooring",
  "Tile / Stone",
  "Cabinetry / Counters",
  "Doors / Windows",
  "Roofing",
  "Landscape / Hardscape",
  "Fencing / Gates",
  "Demo",
  "Cleaning",
  "Other",
];

let lineItems = []; // [{ id, num, title, description, category, priority, photos }]
let nextItemNum = 1;

// ============================================
// INIT
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  const draft = BWC.loadDraft(FORM_KEY);
  if (draft) restoreDraft(draft);

  wireLineItems();
  wireSubmit();
  wireLightbox();

  // Save on every input change
  document.getElementById("intakeForm").addEventListener("input", autosave);
  document.getElementById("intakeForm").addEventListener("change", autosave);

  updateEmptyMsg();
});

// ============================================
// LINE ITEMS
// ============================================
function wireLineItems() {
  document.getElementById("addLineItemBtn").addEventListener("click", () => {
    addLineItem();
  });
}

function addLineItem(seed) {
  seed = seed || {};
  const item = {
    id: seed.id || crypto.randomUUID(),
    num: seed.num || nextItemNum,
    title: seed.title || "",
    description: seed.description || "",
    category: seed.category || "—",
    priority: seed.priority || "normal",
    photos: Array.isArray(seed.photos) ? seed.photos : [],
  };
  if (seed.num && seed.num >= nextItemNum) nextItemNum = seed.num + 1;
  else if (!seed.num) nextItemNum++;
  lineItems.push(item);
  renderLineItem(item);
  updateEmptyMsg();
  autosave();
}

function renderLineItem(item) {
  const list = document.getElementById("lineItemsList");
  const card = document.createElement("div");
  card.className = "intake-line-item";
  card.dataset.id = item.id;

  const catOptionsHTML = CATEGORIES.map(
    (c) => `<option value="${esc(c)}" ${c === item.category ? "selected" : ""}>${esc(c)}</option>`
  ).join("");

  const pn = (s) => `pri-${item.id}-${s}`;

  card.innerHTML = `
    <div class="intake-line-header">
      <div class="intake-line-num">Item ${String(item.num).padStart(2, "0")}</div>
      <button type="button" class="intake-line-remove" aria-label="Remove item">Remove</button>
    </div>

    <div class="field">
      <label class="label">Short title <span class="required">*</span></label>
      <p class="helper">A few words — what is this?</p>
      <input type="text" class="li-title" value="${esc(item.title)}" required placeholder="e.g. Replace kitchen faucet" />
    </div>

    <div class="field">
      <label class="label">Description</label>
      <p class="helper">Tell us what you'd like done — as much or as little as you want.</p>
      <textarea class="li-description" placeholder="What needs to happen here? Any specifics, brand preferences, etc.">${esc(item.description)}</textarea>
    </div>

    <div class="field-row">
      <div class="field">
        <label class="label">Category <span class="optional">optional</span></label>
        <select class="li-category">${catOptionsHTML}</select>
      </div>
      <div class="field">
        <label class="label">Priority</label>
        <div class="status-buttons">
          <input type="radio" name="${pn("priority")}" id="${pn("urgent")}" value="urgent" ${item.priority === "urgent" ? "checked" : ""} />
          <label for="${pn("urgent")}" class="status-issue">Urgent</label>
          <input type="radio" name="${pn("priority")}" id="${pn("normal")}" value="normal" ${item.priority === "normal" ? "checked" : ""} />
          <label for="${pn("normal")}" class="status-warn">Soon</label>
          <input type="radio" name="${pn("priority")}" id="${pn("whenever")}" value="whenever" ${item.priority === "whenever" ? "checked" : ""} />
          <label for="${pn("whenever")}" class="status-ok">Whenever</label>
        </div>
      </div>
    </div>

    <div class="field">
      <label class="label">Photos <span class="optional">recommended</span></label>
      <p class="helper">A clear photo helps us estimate accurately. You can add up to 3 per item.</p>
      <div class="li-photo-strip" style="margin-bottom: var(--s3);"></div>
      <label class="photo-button li-photo-btn">
        <span class="icon">+</span>
        <span class="text">Add photo</span>
        <input type="file" accept="image/*" capture="environment" multiple class="li-photo-input" />
      </label>
    </div>
  `;

  list.appendChild(card);
  wireLineItemCard(card, item);
  renderLineItemPhotos(card, item);
}

function wireLineItemCard(card, item) {
  card.querySelector(".li-title").addEventListener("input", (e) => {
    item.title = e.target.value;
    autosave();
  });
  card.querySelector(".li-description").addEventListener("input", (e) => {
    item.description = e.target.value;
    autosave();
  });
  card.querySelector(".li-category").addEventListener("change", (e) => {
    item.category = e.target.value;
    autosave();
  });
  card.querySelectorAll('input[type="radio"]').forEach((r) => {
    r.addEventListener("change", (e) => {
      item.priority = e.target.value;
      autosave();
    });
  });

  const photoInput = card.querySelector(".li-photo-input");
  photoInput.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files || []);
    const remaining = 3 - item.photos.length;
    if (remaining <= 0) {
      alert("That's the limit — 3 photos per item. Remove one to add another.");
      photoInput.value = "";
      return;
    }
    const filesToProcess = files.slice(0, remaining);
    for (const file of filesToProcess) {
      try {
        const photo = await BWC.processPhoto(file);
        item.photos.push(photo);
      } catch (err) {
        console.warn("Photo error:", err);
      }
    }
    renderLineItemPhotos(card, item);
    autosave();
    photoInput.value = "";
  });

  card.querySelector(".intake-line-remove").addEventListener("click", () => {
    if (confirm(`Remove "${item.title || "this item"}"?`)) {
      lineItems = lineItems.filter((x) => x.id !== item.id);
      card.remove();
      updateEmptyMsg();
      autosave();
    }
  });
}

function renderLineItemPhotos(card, item) {
  const strip = card.querySelector(".li-photo-strip");
  const btn = card.querySelector(".li-photo-btn");
  strip.innerHTML = "";
  item.photos.forEach((p, idx) => {
    const thumb = document.createElement("div");
    thumb.className = "photo-thumb";
    thumb.innerHTML = `<img src="${p.dataUrl}" alt="photo" /><button type="button" class="remove">×</button>`;
    thumb.querySelector("img").addEventListener("click", () => openLightbox(p.dataUrl));
    thumb.querySelector(".remove").addEventListener("click", (e) => {
      e.stopPropagation();
      item.photos.splice(idx, 1);
      renderLineItemPhotos(card, item);
      autosave();
    });
    strip.appendChild(thumb);
  });
  btn.classList.toggle("has-photos", item.photos.length > 0);
  if (item.photos.length >= 3) {
    btn.style.opacity = "0.4";
    btn.style.pointerEvents = "none";
    btn.querySelector(".text").textContent = "Max 3 photos";
  } else {
    btn.style.opacity = "1";
    btn.style.pointerEvents = "auto";
    btn.querySelector(".text").textContent =
      item.photos.length > 0 ? `Add another (${item.photos.length}/3)` : "Add photo";
  }
}

function updateEmptyMsg() {
  const msg = document.getElementById("lineItemEmptyMsg");
  if (msg) msg.style.display = lineItems.length === 0 ? "block" : "none";
}

// ============================================
// SUBMIT
// ============================================
function wireSubmit() {
  document.getElementById("intakeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await submitForm();
  });
}

async function submitForm() {
  // Validate required fields
  const required = ["customerName", "customerPhone", "customerEmail", "propertyAddress"];
  for (const id of required) {
    const el = document.getElementById(id);
    if (!el.value.trim()) {
      el.focus();
      alert(`Please fill in: ${el.previousElementSibling?.textContent.replace("*", "").trim() || id}`);
      return;
    }
  }

  if (lineItems.length === 0) {
    alert("Please add at least one item to your punchlist.");
    document.getElementById("addLineItemBtn").focus();
    return;
  }

  // Validate at least each line item has a title
  for (const item of lineItems) {
    if (!item.title.trim()) {
      alert(`Item ${item.num} needs a title (e.g. "Replace kitchen faucet").`);
      return;
    }
  }

  showSubmitting(true);

  const data = collectFormData();
  const requestId = `BWC-REQ-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  data.requestId = requestId;
  data.submittedAt = new Date().toISOString();

  try {
    if (FORMSPREE_ENDPOINT) {
      await sendToFormspree(data);
    } else {
      // Fallback: download as JSON for the customer to send manually
      console.warn("FORMSPREE_ENDPOINT not set — downloading JSON as fallback");
      BWC.downloadJSON(`bluewave_intake_${requestId}.json`, data);
    }

    // Clear draft on success
    BWC.clearDraft(FORM_KEY);
    showThankYou(data);
  } catch (err) {
    showSubmitting(false);
    console.error("Submission error:", err);
    alert(
      "Something went wrong sending your request. Please try again, or email Ryan directly at ryanverbiest@gmail.com."
    );
  }
}

async function sendToFormspree(data) {
  const fd = new FormData();

  // Top-level fields — Formspree shows these nicely in email
  fd.append("Request ID", data.requestId);
  fd.append("Name", data.name);
  fd.append("Phone", data.phone);
  fd.append("Email", data.email);
  fd.append("Preferred Contact", data.contactPref);
  fd.append("Property Address", data.address);
  fd.append("Property Type", data.propertyType || "—");
  fd.append("Access Notes", data.accessNotes || "—");
  fd.append("Project Overview", data.overview || "—");
  fd.append("Timeline", data.timeline);
  fd.append("Budget Range", data.budget || "—");
  fd.append("Additional Notes", data.additionalNotes || "—");
  fd.append("Item Count", String(data.items.length));

  // Line items as a formatted text block (readable in email)
  let itemsText = "";
  data.items.forEach((item, idx) => {
    itemsText += `\n--- Item ${idx + 1} ---\n`;
    itemsText += `Title: ${item.title}\n`;
    if (item.category && item.category !== "—") itemsText += `Category: ${item.category}\n`;
    itemsText += `Priority: ${item.priority}\n`;
    if (item.description) itemsText += `Description: ${item.description}\n`;
    itemsText += `Photos: ${item.photos.length}\n`;
  });
  fd.append("Punchlist", itemsText.trim());

  // Photos — convert dataURL to Blob and attach with descriptive filenames
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    for (let p = 0; p < item.photos.length; p++) {
      const photo = item.photos[p];
      const blob = dataUrlToBlob(photo.dataUrl);
      const safeName = item.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 30) || `item-${i + 1}`;
      fd.append(
        `Item ${i + 1} Photo ${p + 1} (${safeName})`,
        blob,
        `${safeName}-${p + 1}.jpg`
      );
    }
  }

  // Hidden subject for email readability
  fd.append("_subject", `New Project Intake — ${data.name} — ${data.requestId}`);

  const response = await fetch(FORMSPREE_ENDPOINT, {
    method: "POST",
    body: fd,
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Formspree returned ${response.status}: ${errBody}`);
  }

  return response.json();
}

function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)[1];
  const binary = atob(base64);
  const len = binary.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ============================================
// THANK YOU
// ============================================
function showThankYou(data) {
  showSubmitting(false);
  document.getElementById("intakeForm").style.display = "none";
  document.querySelector(".intake-header").style.display = "none";

  document.getElementById("thankYouName").textContent =
    data.name.split(" ")[0] || "friend";
  document.getElementById("thankYouRequestId").textContent = data.requestId;
  document.getElementById("thankYouCount").textContent = String(data.items.length);

  const panel = document.getElementById("thankYouPanel");
  panel.style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showSubmitting(show) {
  document.getElementById("submittingOverlay").style.display = show ? "flex" : "none";
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
    name: f("customerName").value.trim(),
    phone: f("customerPhone").value.trim(),
    email: f("customerEmail").value.trim(),
    contactPref: radioVal("contactPref"),
    address: f("propertyAddress").value.trim(),
    propertyType: f("propertyType").value,
    accessNotes: f("accessNotes").value.trim(),
    overview: f("projectOverview").value.trim(),
    timeline: radioVal("timeline"),
    budget: f("budget").value,
    additionalNotes: f("additionalNotes").value.trim(),
    items: lineItems,
    nextItemNum,
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

  set("customerName", d.name);
  set("customerPhone", d.phone);
  set("customerEmail", d.email);
  setRadio("contactPref", d.contactPref);
  set("propertyAddress", d.address);
  set("propertyType", d.propertyType);
  set("accessNotes", d.accessNotes);
  set("projectOverview", d.overview);
  setRadio("timeline", d.timeline);
  set("budget", d.budget);
  set("additionalNotes", d.additionalNotes);

  if (d.nextItemNum) nextItemNum = d.nextItemNum;
  if (Array.isArray(d.items)) d.items.forEach((i) => addLineItem(i));
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
