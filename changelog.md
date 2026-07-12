# Changelog

## 2026-07-12

### Added

- `manifest.json` — established the minimal Manifest V3 extension surface with an action, an event-driven service worker, and only the `activeTab`, `scripting`, and `downloads` permissions required by the current one-click export workflow. Persistent host permissions were intentionally omitted.
- `service-worker.js` — added the first fully wired exporter slice. Clicking the extension action on a Genspark page now captures a normalized structured snapshot, classifies Slides, Pages, Documents, and unknown artifact types, preserves visible text/headings/links/images/slide candidates, validates empty/error paths, sanitizes filenames, and writes a local `.genspark.json` download.
- `repo-map.md` — recorded the verified commands, entry point, permission posture, export contract, and next implementation phase so later sessions can revalidate rather than reconstruct these durable facts.
- `docs/superpowers/plans/2026-07-12-extraction-contract.md` — recorded the bounded TDD plan for separating browser extraction from service-worker orchestration.
- `tests/extractor.test.js` — added dependency-free contract tests using Node's built-in runner for artifact classification, whitespace normalization, URL resolution, title selection, and the exact schema-versioned export shape.
- `extractor.js` — added the reusable packaged extraction module. It exposes pure contract helpers for tests and a browser-facing `captureArtifact()` API for injected execution.
- `docs/superpowers/plans/2026-07-12-multi-format-serialization.md` — recorded the bounded TDD plan for safe JSON, Markdown, and standalone HTML serialization plus one-capture bundle downloads.
- `serializers.js` — added the dependency-free serialization boundary for schema version 1 captures. It emits deterministic JSON, readable Markdown, and semantic standalone HTML while escaping untrusted page data and excluding non-HTTP(S) resource URLs.

### Changed

- `service-worker.js` — removed the duplicated inline DOM extractor and now injects `extractor.js` before invoking `globalThis.GensparkExporter.captureArtifact()`. Host validation, empty-content rejection, filename sanitation, save-as behavior, and explicit badge/error states remain intact.
- `repo-map.md` — added the extraction module, its public API, the built-in test command, and the next serializer phase.
- `tests/extractor.test.js` — consolidated serializer coverage into the existing Node test file instead of adding another test file or dependency. Added table-driven format metadata, JSON fidelity, Markdown URL safety, HTML escaping/CSP, malformed-capture, and unsupported-format coverage.
- `service-worker.js` — now loads `serializers.js`, captures once, and sequentially downloads JSON, Markdown, and standalone HTML into `Downloads/Genspark Exports/<artifact title>/`. The action badge reports three completed outputs and no new permission was added.
- `manifest.json` — updated the user-facing description and incremented the extension version to `0.2.0` for the multi-format export capability; the permission set remains unchanged.
- `repo-map.md` — updated the current phase, serializer API, download behavior, verification commands, and next popup/fixture phase.

### Verification

- Confirmed the RED state with `node --test tests/extractor.test.js`: the suite failed because `../extractor.js` did not exist.
- Confirmed the GREEN state with `node --test tests/extractor.test.js`: all three tests passed.
- Confirmed syntax with `node --check extractor.js` and `node --check service-worker.js`.
- Confirmed the multi-format RED state with `node --test tests/extractor.test.js`: the suite failed because `../serializers.js` did not exist.
- Confirmed the multi-format GREEN state with `node --test tests/extractor.test.js`: all seven tests passed.
- Confirmed syntax with `node --check extractor.js`, `node --check serializers.js`, and `node --check service-worker.js`.
