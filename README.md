# Modular Investment Portfolio

A modular personal investment portfolio dashboard built with React, Vite, TypeScript, Tailwind CSS, Recharts, and browser `localStorage`.

This MVP is designed for manually maintained portfolios covering Taiwan stocks, Taiwan ETFs, crypto, and cash. It does not use a backend, login, Firebase, Supabase, GitHub Gist sync, API keys, brokerage connections, exchange account integrations, or ETF scraping.

## Features

- Add, edit, delete, and clear holdings.
- Store holdings locally in the user's browser with `localStorage`.
- Export and import JSON portfolio backups.
- Manually load clearly marked demo data.
- Manual current price entry for MVP valuation.
- TWD base currency with editable USD to TWD and USDT to TWD FX settings.
- Dashboard summary for total TWD value, holdings count, asset allocation, market allocation, currency allocation, and top holdings.
- Static/manual ETF component lookthrough for sample 0050, 006208, and 00878 data.
- ETF exposure table merges direct stock exposure with indirect ETF exposure when symbols match.
- GitHub Pages deployment workflow.

## Local Development

```bash
npm install
npm run dev
```

Build locally:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Storage Model

Portfolio holdings are stored only in the current browser under:

```text
modular-investment-portfolio:v1:holdings
```

FX settings are stored under:

```text
modular-investment-portfolio:v1:settings
```

This means every browser and device has separate data. Visitors to the GitHub Pages site do not share one portfolio, and the repository does not contain user portfolio data.

Warning: clearing browser site data, switching browsers, or using another device will not preserve the portfolio automatically. Use JSON export/import for backups.

## JSON Backup

Use the `持倉` page:

- `匯出 JSON` downloads the current holdings.
- `匯入 JSON` validates the file before replacing current holdings.
- Invalid JSON or invalid holding schema is rejected with an error message.

## Demo Portfolio

The app starts empty for new users. Demo data is never loaded automatically.

Use `載入展示投組` on the `持倉` page to manually replace the current portfolio with sample demo data.

## ETF Component Data

Static ETF component data lives in:

```text
src/data/etfComponents.ts
```

The included 0050, 006208, and 00878 component data is approximate sample/manual data for MVP testing. Update `components`, `sourceNote`, and `lastUpdated` manually before using it for real analysis.

## GitHub Pages Deployment

The workflow is located at:

```text
.github/workflows/deploy.yml
```

It runs on pushes to `main`, installs dependencies with `npm ci`, builds the Vite app, uploads `dist`, and deploys to GitHub Pages using the official Pages actions.

In the GitHub repository settings, enable GitHub Pages with GitHub Actions as the source.

## Vite Base Path

The app is configured for a GitHub Pages project site named `investment-portfolio`:

```ts
base: process.env.NODE_ENV === "production" ? "/investment-portfolio/" : "/"
```

If the repository name is different, update the base path in `vite.config.ts`.

## Known MVP Limitations

- Prices are manually entered.
- No automatic price updates.
- No brokerage, exchange, or trading integration.
- ETF component data is static sample/manual data.
- Data is local to each browser and is not synced across devices.
