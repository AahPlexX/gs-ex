# Repository Map

## Product

Google Chrome extension that exports user-opened Genspark artifacts to local files. The target scope includes Slides, Pages, Documents, and newly encountered artifact types through a normalized capture contract.

## Current phase

Phase 3: accessible selected-format export. Clicking the extension action opens a popup where the user chooses JSON, Markdown, standalone HTML, or a complete three-file bundle. One validated message captures the active Genspark artifact once and downloads only the requested formats.

## Entry points

- `manifest.json` — Manifest V3 capability, version, popup, and permission source of truth.
- `popup.html` — semantic action-popup form and accessible status surface.
- `popup.js` — selection-to-message mapping, active-tab lookup, runtime request, busy state, and result messaging.
- `service-worker.js` — request validation, active-tab/host validation, packaged extractor injection, serializer orchestration, badge/error state, and selected-format downloads.
- `extractor.js` — DOM collection, artifact classification, normalization, URL resolution, and schema construction.
- `serializers.js` — schema validation plus JSON, Markdown, and safe standalone HTML serialization.

## Extraction API

`extractor.js` exposes `globalThis.GensparkExporter` in the injected page context and CommonJS exports in Node tests:

- `captureArtifact()`
- `classifyArtifact(input)`
- `createArtifactCapture(input)`
- `normalizeText(value)`

## Serialization API

`serializers.js` exposes `globalThis.GensparkSerializers` in the extension service worker and CommonJS exports in Node tests:

- `serializeCapture(capture, format)`

Supported formats and filename suffixes:

- `json` → `.genspark.json`
- `markdown` → `.md`
- `html` → `.html`

Rendered Markdown and HTML include only HTTP(S) links and image resources. Standalone HTML escapes all captured page data, contains no script, and declares a restrictive Content Security Policy.

## Popup and message contract

`popup.js` exposes `createExportMessage(selection, tabId)` in Node tests.

Selections:

- `json`
- `markdown`
- `html`
- `bundle` → `json`, `markdown`, and `html`

Runtime request:

```text
{ type: "export-artifact", tabId: positive integer, formats: non-empty supported string array }
```

Service-worker response:

```text
{ ok: true, count, formats }
```

or:

```text
{ ok: false, error }
```

The worker ignores unrelated messages, deduplicates formats, rejects malformed input, and returns literal `true` while the asynchronous response channel remains open.

## Permissions

- `activeTab` — temporary access after the user invokes the extension action.
- `scripting` — injects the bundled extraction module into the selected tab.
- `downloads` — saves generated exports locally.
- No persistent `host_permissions` are declared.

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
- Syntax: `node --check extractor.js && node --check serializers.js && node --check service-worker.js && node --check popup.js`
- Manifest parse: `node -e "JSON.parse(require('node:fs').readFileSync('manifest.json', 'utf8'))"`
- Runtime: load the repository unpacked through `chrome://extensions`.

## Verification

Automated contract verification covers extraction, schema normalization, serializer safety, popup request construction, service-worker request validation, format deduplication, malformed-message rejection, and success-response metadata.

Manual browser verification path:

1. Enable Developer mode in `chrome://extensions`.
2. Load the repository directory as an unpacked extension.
3. Open a Genspark artifact.
4. Click the extension action and confirm the format popup opens.
5. Export each single format and confirm exactly one matching file appears under `Downloads/Genspark Exports/<artifact title>/`.
6. Export the complete bundle and confirm JSON, Markdown, and HTML files appear.
7. Confirm the popup reports success or a specific failure and the action badge reports the exported file count.
8. Open the HTML file and confirm captured content is readable without executable page scripts.

## Next phase

Capture authenticated, sanitized Genspark DOM fixtures for Slides, Pages, and Documents, then add only selector adapters supported by those observed fixtures. Asset packaging, PDF export, and PPTX feasibility work must continue to consume the same normalized contract rather than duplicate capture logic.
