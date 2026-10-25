# Fetra black box (25 Oct 2026)

An Excel copy of everything in the app, kept on each device, that opens with no internet in Excel (Windows, Mac, iPhone) or Numbers, can be edited by hand, and loads back into the app.

## Files
- `xlsx-core.js`: writes and reads .xlsx with no library and no internet (store-only zip; reader handles files re-saved by Excel, Numbers, LibreOffice). Works in the browser and in Node.
- `bb-data.js`: records → sheets, and an edited workbook → record changes.
  - One sheet per collection (To-dos, My notes, Banana trucks, …), column A `record` = the record's path. To-do `pri` cells are coloured red/amber/green.
  - `App · …` sheets: the figures built into the app (sales, plots, herd, prices, family payouts, …). Read only.
  - Hidden `_index` (sheet → collection) and `_base` (each record as saved, JSON). On loading, only cells changed in Excel are applied, on top of the app's current record, so newer app changes are not undone.
  - New rows (empty `record` cell) are added on: todos, bbnotes, trucks, spend, shifts, feedlog, stock, tagevents, sickrounds, fieldcounts, costs. New to-dos get `pri` (red/amber/green words, or Shatta's autoPri, or the built-in word list), `farm` (TF/TV/FF guessed from the words), `kind` Plan, `grp` Other, `src` excel. The same new row loaded twice is skipped.
- `blackbox.js`: the Black box button, sheet and reminder bar.
  - Laptop, Chrome/Edge, page not inside claude.ai (the offline copy or installed app): pick a folder once (+ an optional synced one). `Fetra-black-box.xlsx` is rewritten 4 s after each change, when the page is hidden/closed, every 2 min while changes are waiting; plus `Daily copies/Fetra-black-box-YYYY-MM-DD.xlsx`. Handles are kept in IndexedDB `fetraBlackBox`. If the browser drops the permission, the bar asks for one tap (Allow). If the file on disk was changed by hand since the app wrote it, the app does not overwrite it and asks: load my changes / replace with the app's.
  - claude.ai (in a frame, no folder access) and iPhone: one-tap Save now (claude.ai `downloads`, iPhone share sheet → Save to Files → On My iPhone). The bar reminds when the last copy is over 20 h old (✕ hides it for the day). State in localStorage `fetraBB`.
- `patch_blackbox.py <app.html> <this dir>`: puts the three files (+ `window.fetraTables`) in one `<script id="fetra-blackbox">` right after the app's main script. Run after `../offline/patch_offline.py` (offline.js now exposes `fetraOffline.records()`, `writeDoc()`, fires `fetra-change`, and mirrors the new `bbnotes` collection).
- `build_blackbox.js <records dir> <app.html> <out.xlsx>` (Node): Claude's copy, from an ArtifactData `out_dir` dump of every collection plus the figures in the app html.

## Claude's copy
`/mnt/project-files/farm-app/black-box/Fetra-black-box.xlsx` (+ `daily/Fetra-black-box-YYYY-MM-DD.xlsx`), rebuilt every night by the scheduled task "Fetra black box nightly copy":
1. ArtifactData `list` (limit 1000, `out_dir` = a scratch folder) for every collection: approvals roles fieldcounts sickrounds trucks costs weather shifts todos spend export tags tagevents stock feedlog briefs paper paperscans bbnotes outbox (and outbox/<id>/bank|transfers|requests|sent|progress for each outbox/roles id) on https://claude.ai/artifact/8JDUdbDysPYgLj79BWNzc4.
2. `node build_blackbox.js <scratch folder> ../farm-ledger-draft.html <out.xlsx>`.

To read T's hand edits: T uploads the file, or Claude reads it from the project folder: `node -e` with `require('./xlsx-core.js').read(bytes)` then `require('./bb-data.js').changes(sheets, records)` lists what T changed.

## Build order
leaks, views, paper, calm, i18n, shatta are already in `farm-ledger-draft.html`. Then: `patch_offline.py`, `patch_blackbox.py`, wrap in the published page skeleton for `build_offline.py`.
