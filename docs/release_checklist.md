# Release Checklist

## Pre-release

- [ ] Confirm `git status --short` contains only intended release changes.
- [ ] Run `npm run build`.
- [ ] Run `npm run test`.
- [ ] Run `python scripts/test_update_tw_asset_universe.py`.
- [ ] Run `python scripts/test_update_tw_prices.py`.
- [ ] Run `python scripts/test_update_tpex_otc_prices.py`.
- [ ] Run `python scripts/test_update_macro_indicators.py`.
- [ ] Run `python scripts/test_update_macro_events.py`.
- [ ] Run `npm run validate:etf-components`.
- [ ] Run `npm run test:etf-normalizer`.
- [ ] Run `npm run test:us-etf-components`.
- [ ] Run `git diff --check`.

## Manual Smoke

Desktop:

- [ ] `總覽` renders portfolio summary and charts.
- [ ] `持倉` supports add/edit/delete holdings.
- [ ] `ETF` renders lookthrough data and unexpanded ETF labels.
- [ ] `總經` renders macro indicators and FOMC cards.
- [ ] `設定` renders backup/restore, theme controls, and diagnostics.

Mobile:

- [ ] Five-tab bottom navigation is usable.
- [ ] Dark theme is readable.
- [ ] Light theme is readable.
- [ ] PWA install/open works.

Sample assets:

- [ ] `0050` is searchable/priced if TWSE provides price.
- [ ] `00981A` is searchable/priced if TWSE provides price.
- [ ] `2603` is searchable/priced if TWSE provides price.
- [ ] `8069` is searchable/priced if TPEx provides price.
- [ ] `006201` is searchable/priced if TPEx provides price.
- [ ] `1785` is searchable/priced if TPEx provides price.
- [ ] `6187` is searchable/priced if TPEx provides price.

Macro:

- [ ] CPI / Core CPI / PPI / Unemployment cards are visible.
- [ ] Latest and next FOMC cards are visible.
- [ ] Official FOMC links open in a new tab.
- [ ] No advice, prediction, sentiment, or buy/sell wording appears.

## Release

- [ ] Commit release changes.
- [ ] Push `main`.
- [ ] Confirm CI passes.
- [ ] Confirm GitHub Pages deployment succeeds.
- [ ] Create a git tag if desired.
- [ ] Create a GitHub Release if desired.
