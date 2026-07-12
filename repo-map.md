# Repository Map

## Product

Google Chrome extension that exports user-opened Genspark artifacts to local files. The target scope includes Slides, Pages, Documents, and newly encountered artifact types through a normalized capture contract.

## Current phase

Phase 1: generic structured capture. A user clicks the extension action while viewing a Genspark artifact and receives a local `.genspark.json` snapshot.

## Entry points

- `manifest.json` — Manifest V3 capability and permission source of truth.
- `service-worker.js` — action handler, active-tab validation, DOM capture injection, artifact normalization, error state, filename sanitation, and download orchestration.

## Permissions

- `activeTab` — temporary access only after the user clicks the extension action.
- `scripting` — injects the bundled capture function into the active tab.
- `downloads` — saves the generated export locally.
- No persistent `host_permissions` are currently declared.

## Export contract

Schema version: `1`.

Top-level fields:

- `schemaVersion`
- `source`: application, URL, title, capture timestamp, and language.
- `artifact`: detected type, title, description, visible text, headings, links, images, and slide candidates.

Artifact types currently emitted:

- `slides`
- `page`
- `document`
- `unknown`

## Commands

There is currently no package manager, build step, linter, or automated test runner. The extension is plain bundled JavaScript and JSON and is loaded unpacked through `chrome://extensions`.

## Verification

Current manual verification path:

1. Enable Developer mode in `chrome://extensions`.
2. Load the repository directory as an unpacked extension.
3. Open a Genspark artifact.
4. Click the extension action.
5. Confirm a `.genspark.json` save dialog appears and the resulting file contains schema version `1` with non-empty artifact content.

## Next phase

Add deterministic fixture-based contract tests without requiring a browser, then split site-specific extraction rules from generic fallback capture only after real Genspark DOM samples establish stable selectors. Native PPTX/PDF/HTML/Markdown export should consume the normalized contract rather than duplicate capture logic.
