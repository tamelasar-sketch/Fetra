# Fetra with no internet (25 Oct 2026)

- `offline.js` (patched in by `patch_offline.py`, goes before every other script): adds the **Offline** button in the header.
  - In the main app (claude.ai) it keeps a copy of every record in this device's storage, and offers *Save data for the offline copy* (a `Fetra-data-<date>.json` file) and *Bring in changes* (reads a `Fetra-changes-<date>.json` file and writes each record to the shared db).
  - In an offline copy (`window.FETRA_OFFLINE` set) it stands in for claude.ai's `db`, `user` and `downloads` with the device's own storage, counts every change ("Offline copy · 3 to send"), and saves them as a changes file. *Load fresh data* takes a data file from the main app and keeps unsent changes on top.
  - Absent offline (need claude.ai or internet): Shatta's free questions to Claude (typed built-in commands still work), reading photos of paper sheets, live weather (last forecast stays), map links.
- `build_offline.py <patched app.html> <data file or record folder> <repo dir> <passcode>` makes
  - `<repo>/app/app.enc` + `sw.js`: the installable copy at https://tamelasar-sketch.github.io/Fetra/app/ (locked with the passcode, AES-GCM, PBKDF2 310k), kept on the phone by the service worker.
  - `Fetra-offline.html`: one file for Windows, double-click to open, no internet needed. **Not locked: it holds the farm and family figures. Keep it private.**
- Rebuild after the app changes, or the offline copy keeps the older screens (its records still move both ways).
- `sw.template.js`: the service worker template (the build stamps a version so phones fetch the new build).
