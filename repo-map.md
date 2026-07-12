# Repository Map

## Product

Google Chrome extension that exports user-opened Genspark artifacts to local files. The target scope includes Slides, Pages, Documents, and newly encountered artifact types through a normalized capture contract.

## Current phase

Phase 1: generic structured capture with a reusable extraction contract. A user clicks the extension action while viewing a Genspark artifact and receives a local `.genspark.json` snapshot.

## Entry points

- `manifest.json` — Manifest V3 capability and permission source of truth.
- `service-worker.js` — action handler, active-tab validation, packaged extractor injection, error state, filename sanitation, and download orchestration.
- `extractor.js` — DOM collection, artifact classification, normalization, URL resolution, and schema construction.

## Extraction API

`extractor.js` exposes `globalThis.GensparkExporter` in the injected page context and CommonJS exports in Node tests:

- `captureArtifact()`
- `classifyArtifact(input)`
- `createArtifactCapture(input)`
- `normalizeText(value)`

## Permissions

- `activeTab` — temporary access only after the user clicks the extension action.
- `scripting` — injects the bundled extraction module into the active tab.
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

There is no package manager, build step, or third-party test dependency.

- Test: `node --test tests/extractor.test.js`
- Syntax: `node --check extractor.js && node --check service-worker.js`
- Runtime: load the repository unpacked through `chrome://extensions`.

## Verification

Automated contract verification covers classification, whitespace normalization, relative URL resolution, title selection, and the exact schema-versioned output shape.

Manual browser verification path:

1. Enable Developer mode in `chrome://extensions`.
2. Load the repository directory as an unpacked extension.
3. Open a Genspark artifact.
4. Click the extension action.
5. Confirm a `.genspark.json` save dialog appears and the resulting file contains schema version `1` with non-empty artifact content.

## Next phase

Add Markdown and standalone HTML serializers that consume the normalized contract, with tests written before implementation. Site-specific selector rules remain deferred until real Genspark DOM samples establish stable evidence. Native PPTX and PDF export must consume the same contract rather than duplicate capture logic.
