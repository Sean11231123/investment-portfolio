# Changelog

## 0.2.0 - Phase 5 Release

### Theme, Taiwan Market Coverage, Macro Indicators

This release packages the Phase 5K through Phase 5N work into a formal app release.

### Highlights

- Added dark/light theme support.
- Added TPEx OTC asset universe support for searchable 上櫃 stocks and ETFs.
- Added TPEx OTC static price coverage from official TPEx daily close data.
- Added a user-facing `總經` page.
- Added US CPI, Core CPI, PPI final demand, and unemployment data from the BLS public no-key API.
- Added FOMC official event metadata from Federal Reserve sources.
- Added macro data service/status handling and Settings diagnostics.
- Completed release QA / UX polish pass.

### Details

- TWSE listed stocks and ETFs remain searchable and priced from the existing TWSE static price pipeline.
- TPEx OTC assets are searchable and priced when TPEx provides valid daily close data.
- Missing prices remain unavailable/null and are never treated as `0`.
- ETF component availability remains separate from price availability.
- Macro data is informational only.
- The app does not provide investment advice, market predictions, FOMC sentiment labels, statement summaries, or buy/sell signals.

### Out Of Scope

- Taiwan macro indicators.
- Emerging stocks.
- Fund NAV.
- FRED / BEA / DXY data.
- FOMC summaries or sentiment analysis.
- Backend/cloud sync, brokerage sync, or API keys.

### Validation Summary

- `npm run build` passed.
- `npm run test` passed.
- Python data pipeline tests passed.
- ETF component validation passed.
- PWA production build passed.
