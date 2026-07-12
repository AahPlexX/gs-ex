const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { createDiagnosticMessage, createExportMessage } = require("../popup.js");
const {
  classifyArtifact,
  createArtifactCapture,
  normalizeText,
} = require("../extractor.js");
const { serializeCapture } = require("../serializers.js");
const {
  createDiagnosticSnapshot,
  sanitizeIdentifier,
  sanitizeUrlShape,
} = require("../diagnostics.js");

const loadServiceWorkerApi = () => {
  const originalChrome = global.chrome;
  const originalImportScripts = global.importScripts;

  global.importScripts = () => {};
  global.chrome = {
    action: {
      setBadgeText: async () => {},
      setTitle: async () => {},
    },
  };

  delete require.cache[require.resolve("../service-worker.js")];
  const api = require("../service-worker.js");

  global.chrome = originalChrome;
  global.importScripts = originalImportScripts;
  return api;
};

const {
  createDiagnosticFilename,
  createDiagnosticSuccess,
  createExportSuccess,
  normalizeDiagnosticRequest,
  normalizeExportRequest,
} = loadServiceWorkerApi();

const createSampleCapture = (overrides = {}) =>
  createArtifactCapture({
    url: "https://www.genspark.ai/slides/example",
    pathname: "/slides/example",
    documentTitle: "Product Launch",
    headingTitle: "Product Launch",
    language: "en",
    description: "A launch deck",
    mainText: "Intro Details",
    headings: [{ level: 2, text: "Overview" }],
    links: [{ text: "Source", url: "/sources/1" }],
    images: [{ alt: "Diagram", url: "/assets/diagram.png", width: 640, height: 480 }],
    slides: [{ text: "First slide", images: ["/assets/slide.png"] }],
    capturedAt: "2026-07-12T12:00:00.000Z",
    ...overrides,
  });

const assertCases = (cases, evaluate) => {
  for (const [input, expected] of cases) {
    assert.deepEqual(evaluate(input), expected);
  }
};

test("artifact classification and text normalization are deterministic", () => {
  assertCases(
    [
      [{ pathname: "/slides/launch", title: "Launch" }, "slides"],
      [{ pathname: "/workspace/item", title: "Quarterly Presentation" }, "slides"],
      [{ pathname: "/document/brief", title: "Brief" }, "document"],
      [{ pathname: "/workspace/item", title: "Research Report" }, "page"],
      [{ pathname: "/workspace/item", title: "Untitled" }, "unknown"],
    ],
    classifyArtifact,
  );

  assert.equal(normalizeText("  alpha\n\t beta  "), "alpha beta");
  assert.equal(normalizeText(null), "");
});

test("artifact capture emits the normalized schema version 1 contract", () => {
  const capture = createSampleCapture({
    documentTitle: "  Product\nLaunch  ",
    description: "  A launch deck  ",
    mainText: " Intro\n\nDetails ",
    headings: [{ level: 2, text: "  Overview " }],
  });

  assert.equal(capture.schemaVersion, 1);
  assert.deepEqual(capture.source, {
    application: "Genspark",
    url: "https://www.genspark.ai/slides/example",
    title: "Product Launch",
    capturedAt: "2026-07-12T12:00:00.000Z",
    language: "en",
  });
  assert.deepEqual(capture.artifact, {
    type: "slides",
    title: "Product Launch",
    description: "A launch deck",
    text: "Intro Details",
    headings: [{ level: 2, text: "Overview" }],
    links: [{ text: "Source", url: "https://www.genspark.ai/sources/1" }],
    images: [
      {
        alt: "Diagram",
        url: "https://www.genspark.ai/assets/diagram.png",
        width: 640,
        height: 480,
      },
    ],
    slides: [
      {
        index: 1,
        text: "First slide",
        images: ["https://www.genspark.ai/assets/slide.png"],
      },
    ],
  });
});

test("serializers emit deterministic metadata and safe content", () => {
  const capture = createSampleCapture({
    headingTitle: "Roadmap [Draft]",
    description: "Use *carefully* <script>alert(1)</script>",
    links: [
      { text: "Safe source", url: "https://example.com/reference" },
      { text: "Unsafe", url: "javascript:alert(2)" },
    ],
    images: [
      { alt: "Safe image", url: "https://example.com/image.png", width: 10, height: 10 },
      { alt: "Unsafe image", url: "javascript:alert(3)", width: 10, height: 10 },
    ],
  });

  assertCases(
    [
      ["json", ["genspark.json", "application/json"]],
      ["markdown", ["md", "text/markdown"]],
      ["html", ["html", "text/html"]],
    ],
    (format) => {
      const output = serializeCapture(capture, format);
      assert.ok(output.content.length > 0);
      return [output.extension, output.mimeType];
    },
  );

  assert.deepEqual(JSON.parse(serializeCapture(capture, "json").content), capture);

  const markdown = serializeCapture(capture, "markdown").content;
  assert.ok(markdown.startsWith("# Roadmap \\[Draft\\]"));
  assert.match(markdown, /https:\/\/example\.com\/reference/);
  assert.doesNotMatch(markdown, /javascript:/i);

  const html = serializeCapture(capture, "html").content;
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src &#39;none&#39;/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /javascript:/i);

  assert.throws(() => serializeCapture(null, "json"), /schema version 1 capture/i);
  assert.throws(() => serializeCapture(capture, "pdf"), /unsupported export format/i);
});

test("popup and worker export contracts validate and normalize requests", () => {
  assert.deepEqual(createExportMessage("json", 11), {
    type: "export-artifact",
    tabId: 11,
    formats: ["json"],
  });
  assert.deepEqual(createExportMessage("bundle", 11).formats, ["json", "markdown", "html"]);
  assert.deepEqual(
    normalizeExportRequest({
      type: "export-artifact",
      tabId: 7,
      formats: ["json", "markdown", "json"],
    }),
    { tabId: 7, formats: ["json", "markdown"] },
  );

  assert.throws(() => createExportMessage("pdf", 11), /unsupported export selection/i);
  assert.throws(() => createExportMessage("json", 0), /tab id/i);
  assert.throws(
    () => normalizeExportRequest({ type: "other", tabId: 7, formats: ["json"] }),
    /unsupported message type/i,
  );
  assert.throws(
    () => normalizeExportRequest({ type: "export-artifact", tabId: 7, formats: [] }),
    /at least one export format/i,
  );
  assert.throws(
    () => normalizeExportRequest({ type: "export-artifact", tabId: 7, formats: ["pdf"] }),
    /unsupported export format/i,
  );

  const formats = ["json", "html"];
  const response = createExportSuccess(formats);
  assert.deepEqual(response, { ok: true, count: 2, formats });
  assert.notEqual(response.formats, formats);
});

test("diagnostic identifiers and URL shapes exclude private values", () => {
  assertCases(
    [
      ["slide-thumbnail", "slide-thumbnail"],
      ["editorCanvas", "editorCanvas"],
      ["person@example.com", null],
      ["550e8400-e29b-41d4-a716-446655440000", null],
      ["123456789012345", null],
      ["token=secret-value", null],
      ["data:text/plain,secret", null],
      ["QWxhZGRpbjpvcGVuIHNlc2FtZQ==", null],
      ["customer-project", null],
    ],
    sanitizeIdentifier,
  );

  assert.deepEqual(
    sanitizeUrlShape(
      "https://www.genspark.ai/slides/private-project?token=secret#page",
      "https://www.genspark.ai",
    ),
    { origin: "https://www.genspark.ai", pathnameShape: "/slides/:segment" },
  );
  assert.equal(sanitizeUrlShape("https://example.com/slides/secret", "https://example.com"), null);
});

test("diagnostic snapshots remove content, unsafe attribute names, and excess records", () => {
  const candidates = Array.from({ length: 152 }, (_, index) => ({
    path: `html>body>main:nth-of-type(1)>section:nth-of-type(${index + 1})`,
    tagName: "section",
    id: index === 0 ? "slide-container" : `private-${index}`,
    classes: ["slide-thumbnail", "person@example.com", "customer-project"],
    attributes: {
      "data-testid": "slide-card",
      "aria-label": "Secret Launch Deck",
      "data-token": "token=private-secret",
      "data-private-project-84729301": "slide-card",
    },
    role: "region",
    childElementCount: 3,
    text: index === 0 ? "Confidential quarterly launch" : "Other private content",
    bounds: { x: index, y: index, width: 800, height: 450 },
    display: "block",
    visibility: "visible",
    position: "relative",
    descendantCounts: { canvas: 0, svg: 1, img: 2, iframe: 0, role: 3 },
  }));

  const repeatedStructures = Array.from({ length: 52 }, (_, index) => ({
    parentPath: `html>body>main:nth-of-type(1)>div:nth-of-type(${index + 1})`,
    childSignature: "section:slide-thumbnail",
    count: 3,
    representativeBounds: { width: 200, height: 120 },
  }));

  const snapshot = createDiagnosticSnapshot({
    url: "https://www.genspark.ai/slides/private-project?token=private-secret#slide",
    capturedAt: "2026-07-12T12:00:00.000Z",
    viewport: { width: 1440, height: 900, devicePixelRatio: 2 },
    documentLanguage: "en-US",
    title: "Secret Product Launch",
    bodyChildCount: 4,
    capabilities: { openShadowRootCount: 0, iframeCount: 1, canvasCount: 2, svgCount: 3, imageCount: 4 },
    candidates,
    repeatedStructures,
  });

  const serialized = JSON.stringify(snapshot);
  for (const forbidden of [
    "Secret Product Launch",
    "Secret Launch Deck",
    "Confidential quarterly launch",
    "Other private content",
    "person@example.com",
    "private-secret",
    "customer-project",
    "private-project",
    "private-project-84729301",
    "data-token",
  ]) {
    assert.doesNotMatch(serialized, new RegExp(forbidden, "i"));
  }

  assert.equal(snapshot.page.titleLength, "Secret Product Launch".length);
  assert.equal(snapshot.candidates[0].textLength, "Confidential quarterly launch".length);
  assert.equal(snapshot.candidates.length, 150);
  assert.equal(snapshot.repeatedStructures.length, 50);
  assert.deepEqual(snapshot.page.pathnameShape, "/slides/:segment");
  assert.deepEqual(snapshot.candidates[0].safeClasses, ["slide-thumbnail"]);
  assert.deepEqual(snapshot.candidates[0].safeAttributes, [
    { name: "aria-label", value: null },
    { name: "data-testid", value: "slide-card" },
  ]);
});

test("diagnostic popup and worker contracts are distinct from exports", () => {
  assert.deepEqual(createDiagnosticMessage(11), { type: "capture-diagnostic", tabId: 11 });
  assert.deepEqual(normalizeDiagnosticRequest(createDiagnosticMessage(11)), { tabId: 11 });
  assert.deepEqual(createDiagnosticSuccess(), { ok: true, count: 1, kind: "diagnostic" });
  assert.equal(
    createDiagnosticFilename("2026-07-12T12:00:00.000Z"),
    "genspark-diagnostic-2026-07-12T12-00-00-000Z.json",
  );

  assert.throws(() => createDiagnosticMessage(0), /tab id/i);
  assert.throws(
    () => normalizeDiagnosticRequest({ type: "export-artifact", tabId: 11 }),
    /unsupported message type/i,
  );
  assert.throws(() => createDiagnosticFilename("not-a-date"), /valid capture timestamp/i);
});

test("popup remains accessible and external-script-only", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "popup.html"), "utf8");

  for (const required of [
    'id="export-form"',
    'id="diagnostic-button"',
    'type="button"',
    "Download sanitized diagnostic",
    "No artifact text or titles are included",
    'role="status"',
    'aria-live="polite"',
    'src="popup.js"',
  ]) {
    assert.ok(html.includes(required), `Missing popup contract: ${required}`);
  }
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)/i);
});
