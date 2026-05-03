# Blue Wave Construction — Field Forms (v3)

Mobile-first field forms for property inspections and walkthrough estimates. Hosted on GitHub Pages, runs entirely in the browser, no backend needed.

**Live:** https://beachbum420.github.io/bluewave-forms/

---

## What's in this folder

| File | Purpose |
|---|---|
| `index.html` | Landing page with the two tool cards |
| `inspection.html` | Property & unit inspection form |
| `inspection.js` | Inspection form logic + PDF generation |
| `walkthrough.html` | Jobsite walkthrough estimate form |
| `walkthrough.js` | Estimate form logic + PDF generation |
| `shared.js` | Shared helpers — PDF header/footer, photos, autosave |
| `styles.css` | All styling — Blue Wave brand system |
| `assets/` | SVG logos |

---

## V3 — What's different from v2

**Simplified inspection form:**
- Removed mode toggle entirely — one form optimized for apartments, handles SFRs through universal issue cards
- Wet areas collapsed to a single status (Good / Issue / Repaired) per area instead of 6+ toggles
- Quick-add chips no longer scroll the page — confirmation toast slides in from the bottom
- Editable catalog (mirrors walkthrough's pattern) — add, remove, edit prices, set which sections each chip appears in

**Universal Issues system:**
- Quick-add chips, section "Add Issue" buttons, and the manual button all create issue cards
- Status (Informational / Repaired On-Site / Needs Estimate) drives where the item routes
- Repaired → invoice (capped at $500), Needs Estimate → walkthrough handoff, Informational → report only
- One unified data model, clean JSON export structure for OpenClaw

**Bug fixes from v2:**
- Wet area photo bug fixed (auto-seeded areas now properly initialize photos array)
- All photo-handling paths use the same defensive pattern

**What stayed exactly the same:**
- Walkthrough form (untouched)
- Brand, header, footer, PDF style
- Auto-save, ID generation
- Photo Appendix in PDF

---

## Workflow

### Inspection
1. Open the form, fill in property info (address, unit, date)
2. Rate overall condition + add overview photos
3. Run through life-safety, water inspection, water heater, hazards
4. Use quick-add chips OR "Add Issue" buttons in each section to log repairs/issues
5. Each issue gets status: Informational / Repaired / Needs Estimate
6. Repaired items → auto-populate the on-site invoice (capped at $500)
7. Estimate items → "→ Walkthrough" button hands them off
8. Generate PDF

### Walkthrough
Same as before — catalog tap-to-add line items, generate estimate PDF.

---

## Catalog Management

The inspection form has its own editable catalog (separate from the walkthrough's). Tap "Manage Catalog" above the Issues section to:
- Edit prices, descriptions, names
- Add custom items
- Set which sections each item appears in (Life-Safety, Water, Water Heater, Full Catalog)
- Remove items

Catalog persists in localStorage on the device.

---

## Deploy

1. Push these files to your `bluewave-forms` repo on `main`
2. GitHub Pages serves from `main` branch root
3. Live in 1-2 minutes

---

## License

- Brand: Blue Wave Construction
- License: CA GC #1153965
- Document IDs:
  - `BWC-INS-2026-0001` (inspection reports)
  - `BWC-INV-2026-0001` (invoices, embedded in inspections)
  - `BWC-EST-2026-0001` (estimates from walkthrough form)
