# Multi-Format Serialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export each normalized Genspark capture as local JSON, Markdown, and safe standalone HTML files.

**Architecture:** Keep DOM capture in `extractor.js`. Add one pure dependency-free serializer module that accepts schema version 1 captures and returns content plus MIME and filename metadata. The service worker will capture once, serialize three times, and save an organized three-file export bundle.

**Tech Stack:** Manifest V3, plain JavaScript, Chrome `scripting` and `downloads` APIs, Node built-in `node:test` and `node:assert/strict`.

## Global Constraints

- Work only on `main`.
- Add no runtime or test dependency.
- Keep `activeTab`, `scripting`, and `downloads` as the complete permission set.
- Treat captured page data as untrusted; escape HTML and permit only HTTP(S) resource URLs in rendered formats.
- Keep schema version 1 unchanged.

---

### Task 1: Specify serializer behavior

**Files:**
- Modify: `tests/extractor.test.js`

**Interfaces:**
- Consumes: schema version 1 capture objects from `createArtifactCapture(input)`.
- Produces expectations for `serializeCapture(capture, format)`.

- [ ] Add table-driven JSON, Markdown, and HTML metadata assertions.
- [ ] Add Markdown safety assertions for unsupported URL schemes.
- [ ] Add HTML escaping and restrictive Content Security Policy assertions.
- [ ] Add malformed-capture and unsupported-format error assertions.
- [ ] Run `node --test tests/extractor.test.js` and confirm failure because `../serializers.js` does not exist.

### Task 2: Implement the serializer module

**Files:**
- Create: `serializers.js`

**Interfaces:**
- Consumes: `serializeCapture(capture, format)` where `format` is `json`, `markdown`, or `html`.
- Produces: `{ content: string, extension: string, mimeType: string }`.

- [ ] Implement schema validation and deterministic metadata.
- [ ] Implement JSON serialization without altering the capture.
- [ ] Implement readable Markdown with escaped labels and HTTP(S)-only links and images.
- [ ] Implement semantic standalone HTML with escaped page data, no scripts, and a restrictive CSP.
- [ ] Expose the API as `globalThis.GensparkSerializers` and CommonJS exports.
- [ ] Run `node --test tests/extractor.test.js` and confirm every test passes.

### Task 3: Wire one-capture, three-format downloads

**Files:**
- Modify: `service-worker.js`
- Modify: `changelog.md`
- Modify: `repo-map.md`

**Interfaces:**
- Consumes: `GensparkSerializers.serializeCapture(capture, format)`.
- Produces: three local files under `Downloads/Genspark Exports/<artifact title>/`.

- [ ] Load `serializers.js` in the service worker with `importScripts`.
- [ ] Capture the active Genspark artifact once.
- [ ] Serialize and download JSON, Markdown, and HTML sequentially with `conflictAction: "uniquify"`.
- [ ] Preserve hostname validation, empty-content rejection, and explicit badge/error states.
- [ ] Record every existing-file edit in `changelog.md` and update durable commands and entry points in `repo-map.md`.
- [ ] Run `node --test tests/extractor.test.js`, `node --check extractor.js`, `node --check serializers.js`, and `node --check service-worker.js`.
