/* ============================================
   BLUE WAVE CONSTRUCTION — SHARED HELPERS
   ============================================ */

const BWC = {
  // Brand colors as RGB tuples for jsPDF
  colors: {
    deepNavy: [10, 37, 64],
    midNavy: [14, 58, 95],
    waveBlue: [27, 108, 168],
    sky: [79, 163, 209],
    sand: [232, 217, 184],
    bone: [245, 239, 228],
    ink: [10, 37, 64],
    inkSoft: [61, 79, 102],
    inkFaint: [122, 134, 153],
    rule: [217, 207, 188],
    paper: [251, 248, 242],
    success: [45, 106, 79],
    danger: [184, 71, 42],
  },

  contact: {
    name: "Blue Wave Construction",
    license: "CA GC #1153965",
    email: "ryanverbiest@gmail.com",
    contact: "Ryan Verbiest",
  },

  // Per-brand header/footer identity. Inspection reports are issued under
  // S&L Property Management; everything else stays Blue Wave Construction.
  brands: {
    bwc: {
      name: "Blue Wave Construction",
      license: "CA GC #1153965",
      email: "ryanverbiest@gmail.com",
      contact: "Ryan Verbiest",
    },
    sl: {
      name: "S&L Property Management",
      license: "",
      email: "slpropertymanagement@gmail.com",
      contact: "Ryan Verbiest",
    },
  },

  // ===== ID GENERATION (auto-incrementing per device) =====
  nextId(kind, prefix = "BWC") {
    const year = new Date().getFullYear();
    const key = `bwc_counter_${kind}_${year}`;
    const current = parseInt(localStorage.getItem(key) || "0", 10);
    const next = current + 1;
    localStorage.setItem(key, String(next));
    return `${prefix}-${kind}-${year}-${String(next).padStart(4, "0")}`;
  },

  peekId(kind, prefix = "BWC") {
    const year = new Date().getFullYear();
    const key = `bwc_counter_${kind}_${year}`;
    const current = parseInt(localStorage.getItem(key) || "0", 10);
    return `${prefix}-${kind}-${year}-${String(current + 1).padStart(4, "0")}`;
  },

  // ===== AUTOSAVE =====
  saveDraft(formKey, data) {
    try {
      localStorage.setItem(`bwc_draft_${formKey}`, JSON.stringify(data));
    } catch (e) {
      console.warn("Could not save draft:", e);
    }
  },

  loadDraft(formKey) {
    try {
      const raw = localStorage.getItem(`bwc_draft_${formKey}`);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  clearDraft(formKey) {
    localStorage.removeItem(`bwc_draft_${formKey}`);
  },

  // ===== TOAST =====
  toast(message, ms = 2200) {
    let t = document.querySelector(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      document.body.appendChild(t);
    }
    t.textContent = message;
    t.classList.add("show");
    clearTimeout(BWC._toastTimer);
    BWC._toastTimer = setTimeout(() => t.classList.remove("show"), ms);
  },

  // ===== JSON EXPORT =====
  downloadJSON(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  // ===== FORMAT HELPERS =====
  money(n) {
    const num = Number(n) || 0;
    return num.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    });
  },

  formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  },

  todayISO() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  },

  // ===== PHOTO HANDLING =====
  // Resize an uploaded image to a reasonable size for PDF embedding
  // Returns a Promise<{ dataUrl, width, height }>
  async processPhoto(file, maxDim = 1400) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
          resolve({ dataUrl, width: w, height: h });
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
};

// ===== PDF: TRUE-CENTER TEXT (accounts for letter-spacing) =====
// jsPDF's { align: "center" } ignores charSpace, so spaced text drifts right.
// This measures the real rendered width (glyphs + inter-letter spacing) and
// draws left-aligned from the correct start x so it's centered on cx.
BWC.centerText = function (doc, text, cx, y, charSpace) {
  const cs = charSpace || 0;
  const glyphW = doc.getTextWidth(text);
  const spacingW = cs * Math.max(0, String(text).length - 1);
  const totalW = glyphW + spacingW;
  doc.text(text, cx - totalW / 2, y, { charSpace: cs });
};

// ===== PDF: SHARED HEADER/FOOTER =====
BWC.pdfHeader = function (doc, opts) {
  // opts: { docType, docId, brand }  — brand defaults to "bwc"
  const w = doc.internal.pageSize.getWidth();
  const c = BWC.colors;
  const brand = (opts && opts.brand) || "bwc";
  const id = BWC.brands[brand] || BWC.brands.bwc;

  if (brand === "sl") {
    // ===== S&L PROPERTY MANAGEMENT wordmark (vector, matches sticker) =====
    const cx = w / 2;
    const blockW = 150; // width of the flanking divider rules

    // Top divider rule
    doc.setDrawColor(...c.deepNavy);
    doc.setLineWidth(0.8);
    doc.line(cx - blockW / 2, 48, cx + blockW / 2, 48);

    // "S&L" wordmark — centered accounting for letter-spacing
    doc.setTextColor(...c.deepNavy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    BWC.centerText(doc, "S&L", cx, 74, 3);

    // "PROPERTY MANAGEMENT" subtitle — centered accounting for letter-spacing
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    BWC.centerText(doc, "PROPERTY MANAGEMENT", cx, 89, 4);

    // Bottom divider rule
    doc.setLineWidth(0.8);
    doc.line(cx - blockW / 2, 97, cx + blockW / 2, 97);
  } else {
    // ===== BLUE WAVE CONSTRUCTION wordmark (vector) =====
    doc.setTextColor(...c.deepNavy);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(22);
    doc.text("BLUE WAVE", w / 2, 60, { align: "center", charSpace: 4 });

    // Wave underline — drawn as a series of bezier curves (like the brand mark)
    doc.setDrawColor(...c.waveBlue);
    doc.setLineWidth(1.5);
    doc.setLineCap("round");
    const waveY = 76;
    const waveStart = w / 2 - 60;
    doc.lines(
      [
        [10, -7, 20, -7, 30, 0], // up arch
        [10, 7, 20, 7, 30, 0],   // down arch
        [10, -7, 20, -7, 30, 0], // up arch
        [10, 7, 20, 7, 30, 0],   // down arch
      ],
      waveStart,
      waveY,
      [1, 1],
      "S",
      false
    );

    // Subtitle
    doc.setTextColor(...c.deepNavy);
    doc.setFontSize(7);
    doc.text("CONSTRUCTION", w / 2, 92, { align: "center", charSpace: 6 });
  }

  // Top right: doc type + ID
  doc.setTextColor(...c.inkFaint);
  doc.setFontSize(7);
  doc.text(opts.docType.toUpperCase(), w - 50, 50, {
    align: "right",
    charSpace: 1.5,
  });
  doc.setTextColor(...c.deepNavy);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(opts.docId, w - 50, 64, { align: "right" });

  // Top left: license (if any) + email
  doc.setTextColor(...c.inkFaint);
  doc.setFontSize(7);
  if (id.license) doc.text(id.license, 50, 50, { charSpace: 1 });
  doc.setTextColor(...c.inkSoft);
  doc.setFontSize(8);
  doc.text(id.email, 50, id.license ? 64 : 50);

  // Divider rule
  doc.setDrawColor(...c.rule);
  doc.setLineWidth(0.4);
  doc.line(50, 110, w - 50, 110);

  return 130; // y cursor after header
};

BWC.pdfFooter = function (doc, pageNum, totalPages, brand) {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const c = BWC.colors;
  const id = BWC.brands[brand || "bwc"] || BWC.brands.bwc;

  doc.setDrawColor(...c.rule);
  doc.setLineWidth(0.4);
  doc.line(50, h - 50, w - 50, h - 50);

  doc.setTextColor(...c.inkFaint);
  doc.setFontSize(7);
  const footLeft = id.license ? id.name + "  \u00b7  " + id.license : id.name;
  doc.text(footLeft, 50, h - 35, {
    charSpace: 0.8,
  });
  doc.text(`Page ${pageNum} of ${totalPages}`, w - 50, h - 35, {
    align: "right",
  });
};

// Section heading helper
BWC.pdfSectionTitle = function (doc, y, num, title) {
  const c = BWC.colors;
  doc.setTextColor(...c.waveBlue);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), 50, y, { charSpace: 1.8 });

  // Roman numeral / ordinal on the right
  if (num) {
    doc.setTextColor(...c.deepNavy);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text(num, doc.internal.pageSize.getWidth() - 50, y, {
      align: "right",
    });
  }

  doc.setDrawColor(...c.rule);
  doc.setLineWidth(0.4);
  doc.line(50, y + 6, doc.internal.pageSize.getWidth() - 50, y + 6);

  return y + 22;
};

// Field label/value helper
BWC.pdfField = function (doc, x, y, label, value, options = {}) {
  const c = BWC.colors;
  doc.setTextColor(...c.inkFaint);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text(label.toUpperCase(), x, y, { charSpace: 1.2 });

  doc.setTextColor(...c.deepNavy);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(options.fontSize || 11);
  const valueY = y + 12;

  const v = value || "—";
  if (options.maxWidth) {
    const lines = doc.splitTextToSize(v, options.maxWidth);
    doc.text(lines, x, valueY);
    return valueY + lines.length * (options.fontSize || 11) * 1.15;
  } else {
    doc.text(v, x, valueY);
    return valueY + 6;
  }
};

// Page break helper — checks if there's room, adds page if not
BWC.ensureRoom = function (doc, currentY, neededHeight, opts) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + neededHeight > pageHeight - 90) {
    doc.addPage();
    return BWC.pdfHeader(doc, opts);
  }
  return currentY;
};

// Embed a JPEG photo at a target box (fits inside box, preserves aspect)
BWC.pdfPhoto = function (doc, dataUrl, x, y, boxW, boxH) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(boxW / img.width, boxH / img.height);
      const w = img.width * ratio;
      const h = img.height * ratio;
      const cx = x + (boxW - w) / 2;
      const cy = y + (boxH - h) / 2;
      doc.addImage(dataUrl, "JPEG", cx, cy, w, h);
      // border
      doc.setDrawColor(...BWC.colors.rule);
      doc.setLineWidth(0.3);
      doc.rect(x, y, boxW, boxH);
      resolve();
    };
    img.src = dataUrl;
  });
};
