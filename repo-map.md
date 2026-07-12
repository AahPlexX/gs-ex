# Repository Map

## Product

Google Chrome extension that exports user-opened Genspark artifacts to local files. Target scope includes Slides, Pages, Documents, and newly encountered artifact types through a normalized capture contract.

## Current phase

Phase 4: privacy-preserving structural diagnostics. The popup can export JSON, Markdown, standalone HTML, or a complete bundle, and can separately download a local sanitized diagnostic used to derive artifact-specific selectors from observed authenticated Genspark structure.

## Entry points

- `manifest.json` — Manifest V3 capability, version, popup, service worker, and permission source of truth.
- `popup.html` — semantic export form, separate diagnostic action, privacy disclosure, and accessible status surface.
- `popup.js` — export/diagnostic message construction, active-tab lookup, shared busy state, runtime requests, and result messaging.
- `service-worker.js` — request validation, Genspark-host validation, packaged module injection, serialization/download orchestration, badge/error states, and timestamp-only diagnostic downloads.
- `extractor.js` — generic DOM collection, artifact classification, normalization, URL resolution, and artifact schema construction.
- `serializers.js` — schema validation plus JSON, Markdown, and safe standalone HTML serialization.
- `diagnostics.js` — bounded structural collection and conservative privacy sanitization for evidence-based selector discovery.

## Artifact extraction API

`extractor.js` exposes `globalThis.GensparkExporter` in the injected page context and CommonJS exports in Node tests:

- `captureArtifact()`
- `classifyArtifact(input)`
- `createArtifactCapture(input)`
- `normalizeText(value)`

Artifact schema version: `1`.

Artifact types:

- `slides`
- `page`
- `document`
- `unknown`

## Serialization API

`serializers.js` exposes `globalThis.GensparkSerializers` in the service worker and CommonJS exports in tests:

- `serializeCapture(capture, format)`

Formats:

- `json` → `.genspark.json`
- `markdown` → `.md`
- `html` → `.html`

Markdown and HTML retain only HTTP(S) links/resources. Standalone HTML escapes captured data, contains no script, and declares a restrictive Content Security Policy.

## Diagnostic API

`diagnostics.js` exposes `globalThis.GensparkDiagnostics` in the injected page context and CommonJS exports in tests:

- `captureDiagnostic()`
- `createDiagnosticSnapshot(input)`
- `sanitizeIdentifier(value)`
- `sanitizeUrlShape(value, baseUrl)`

Diagnostic schema version: `1` through `diagnosticSchemaVersion`.

Hard bounds:

- Maximum scanned elements: `5000`
- Maximum candidates: `150`
- Maximum repeated structures: `50`
- Maximum safe identifier length: `64`

Privacy contract:

- No raw artifact text or document titles are stored.
- Text and title lengths may be stored as numeric metadata.
- Emails, UUIDs, long numbers, long hex/base64-like values, data URLs, and token/session/auth-like values are rejected.
- URLs are restricted to HTTPS Genspark origins and reduced to sanitized route shapes; queries, fragments, credentials, and private path segments are excluded.
- Diagnostic collection makes no network request and reads no cookies, storage, request bodies, response bodies, or authentication state.

Diagnostic output:

```text
Genspark Diagnostics/genspark-diagnostic-<UTC timestamp>.json
```

## Popup and message contracts

Normal export request:

```text
{ type: "export-artifact", tabId: positive integer, formats: non-empty supported string array }
```

Normal export success:

```text
{ ok: true, count, formats }
```

Diagnostic request:

```text
{ type: "capture-diagnostic", tabId: positive integer }
```

Diagnostic success:

```text
{ ok: true, count: 1, kind: "diagnostic" }
```

Failure response:

```text
{ ok: false, error }
```

The top-level worker listener ignores unrelated messages, validates each request, returns literal `true` while its asynchronous response channel is open, and does not rely on in-memory state surviving service-worker restart.

## Permissions

- `activeTab` — temporary active-page access after the user invokes the extension action.
- `scripting` — injects packaged extraction or diagnostic modules into the selected tab's main frame in the default isolated world.
- `downloads` — saves generated exports and diagnostics locally.
- No persistent `host_permissions` are declared.

## Commands

There is no package manager, build step, or third-party test dependency.

- Test: `node --test tests/extractor.test.js`
- Syntax: `node --check extractor.js && node --check serializers.js && node --check diagnostics.js && node --check service-worker.js && node --check popup.js`
- Manifest parse: `node -e "JSON.parse(require('node:fs').readFileSync('manifest.json', 'utf8'))"`
- Runtime: load the repository unpacked through `chrome://extensions`.

## Automated verification

The current suite covers:

- Artifact classification and normalized schema construction.
- JSON, Markdown, and HTML safety/metadata.
- Popup export and diagnostic request construction.
- Service-worker request validation and response metadata.
- Diagnostic identifier and URL sanitization.
- Private-content exclusion and deterministic output caps.
- Timestamp-only diagnostic filenames.
- Static popup diagnostic structure and absence of inline executable script.

## Manual browser verification

1. Enable Developer mode in `chrome://extensions`.
2. Load the repository directory as an unpacked extension, or reload the existing unpacked installation.
3. Open an authenticated Genspark artifact.
4. Open the extension popup.
5. Verify each normal export option still downloads the selected output(s).
6. Select **Download sanitized diagnostic**.
7. Confirm one timestamp-named JSON file appears under `Downloads/Genspark Diagnostics/`.
8. Inspect the JSON before sharing it and confirm it contains structural metadata and numeric text lengths, not artifact text, titles, account data, or complete URLs.

## Next phase

Generate one diagnostic from an authenticated Genspark Slides editor, inspect its structural evidence, commit a sanitized fixture derived from it, and add one focused Slides selector adapter with generic-extractor fallback and fixture-driven tests. Repeat the evidence-first loop for Pages and Documents before asset packaging, PDF export, or PPTX recovery work.
