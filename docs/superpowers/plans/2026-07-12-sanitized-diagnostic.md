# Sanitized Diagnostic Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a privacy-preserving, local-only structural diagnostic that provides enough authenticated Genspark DOM evidence to design artifact-specific selectors without storing artifact text, titles, account data, identifiers, or complete URLs.

**Architecture:** A new packaged `diagnostics.js` module owns bounded DOM inspection and conservative sanitization. The existing popup sends a distinct `capture-diagnostic` message, and the service worker validates the request, injects the module into the active Genspark tab's default isolated world, and downloads one timestamp-named JSON file without passing through the artifact serializers.

**Tech Stack:** Chrome Manifest V3, `activeTab`, `scripting`, `downloads`, one-time runtime messaging, plain HTML/CSS/JavaScript, Node built-in `node:test` and `node:assert/strict`.

## Global Constraints

- Work only on the existing `main` branch.
- Create no more than three new files in this response.
- Add no dependency, package manager, build system, host permission, remote code, inline executable code, `eval`, network interception, or persistent state.
- Preserve the existing `activeTab`, `downloads`, and `scripting` permissions exactly.
- Keep normal JSON, Markdown, HTML, and bundle exports behaviorally unchanged.
- Keep artifact schema version `1` unchanged; diagnostics use independent `diagnosticSchemaVersion: 1`.
- Never store raw artifact text, document titles, prompts, notes, comments, account data, complete URLs, query strings, fragments, credentials, signed paths, UUIDs, long numeric identifiers, data URLs, or token-like values.
- Use a fixed filename prefix plus UTC timestamp only.
- Reuse `tests/extractor.test.js`; add no test dependency or new test file.

---

### Task 1: Implement the deterministic sanitization contract

**Files:**
- Create: `diagnostics.js`
- Modify: `tests/extractor.test.js`

**Interfaces:**
- Consumes: raw diagnostic input containing page metadata, candidate element metadata, and repeated-structure metadata.
- Produces: `globalThis.GensparkDiagnostics` and CommonJS exports containing `captureDiagnostic()`, `createDiagnosticSnapshot(input)`, `sanitizeIdentifier(value)`, and `sanitizeUrlShape(value, baseUrl)`.

- [ ] **Step 1: Add failing module and sanitization tests**

Add imports and table-driven assertions proving:

```js
const {
  createDiagnosticSnapshot,
  sanitizeIdentifier,
  sanitizeUrlShape,
} = require("../diagnostics.js");

assert.equal(sanitizeIdentifier("slide-thumbnail"), "slide-thumbnail");
assert.equal(sanitizeIdentifier("person@example.com"), null);
assert.equal(sanitizeIdentifier("550e8400-e29b-41d4-a716-446655440000"), null);
assert.deepEqual(
  sanitizeUrlShape("https://www.genspark.ai/slides/private-project?token=secret#page", "https://www.genspark.ai"),
  { origin: "https://www.genspark.ai", pathnameShape: "/slides/:segment" },
);
```

Add a snapshot assertion whose raw input contains a title, visible text, email, UUID, token-like value, and private path segment; verify `JSON.stringify(snapshot)` contains none of them while retaining numeric title/text lengths.

- [ ] **Step 2: Run the suite and verify RED**

Run:

```bash
node --test tests/extractor.test.js
```

Expected: the existing tests remain green and the new diagnostics tests fail because `../diagnostics.js` does not exist.

- [ ] **Step 3: Implement `diagnostics.js`**

Implement one IIFE with these fixed limits:

```js
const MAX_CANDIDATES = 150;
const MAX_REPEATED_STRUCTURES = 50;
const MAX_SAFE_TOKEN_LENGTH = 64;
```

`sanitizeIdentifier(value)` must return a token only when it:

- is a single bounded identifier;
- contains a structural term such as `slide`, `page`, `document`, `editor`, `canvas`, `presentation`, `deck`, `report`, `research`, `workspace`, `thumbnail`, `content`, `toolbar`, `panel`, `container`, `viewport`, or `root`;
- does not match email, UUID, long-number, long-hex/base64-like, query/fragment, data-URL, bearer, secret, auth, session, key, or token patterns.

`sanitizeUrlShape(value, baseUrl)` must:

- accept only `https:` Genspark URLs;
- return origin plus pathname shape;
- retain only known route words;
- replace every unknown path segment with `:segment`;
- omit query strings, fragments, credentials, and complete resource paths.

`createDiagnosticSnapshot(input)` must:

- emit `diagnosticSchemaVersion: 1`;
- store title and visible-content lengths only;
- sort and cap candidates and repeated structures deterministically;
- validate structural paths rather than copying arbitrary strings;
- retain only safe structural IDs/classes/attribute tokens;
- normalize finite non-negative counts and bounded integer geometry;
- reject an input that yields no candidates.

`captureDiagnostic()` must inspect only the current document, build structural paths from tag names plus `:nth-of-type()`, collect visible semantic/structural/media candidates, count page capabilities, detect repeated visible sibling signatures, and pass raw metadata directly into `createDiagnosticSnapshot()` without retaining raw text.

- [ ] **Step 4: Run tests and syntax verification**

Run:

```bash
node --test tests/extractor.test.js
node --check diagnostics.js
```

Expected: all tests pass and syntax validation exits successfully.

- [ ] **Step 5: Commit**

```bash
git add diagnostics.js tests/extractor.test.js
git commit -m "feat: add sanitized structural diagnostics"
```

### Task 2: Add popup and service-worker request contracts

**Files:**
- Modify: `popup.js`
- Modify: `service-worker.js`
- Modify: `tests/extractor.test.js`

**Interfaces:**
- Consumes popup request: `{ type: "capture-diagnostic", tabId: positive integer }`.
- Produces worker success: `{ ok: true, count: 1, kind: "diagnostic" }`.
- Produces filename: `Genspark Diagnostics/genspark-diagnostic-<UTC timestamp>.json`.

- [ ] **Step 1: Add failing contract tests**

Add tests for:

```js
createDiagnosticMessage(11);
normalizeDiagnosticRequest({ type: "capture-diagnostic", tabId: 11 });
createDiagnosticSuccess();
createDiagnosticFilename("2026-07-12T12:00:00.000Z");
```

Expected values:

```js
{ type: "capture-diagnostic", tabId: 11 }
{ tabId: 11 }
{ ok: true, count: 1, kind: "diagnostic" }
"genspark-diagnostic-2026-07-12T12-00-00-000Z.json"
```

Also verify malformed message types, non-positive tab IDs, and invalid timestamps throw specific errors.

- [ ] **Step 2: Run the suite and verify RED**

Run:

```bash
node --test tests/extractor.test.js
```

Expected: diagnostics module tests pass while popup/worker contract tests fail because the new functions are not exported.

- [ ] **Step 3: Implement popup request creation**

Add:

```js
const createDiagnosticMessage = (tabId) => {
  if (!Number.isInteger(tabId) || tabId <= 0) {
    throw new TypeError("Expected a positive tab ID.");
  }

  return { type: "capture-diagnostic", tabId };
};
```

Export it alongside `createExportMessage`.

- [ ] **Step 4: Implement service-worker request and filename helpers**

Add pure helpers:

```js
const normalizeDiagnosticRequest = (message) => {
  if (!message || typeof message !== "object" || message.type !== "capture-diagnostic") {
    throw new TypeError("Unsupported message type.");
  }
  if (!Number.isInteger(message.tabId) || message.tabId <= 0) {
    throw new TypeError("Expected a positive tab ID.");
  }
  return { tabId: message.tabId };
};

const createDiagnosticSuccess = () => ({ ok: true, count: 1, kind: "diagnostic" });
```

`createDiagnosticFilename(capturedAt)` must parse an ISO timestamp, reject invalid dates, and replace `:` and `.` with `-`.

- [ ] **Step 5: Run tests and syntax checks**

Run:

```bash
node --test tests/extractor.test.js
node --check popup.js
node --check service-worker.js
```

Expected: all tests pass and both files parse.

- [ ] **Step 6: Commit**

```bash
git add popup.js service-worker.js tests/extractor.test.js
git commit -m "feat: add diagnostic request contracts"
```

### Task 3: Wire local diagnostic capture and accessible UI

**Files:**
- Modify: `popup.html`
- Modify: `popup.js`
- Modify: `service-worker.js`
- Modify: `manifest.json`
- Modify: `tests/extractor.test.js`
- Modify: `changelog.md`
- Modify: `repo-map.md`

**Interfaces:**
- Consumes `globalThis.GensparkDiagnostics.captureDiagnostic()` from an injected packaged file.
- Produces one local JSON download and the serializable diagnostic response.

- [ ] **Step 1: Add popup structural assertions**

Extend the existing static popup checks to require:

```text
id="diagnostic-button"
Download sanitized diagnostic
No artifact text or titles are included
```

The diagnostic control must be `type="button"`, remain inside the existing form so the shared busy state disables it, and use the same live status region.

- [ ] **Step 2: Add the diagnostic popup control**

Add a visually secondary button and concise privacy description beneath the normal export button. Keep `popup.js` as the only executable popup script.

- [ ] **Step 3: Add popup diagnostic execution**

On `#diagnostic-button` click:

1. Disable the existing form through `setFormBusy()`.
2. Report `Collecting sanitized structure…`.
3. Query the active tab.
4. Send `createDiagnosticMessage(tab.id)`.
5. Require `{ ok: true, kind: "diagnostic" }`.
6. Report `Downloaded sanitized diagnostic.` or a specific returned error.
7. Re-enable the form in `finally`.

- [ ] **Step 4: Add worker injection and download routing**

Implement `executeDiagnosticCapture(tabId)` by injecting `diagnostics.js` and then invoking `globalThis.GensparkDiagnostics?.captureDiagnostic()` in the main frame's default isolated world.

Implement `captureDiagnostic({ tabId })` to:

1. Verify the tab exists and its hostname is `genspark.ai` or `www.genspark.ai`.
2. Set a diagnostic progress badge/title.
3. Capture the snapshot.
4. Reject empty candidates.
5. Serialize with `JSON.stringify(snapshot, null, 2)`.
6. Download to `Genspark Diagnostics/<timestamp-only filename>` using `conflictAction: "uniquify"` and `saveAs: false`.
7. Set badge `D` and return `createDiagnosticSuccess()`.

Update the top-level runtime listener to accept only `export-artifact` and `capture-diagnostic`, route each through its validator, preserve literal `true` for asynchronous responses, and keep explicit error metadata.

- [ ] **Step 5: Update manifest metadata without changing permissions**

Increment version from `0.3.0` to `0.4.0` and update the description to mention the optional local sanitized diagnostic. Keep the permission array byte-for-byte equivalent in values.

- [ ] **Step 6: Run full verification**

Run:

```bash
node --test tests/extractor.test.js
node --check extractor.js
node --check serializers.js
node --check diagnostics.js
node --check service-worker.js
node --check popup.js
node -e "const fs=require('node:fs'); const m=JSON.parse(fs.readFileSync('manifest.json','utf8')); if(m.version!=='0.4.0'||m.action?.default_popup!=='popup.html'||JSON.stringify([...m.permissions].sort())!==JSON.stringify(['activeTab','downloads','scripting'])) process.exit(1); console.log('manifest contract: ok')"
node -e "const fs=require('node:fs'); const html=fs.readFileSync('popup.html','utf8'); for(const value of ['id=\"diagnostic-button\"','Download sanitized diagnostic','No artifact text or titles are included','src=\"popup.js\"']) if(!html.includes(value)) process.exit(1); if(/<script(?![^>]*src=)/i.test(html)) process.exit(1); console.log('popup contract: ok')"
```

Expected: zero failed tests, every syntax command exits successfully, and both contract commands print `ok`.

- [ ] **Step 7: Record and map the implementation**

Append every existing-file edit and the exact RED/GREEN evidence to `changelog.md`. Update `repo-map.md` with the diagnostic entry point, privacy contract, message shape, output location, verification commands, and next authenticated-Slides diagnostic step while keeping it below the repository-map size cap.

- [ ] **Step 8: Commit**

```bash
git add popup.html popup.js service-worker.js manifest.json tests/extractor.test.js changelog.md repo-map.md
git commit -m "feat: wire local sanitized diagnostics"
```

## Self-review

- Spec coverage: privacy exclusions, local-only behavior, independent schema, popup separation, message validation, isolated-world injection, timestamp-only filename, bounded collection, tests, manifest preservation, and documentation are each assigned to a task.
- Placeholder scan: no `TBD`, `TODO`, undefined interface, or generic error-handling step remains.
- Type consistency: `createDiagnosticMessage()` produces the exact object consumed by `normalizeDiagnosticRequest()`; the worker returns the exact response consumed by the popup; diagnostic output never enters `serializers.js`.
- Scope check: this plan stops after producing the diagnostic capability. Artifact-specific selectors remain blocked until a real authenticated diagnostic is supplied and inspected.