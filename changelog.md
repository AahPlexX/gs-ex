# Changelog

## 2026-07-12

### Added

- `manifest.json` — established the minimal Manifest V3 extension surface with an action, an event-driven service worker, and only the `activeTab`, `scripting`, and `downloads` permissions required by the current one-click export workflow. Persistent host permissions were intentionally omitted.
- `service-worker.js` — added the first fully wired exporter slice. Clicking the extension action on a Genspark page now captures a normalized structured snapshot, classifies Slides, Pages, Documents, and unknown artifact types, preserves visible text/headings/links/images/slide candidates, validates empty/error paths, sanitizes filenames, and writes a local `.genspark.json` download.
- `repo-map.md` — recorded the verified commands, entry point, permission posture, export contract, and next implementation phase so later sessions can revalidate rather than reconstruct these durable facts.
