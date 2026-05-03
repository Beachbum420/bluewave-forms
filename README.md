# Blue Wave Construction — Field Forms (v3 + Customer Intake)

Mobile-first forms for property inspections, walkthrough estimates, and customer project intake.

**Live:** https://beachbum420.github.io/bluewave-forms/

---

## What's in this folder

| File | Purpose | Audience |
|---|---|---|
| `index.html` | Landing page — your two internal tools | You |
| `inspection.html` | Property & unit inspection form | You (in field) |
| `inspection.js` | Inspection logic + PDF generation | — |
| `walkthrough.html` | Jobsite walkthrough estimate | You (with customer) |
| `walkthrough.js` | Walkthrough logic + PDF | — |
| `customer-intake.html` | **NEW** — Customer-fills-it-out punchlist intake | Your customers |
| `customer-intake.js` | Intake logic + Formspree submission | — |
| `shared.js` | Shared helpers (PDF, photos, autosave) | — |
| `styles.css` | Brand styling for everything | — |

---

## Customer Intake — Setup (one-time)

The intake form needs to know where to send submissions. Set this up once:

1. Sign up at https://formspree.io (free tier: 50 submissions/month)
2. Create a new form, set delivery email to `ryanverbiest@gmail.com`
3. Copy your form endpoint URL (looks like `https://formspree.io/f/xkgjabcd`)
4. Open `customer-intake.js` in your editor
5. Find this line near the top:
   ```javascript
   const FORMSPREE_ENDPOINT = "";
   ```
6. Paste your URL between the quotes:
   ```javascript
   const FORMSPREE_ENDPOINT = "https://formspree.io/f/xkgjabcd";
   ```
7. Save, push to GitHub. Done.

If you skip this, the form will download submissions as JSON files instead — useful for testing.

---

## How to share the intake form with customers

Once deployed, the URL is:

```
https://beachbum420.github.io/bluewave-forms/customer-intake.html
```

Text or email that link. Customers fill it out on their phone, hit submit, you get an email with all the details + photos as attachments.

**Customer experience:**
1. Opens link → sees Blue Wave branded form
2. Fills in contact info, property address, project overview
3. Adds line items with descriptions + photos (3 max per item)
4. Hits "Send to Blue Wave"
5. Gets a confirmation screen with a request ID

**Your experience:**
1. Get an email from Formspree with all the info formatted neatly
2. Photos arrive as attachments
3. Review, prep an estimate (in your walkthrough form), send it back
4. Eventually OpenClaw will read submissions and draft estimates automatically

---

## V3 — Inspection form changes (from v2)

- Removed mode toggle — one simplified form
- Wet areas are one-line (Good / Issue / Repaired) instead of 6+ toggles
- Quick-add chips no longer scroll the page (toast confirmation slides in)
- Editable catalog (mirrors walkthrough's pattern)
- Universal `issues[]` system — clean JSON for OpenClaw

---

## Deploy

1. Push to your `bluewave-forms` repo on `main`
2. GitHub Pages serves from `main` branch root
3. Live in 1-2 minutes

If using Claude Code: `cd ~/path/to/bluewave-forms && git add . && git commit -m "v3 + customer intake" && git push`

---

## ID Format

- `BWC-INS-2026-0001` (inspection reports)
- `BWC-INV-2026-0001` (invoices)
- `BWC-EST-2026-0001` (estimates from walkthrough)
- `BWC-REQ-2026-XXXXXX` (customer intake requests — last 6 digits of timestamp)
