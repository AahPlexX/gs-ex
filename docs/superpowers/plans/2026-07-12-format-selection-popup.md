# Format Selection Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an accessible Chrome action popup that lets the user export JSON, Markdown, HTML, or all three formats from the active Genspark artifact.

**Architecture:** `popup.html` provides a native form and status region. `popup.js` reads the selected option, finds the active tab, and sends one JSON-serializable request through `chrome.runtime.sendMessage()`. `service-worker.js` validates the message, reuses the existing capture and serializer pipeline, and returns a serializable success or failure response without relying on promise-returning message listeners.

**Tech Stack:** Manifest V3, plain HTML/CSS/JavaScript, Chrome `action`, `tabs`, `runtime`, `scripting`, and `downloads` APIs, Node built-in `node:test` and `node:assert/strict`.

## Global Constraints

- Work only on the existing `main` branch.
- Create no more than three new files in this response.
- Add no dependency, package manager, build system, persistent host permission, remote code, inline executable script, or `eval`.
- Keep `activeTab`, `scripting`, and `downloads` as the only permissions.
- Use `return true` plus `sendResponse()` for asynchronous runtime-message compatibility.
- Validate every message field before capture or download.
- Keep tests in `tests/extractor.test.js` unless separation is required for diagnosability.

---

### Task 1: Specify the export-request contract

**Files:**
- Modify: `tests/extractor.test.js`
- Modify: `service-worker.js`

**Interfaces:**
- Consumes: message objects shaped as `{ type: "export-artifact", tabId: number, formats: string[] }`.
- Produces: `normalizeExportRequest(message)` returning `{ tabId, formats }` or throwing `TypeError`/`RangeError`.

- [ ] **Step 1: Add failing tests for valid single-format, valid bundle, duplicate removal, malformed tab IDs, unknown formats, and unrelated message types.**
- [ ] **Step 2: Run `node --test tests/extractor.test.js` and confirm failure because `normalizeExportRequest` is not exported.**
- [ ] **Step 3: Refactor `service-worker.js` into a Node-loadable module with guarded Chrome registration and implement the smallest validator that passes the tests.**
- [ ] **Step 4: Run the full test file and confirm all tests pass.**
- [ ] **Step 5: Run `node --check service-worker.js`.**

### Task 2: Add popup UI and request sender

**Files:**
- Create: `popup.html`
- Create: `popup.js`
- Modify: `manifest.json`

**Interfaces:**
- Consumes: four form values: `json`, `markdown`, `html`, and `bundle`.
- Produces: a runtime request containing the active tab ID and one or three normalized formats.

- [ ] **Step 1: Create `popup.html` with a labeled radio group, one submit button, and an `aria-live="polite"` status region.**
- [ ] **Step 2: Create `popup.js` with `createExportMessage(selection, tabId)` and a submit handler that disables controls during export, queries `{ active: true, currentWindow: true }`, sends the request, and displays the returned status.**
- [ ] **Step 3: Add tests for `createExportMessage()` to the existing test file and verify RED before exposing the function from `popup.js`.**
- [ ] **Step 4: Add `default_popup: "popup.html"` to the manifest and increment the extension version to `0.3.0`.**
- [ ] **Step 5: Run Node syntax checks and parse the manifest.**

### Task 3: Route popup requests through the existing export pipeline

**Files:**
- Modify: `service-worker.js`
- Modify: `tests/extractor.test.js`
- Modify: `changelog.md`
- Modify: `repo-map.md`

**Interfaces:**
- Consumes: validated `{ tabId, formats }` requests.
- Produces: `{ ok: true, count, formats }` or `{ ok: false, error }` responses.

- [ ] **Step 1: Replace the action-click listener with a top-level `chrome.runtime.onMessage` listener that ignores unrelated messages, returns literal `true`, and always settles through `sendResponse()`.**
- [ ] **Step 2: Generalize the download function to accept the validated format array while preserving sequential downloads, duplicate-safe filenames, and one capture per request.**
- [ ] **Step 3: Add pure tests proving request validation and response metadata without mocking DOM extraction or Chrome downloads.**
- [ ] **Step 4: Run `node --test tests/extractor.test.js`, syntax checks for every JavaScript file, and manifest parsing.**
- [ ] **Step 5: Append exact changes and verification evidence to `changelog.md`, then update `repo-map.md` with the popup entry point, message contract, and manual verification path.**

## Self-review

- Spec coverage: popup semantics, single/bundle selection, message validation, service-worker routing, least privilege, compatibility, tests, and documentation are each assigned to a task.
- Placeholder scan: no implementation step contains `TBD`, `TODO`, or an undefined interface.
- Type consistency: `createExportMessage()` produces the exact object consumed by `normalizeExportRequest()`; service-worker responses are JSON-serializable and consumed by the popup status handler.
