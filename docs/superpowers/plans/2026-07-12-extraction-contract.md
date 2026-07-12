# Extraction Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split Genspark artifact extraction into a reusable, deterministic module with dependency-free contract tests while preserving the existing one-click Chrome workflow.

**Architecture:** `extractor.js` owns DOM collection, artifact classification, normalization, and schema construction. `service-worker.js` injects that packaged file into the user-invoked active tab and then invokes its public capture API. Node's built-in test runner verifies the pure classification and normalization contract without a browser dependency.

**Tech Stack:** Manifest V3, plain JavaScript, Chrome `scripting` and `downloads` APIs, Node built-in `node:test` and `node:assert`.

## Global Constraints

- Work only on `main` as explicitly authorized by the repository owner.
- Keep the current least-privilege permissions: `activeTab`, `scripting`, and `downloads`; do not add persistent host permissions.
- Ship all executable code inside the extension package.
- Add no package manager or third-party dependency for this slice.
- Preserve schema version `1` and current artifact type values: `slides`, `page`, `document`, and `unknown`.
- Create no more than three implementation files in this response; maintenance artifacts remain exempt under the project protocol.

---

### Task 1: Deterministic extraction contract

**Files:**
- Create: `tests/extractor.test.js`
- Create: `extractor.js`

**Interfaces:**
- Consumes: raw page metadata and DOM-derived arrays.
- Produces: `globalThis.GensparkExporter.captureArtifact()`, `classifyArtifact(input)`, `createArtifactCapture(input)`, and `normalizeText(value)`.

- [x] **Step 1: Write failing contract tests**

Cover artifact-family classification, whitespace normalization, relative URL resolution, title selection, and exact schema-versioned output.

- [x] **Step 2: Run the test and verify RED**

Run: `node --test tests/extractor.test.js`

Expected: failure because `../extractor.js` does not exist.

- [x] **Step 3: Implement the minimal extraction module**

Implement one packaged IIFE that exposes the browser API through `globalThis.GensparkExporter` and CommonJS exports only when Node provides `module.exports`.

- [x] **Step 4: Run tests and syntax verification**

Run:

```bash
node --test tests/extractor.test.js
node --check extractor.js
```

Expected: three passing tests and no syntax errors.

### Task 2: Wire the service worker to the extraction module

**Files:**
- Modify: `service-worker.js`
- Modify: `changelog.md`
- Modify: `repo-map.md`

**Interfaces:**
- Consumes: `globalThis.GensparkExporter.captureArtifact()` injected from `extractor.js`.
- Produces: the existing `.genspark.json` download and action badge states.

- [x] **Step 1: Replace inline capture with packaged-file injection**

Call `chrome.scripting.executeScript()` first with `files: ["extractor.js"]`, then invoke the exposed capture function in a second script call.

- [x] **Step 2: Preserve validation and download behavior**

Keep hostname validation, empty-capture rejection, filename sanitation, save-as behavior, duplicate-name uniquifying, and explicit failure state unchanged.

- [x] **Step 3: Verify service-worker syntax and full tests**

Run:

```bash
node --check service-worker.js
node --test tests/extractor.test.js
```

Expected: no syntax errors and three passing tests.

- [x] **Step 4: Record and map the change**

Append the extraction split and verification commands to `changelog.md`; update `repo-map.md` with the new module, public API, test command, and next phase.
