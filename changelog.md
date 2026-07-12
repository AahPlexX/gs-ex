# Changelog

## 2026-07-12

### Added

- `manifest.json` — established the minimal Manifest V3 extension surface with an action, an event-driven service worker, and only the `activeTab`, `scripting`, and `downloads` permissions required by the current one-click export workflow. Persistent host permissions were intentionally omitted.
- `service-worker.js` — added the first fully wired exporter slice. Clicking the extension action on a Genspark page now captures a normalized structured snapshot, classifies Slides, Pages, Documents, and unknown artifact types, preserves visible text/headings/links/images/slide candidates, validates empty/error paths, sanitizes filenames, and writes a local `.genspark.json` download.
- `repo-map.md` — recorded the verified commands, entry point, permission posture, export contract, and next implementation phase so later sessions can revalidate rather than reconstruct these durable facts.
- `docs/superpowers/plans/2026-07-12-extraction-contract.md` — recorded the bounded TDD plan for separating browser extraction from service-worker orchestration.
- `tests/extractor.test.js` — added dependency-free contract tests using Node's built-in runner for artifact classification, whitespace normalization, URL resolution, title selection, and the exact schema-versioned export shape.
- `extractor.js` — added the reusable packaged extraction module. It exposes pure contract helpers for tests and a browser-facing `captureArtifact()` API for injected execution.

### Changed

- `service-worker.js` — removed the duplicated inline DOM extractor and now injects `extractor.js` before invoking `globalThis.GensparkExporter.captureArtifact()`. Host validation, empty-content rejection, filename sanitation, save-as behavior, and explicit badge/error states remain intact.
- `repo-map.md` — added the extraction module, its public API, the built-in test command, and the next serializer phase.

### Verification

- Confirmed the RED state with `node --test tests/extractor.test.js`: the suite failed because `../extractor.js` did not exist.
- Confirmed the GREEN state with `node --test tests/extractor.test.js`: all three tests passed.
- Confirmed syntax with `node --check extractor.js` and `node --check service-worker.js`.
