# FinLens — landing page

FinLens is a subscription web app (**₹499/month**) for investors, CA firms, MBA students and finance analysts. You upload a company's financial statements — annual report, balance sheet, P&L, cash flow — and instantly get a full analysis: SWOT, financial ratios, a risk score, an AI-written summary, peer comparison and charts.

This repository currently contains the FinLens **landing page**: it explains the product, names who it's for, shows the ₹499/month price, and captures early interest with a waitlist. The analyzer engine is the next build.

## Stack

TanStack Start (React + Vite) with Tailwind CSS. The waitlist form posts to a TanStack Start server function (`src/lib/waitlist.ts`), which appends emails to `waitlist.json` in the app directory (created on first use, git-ignored).

## Run locally

```bash
bun install
bun run dev      # dev server
bun run build    # production build
```

## Layout

- `src/routes/index.tsx` — the landing page
- `src/routes/__root.tsx` — document shell
- `src/styles/app.css` — Tailwind entry and theme
- `src/lib/waitlist.ts` — waitlist server function

## Licence

GNU Affero General Public License v3.0 — see [LICENSE](./LICENSE).
