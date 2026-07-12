# Observed Genspark Extraction Design

**Date:** 2026-07-12

**Status:** Design ready for owner review

## Goal

Create a privacy-preserving diagnostic path that lets the extension capture the authenticated Genspark editor's structural evidence locally, so Slides, Pages, and Documents selectors can be implemented from observed facts instead of guessed DOM assumptions.

## Verified Current Facts

- The repository is on `main` and the extension is Manifest V3 version `0.3.0`.
- The manifest currently requests only `activeTab`, `downloads`, and `scripting`.
- `extractor.js` runs through `chrome.scripting.executeScript()` and currently relies on generic semantic selectors.
- Chrome's current scripting documentation states that `activeTab` supplies temporary host access and that injected scripts run in the isolated world by default; `MAIN` is available when interaction with host-page JavaScript is specifically required.
- Genspark's current official product pages state that its presentation editor supports editable slide elements and native export to PowerPoint, PDF, and Google Slides, and that presentations may be shared through a public link.
- Public Genspark marketing pages do not expose the authenticated editor's DOM or application-state contract.

Official sources reviewed:

- https://developer.chrome.com/docs/extensions/reference/api/scripting
- https://developer.chrome.com/docs/extensions/develop/concepts/activeTab
- https://developer.chrome.com/docs/extensions/develop/concepts/messaging
- https://www.genspark.ai/tools/ai-presentation-maker
- https://www.genspark.ai/tools/ai-powerpoint-generator
- https://www.genspark.ai/tools/ai-document-generator
- https://www.genspark.ai/tools/ai-report-generator
- https://www.genspark.ai/privacy

## Scope

This phase will add an explicit **Download sanitized diagnostic** action to the popup. The action will inspect only the active user-opened Genspark tab and download a local JSON diagnostic containing structural evidence required to design stable artifact selectors.

The diagnostic is a development aid. It is not an additional end-user artifact format and must not be mixed into the JSON, Markdown, or HTML export serializer contract.

## Non-goals

- Do not add Slides, Pages, or Documents selectors before a diagnostic has been observed.
- Do not capture raw artifact text, prompts, notes, comments, account data, document titles, or complete URLs.
- Do not inspect cookies, local storage, IndexedDB, request bodies, response bodies, or authentication tokens.
- Do not enter the page's `MAIN` execution world unless isolated-world DOM evidence proves insufficient.
- Do not add host permissions, `webRequest`, `debugger`, DevTools, or network interception.
- Do not add a package manager or dependency.
- Do not change schema version `1` of the existing artifact export contract.

## Approaches Considered

### 1. Raw authenticated DOM fixture

A user could save the page HTML or DevTools DOM and commit it as a fixture.

**Rejected:** raw markup may contain artifact content, emails, project identifiers, signed resource URLs, and application state. It also creates unnecessary manual cleanup and review risk.

### 2. Sanitized structural diagnostic

The extension can inspect the already-authorized active tab and output a bounded structural model that contains no artifact text.

**Selected:** this preserves the evidence needed for selector work while keeping the extension local-only, least-privilege, dependency-free, and aligned with the existing action-driven workflow.

### 3. Immediate main-world or network-state extraction

The extension could execute in Chrome's `MAIN` world or inspect application requests/state to locate Genspark's internal document model.

**Deferred:** no current evidence proves DOM structure is insufficient. This approach is more coupled to undocumented implementation details and increases privacy and maintenance risk.

## Architecture

### `diagnostics.js`

A packaged, dependency-free module will own diagnostic collection and sanitization. It will expose:

- `captureDiagnostic()` for browser execution.
- `createDiagnosticSnapshot(input)` for deterministic tests.
- `sanitizeIdentifier(value)` for class, ID, and attribute tokens.
- `sanitizeUrlShape(value, baseUrl)` for non-secret resource shape metadata.

The module will expose `globalThis.GensparkDiagnostics` in the injected page and CommonJS exports only when Node provides `module.exports`.

### `popup.html` and `popup.js`

The popup will retain its current export form and add one visually secondary button labeled **Download sanitized diagnostic** with a concise privacy description.

The controller will send a distinct request:

```text
{ type: "capture-diagnostic", tabId: positive integer }
```

Diagnostic capture will not be represented as an export format and will not pass through `serializers.js`.

### `service-worker.js`

The worker will validate the new message type, verify the tab and Genspark hostname, inject `diagnostics.js`, call `captureDiagnostic()`, and download one JSON file under:

```text
Genspark Diagnostics/genspark-diagnostic-<UTC timestamp>.json
```

The filename must not include the artifact title, pathname, project identifier, or user-entered content.

The listener will preserve the current asynchronous `return true` behavior and return one of:

```text
{ ok: true, count: 1, kind: "diagnostic" }
```

```text
{ ok: false, error: string }
```

## Diagnostic Contract

The diagnostic will use its own contract and version:

```text
{
  diagnosticSchemaVersion: 1,
  capturedAt,
  page: {
    origin,
    pathnameShape,
    viewport,
    documentLanguage,
    titleLength,
    bodyChildCount
  },
  capabilities: {
    openShadowRootCount,
    iframeCount,
    canvasCount,
    svgCount,
    imageCount
  },
  candidates: [
    {
      path,
      tagName,
      safeId,
      safeClasses,
      safeAttributes,
      role,
      childElementCount,
      textLength,
      bounds,
      display,
      visibility,
      position,
      descendantCounts
    }
  ],
  repeatedStructures: [
    {
      parentPath,
      childSignature,
      count,
      representativeBounds
    }
  ]
}
```

`titleLength` is numeric metadata only. The title string itself is never stored.

### Structural candidates

Collection will remain bounded and deterministic. Candidate elements will include:

- `main`, `article`, `section`, and elements with recognized semantic roles.
- Elements whose safe attributes contain artifact terms such as `slide`, `page`, `document`, `editor`, `canvas`, or `presentation`.
- Repeated sibling structures with at least two visible children and materially similar geometry.
- Visible `canvas`, `svg`, `img`, and open shadow-host elements.

The collector will cap candidates and repeated structures to prevent oversized downloads.

## Sanitization Rules

The output must not contain raw visible text. It may contain text length only.

Identifier and attribute values will be removed or replaced when they contain:

- Email addresses.
- UUIDs.
- Long numeric identifiers.
- Long hexadecimal or base64-like tokens.
- Query strings or fragments.
- Data URLs.
- Bearer tokens or token-like key/value material.
- Values longer than the bounded safe-token length.

Class names, IDs, roles, `data-*`, and `aria-*` values may be retained only when they pass the conservative safe-token rules. Attribute names may be retained even when their values are redacted.

URLs will be reduced to origin plus a sanitized pathname shape. Every path segment that resembles an identifier will be replaced with a stable placeholder. Query strings, fragments, credentials, full signed resource paths, titles, and user-entered content will never be stored.

The diagnostic will not call external services and will be downloaded only to the user's device.

## Data Flow

1. The user opens an authenticated Genspark artifact.
2. The user opens the extension popup.
3. The user selects **Download sanitized diagnostic**.
4. `popup.js` obtains the active tab ID and sends `capture-diagnostic`.
5. `service-worker.js` validates the request and Genspark hostname.
6. The worker injects packaged `diagnostics.js` into the main frame's default isolated world.
7. `captureDiagnostic()` collects and sanitizes the structural model.
8. The worker downloads the local diagnostic JSON with a timestamp-only filename.
9. The popup reports success or a specific failure.
10. The owner can inspect and provide the diagnostic for the next selector-adapter phase.

## Error Handling

The diagnostic route will fail explicitly when:

- The request type or tab ID is invalid.
- The active tab is unavailable or is not a supported Genspark hostname.
- The diagnostic module cannot be injected.
- The page produces no structural candidates.
- Sanitization or serialization fails.
- Chrome rejects the download.

No partial diagnostic will be reported as successful.

## Testing

All tests will remain in `tests/extractor.test.js` unless the existing file becomes materially harder to diagnose.

Minimum sufficient coverage:

- Safe identifiers survive unchanged.
- Emails, UUIDs, long numbers, base64-like values, query strings, fragments, and data URLs are redacted.
- Raw text and document titles are absent while numeric lengths remain.
- Candidate and repeated-structure caps are enforced.
- Diagnostic snapshots are deterministic for deterministic input.
- Popup diagnostic messages validate positive tab IDs.
- Service-worker diagnostic requests reject unrelated or malformed input.
- Success metadata is serializable and distinct from artifact export metadata.
- Diagnostic filenames contain only the fixed prefix and UTC timestamp.

### Test streamlining decision

"Abiding by the YAGNI rules, can any of our test(s) be streamlined — i.e. reduce file count/length by using dependencies instead of manual test files?"

**Yes:** reuse the existing Node `node:test` file and table-driven cases. Do not add a dependency or a new test file unless the single file becomes materially less diagnosable.

## Acceptance Criteria

- No permission is added to `manifest.json`.
- No raw artifact text or document title appears in the diagnostic payload or filename.
- No query string, fragment, email, UUID, long numeric identifier, data URL, or token-like value appears in the diagnostic.
- The diagnostic includes enough safe structural evidence to compare candidate slide/page/document containers.
- The popup clearly separates normal exports from diagnostic capture.
- The existing JSON, Markdown, HTML, and bundle workflows remain unchanged.
- Existing tests remain green and new diagnostic tests prove sanitization and request validation.
- The output is local-only and no network request is introduced.

## Follow-on Phase

After one real diagnostic is obtained:

1. Inspect the diagnostic and identify evidence-supported Slides container and content selectors.
2. Commit a sanitized fixture derived from the diagnostic.
3. Add one focused selector adapter that falls back to the current generic extractor.
4. Add fixture-driven tests in the existing test infrastructure.
5. Repeat the same evidence-first loop for Pages and Documents.
6. Consider `MAIN`-world inspection only if the diagnostic proves the DOM lacks recoverable structure.
