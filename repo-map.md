# Repository Map

## Product

Google Chrome extension that exports user-opened Genspark artifacts to local files. The target scope includes Slides, Pages, Documents, and newly encountered artifact types through a normalized capture contract.

## Current phase

Phase 2: dependency-free multi-format export. One action click captures the active Genspark artifact once and writes JSON, Markdown, and standalone HTML files under `Downloads/Genspark Exports/<artifact title>/`.

## Entry points

- `manifest.json` — Manifest V3 capability, version, and permission source of truth.
- `service-worker.js` — action handler, active-tab validation, packaged extractor injection, serializer orchestration, error state, filename sanitation, and bundle downloads.
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

## Permissions

- `activeTab` — temporary access only after the user clicks the extension action.
- `scripting` — injects the bundled extraction module into the active tab.
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
- Syntax: `node --check extractor.js && node --check serializers.js && node --check service-worker.js`
- Manifest parse: `node -e "JSON.parse(require('node:fs').readFileSync('manifest.json', 'utf8'))"`
- Runtime: load the repository unpacked through `chrome://extensions`.

## Verification

Automated contract verification covers classification, whitespace normalization, relative URL resolution, title selection, the exact schema-versioned output shape, serializer metadata, JSON fidelity, Markdown URL safety, HTML escaping/CSP, malformed captures, and unsupported formats.

Manual browser verification path:

1. Enable Developer mode in `chrome://extensions`.
2. Load the repository directory as an unpacked extension.
3. Open a Genspark artifact.
4. Click the extension action.
5. Confirm the action badge shows `3`.
6. Confirm JSON, Markdown, and HTML files appear under `Downloads/Genspark Exports/<artifact title>/`.
7. Open the HTML file and confirm captured content is readable without executable page scripts.

## Next phase

Add an accessible action popup for choosing one format or the complete bundle, using runtime messaging without adding permissions. Then capture authenticated real Genspark DOM fixtures so site-specific selectors are based on observed evidence rather than guesses. Asset packaging, PDF, and PPTX feasibility work must continue to consume the same normalized contract.
