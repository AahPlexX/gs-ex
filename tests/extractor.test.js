const test = require("node:test");
const assert = require("node:assert/strict");

const { createExportMessage } = require("../popup.js");
const {
  classifyArtifact,
  createArtifactCapture,
  normalizeText,
} = require("../extractor.js");
const { serializeCapture } = require("../serializers.js");

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

const { createExportSuccess, normalizeExportRequest } = loadServiceWorkerApi();

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

test("classifyArtifact recognizes supported Genspark artifact families", () => {
  const cases = [
    [{ pathname: "/slides/launch-deck", title: "Launch" }, "slides"],
    [{ pathname: "/workspace/item", title: "Quarterly Presentation" }, "slides"],
    [{ pathname: "/document/brief", title: "Brief" }, "document"],
    [{ pathname: "/workspace/item", title: "Research Report" }, "page"],
    [{ pathname: "/workspace/item", title: "Untitled" }, "unknown"],
  ];

  for (const [input, expected] of cases) {
    assert.equal(classifyArtifact(input), expected);
  }
});

test("normalizeText collapses whitespace and tolerates empty values", () => {
  assert.equal(normalizeText("  alpha\n\t beta  "), "alpha beta");
  assert.equal(normalizeText(null), "");
});

test("createArtifactCapture emits a normalized schema-versioned contract", () => {
  const capture = createSampleCapture({
    documentTitle: "  Product\nLaunch  ",
    headingTitle: " Product Launch ",
    description: "  A launch deck  ",
    mainText: " Intro\n\nDetails ",
    headings: [{ level: 2, text: "  Overview " }],
    links: [{ text: " Source ", url: "/sources/1" }],
    images: [{ alt: " Diagram ", url: "/assets/diagram.png", width: 640, height: 480 }],
    slides: [{ text: " First slide ", images: ["/assets/slide.png"] }],
  });

  assert.deepEqual(capture, {
    schemaVersion: 1,
    source: {
      application: "Genspark",
      url: "https://www.genspark.ai/slides/example",
      title: "Product Launch",
      capturedAt: "2026-07-12T12:00:00.000Z",
      language: "en",
    },
    artifact: {
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
    },
  });
});

test("serializeCapture returns deterministic metadata for every supported format", () => {
  const capture = createSampleCapture();
  const cases = [
    ["json", "genspark.json", "application/json"],
    ["markdown", "md", "text/markdown"],
    ["html", "html", "text/html"],
  ];

  for (const [format, extension, mimeType] of cases) {
    const serialized = serializeCapture(capture, format);
    assert.equal(serialized.extension, extension);
    assert.equal(serialized.mimeType, mimeType);
    assert.equal(typeof serialized.content, "string");
    assert.ok(serialized.content.length > 0);
  }

  assert.deepEqual(JSON.parse(serializeCapture(capture, "json").content), capture);
});

test("Markdown serialization preserves content and excludes unsafe URLs", () => {
  const capture = createSampleCapture({
    headingTitle: "Roadmap [Draft]",
    description: "Use *carefully*",
    links: [
      { text: "Safe [source]", url: "https://example.com/reference" },
      { text: "Unsafe", url: "javascript:alert(1)" },
    ],
    images: [
      { alt: "Safe image", url: "https://example.com/image.png", width: 10, height: 10 },
      { alt: "Unsafe image", url: "javascript:alert(2)", width: 10, height: 10 },
    ],
  });

  const markdown = serializeCapture(capture, "markdown").content;

  assert.ok(markdown.startsWith("# Roadmap \\[Draft\\]"));
  assert.ok(markdown.includes("Use \\*carefully\\*"));
  assert.match(markdown, /https:\/\/example\.com\/reference/);
  assert.match(markdown, /https:\/\/example\.com\/image\.png/);
  assert.doesNotMatch(markdown, /javascript:/i);
});

test("HTML serialization escapes page data and emits no executable script", () => {
  const capture = createSampleCapture({
    headingTitle: '<img src=x onerror="alert(1)">',
    description: "<script>alert(2)</script>",
    links: [{ text: "Unsafe", url: "javascript:alert(3)" }],
  });

  const html = serializeCapture(capture, "html").content;

  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /default-src &#39;none&#39;/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;/);
  assert.match(html, /&lt;script&gt;alert\(2\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /javascript:/i);
});

test("serializeCapture rejects malformed captures and unsupported formats", () => {
  assert.throws(() => serializeCapture(null, "json"), /schema version 1 capture/i);
  assert.throws(() => serializeCapture(createSampleCapture(), "pdf"), /unsupported export format/i);
});

test("normalizeExportRequest accepts single and bundled formats and removes duplicates", () => {
  assert.deepEqual(
    normalizeExportRequest({ type: "export-artifact", tabId: 7, formats: ["json"] }),
    { tabId: 7, formats: ["json"] },
  );
  assert.deepEqual(
    normalizeExportRequest({
      type: "export-artifact",
      tabId: 7,
      formats: ["json", "markdown", "html", "json"],
    }),
    { tabId: 7, formats: ["json", "markdown", "html"] },
  );
});

test("normalizeExportRequest rejects malformed or unsupported requests", () => {
  assert.throws(
    () => normalizeExportRequest({ type: "other", tabId: 7, formats: ["json"] }),
    /unsupported message type/i,
  );
  assert.throws(
    () => normalizeExportRequest({ type: "export-artifact", tabId: 0, formats: ["json"] }),
    /tab id/i,
  );
  assert.throws(
    () => normalizeExportRequest({ type: "export-artifact", tabId: 7, formats: [] }),
    /at least one export format/i,
  );
  assert.throws(
    () => normalizeExportRequest({ type: "export-artifact", tabId: 7, formats: ["pdf"] }),
    /unsupported export format/i,
  );
});

test("createExportMessage maps one format or the complete bundle to the request contract", () => {
  assert.deepEqual(createExportMessage("json", 11), {
    type: "export-artifact",
    tabId: 11,
    formats: ["json"],
  });
  assert.deepEqual(createExportMessage("bundle", 11), {
    type: "export-artifact",
    tabId: 11,
    formats: ["json", "markdown", "html"],
  });
  assert.deepEqual(normalizeExportRequest(createExportMessage("markdown", 11)), {
    tabId: 11,
    formats: ["markdown"],
  });
});

test("createExportMessage rejects unsupported selections and invalid tab IDs", () => {
  assert.throws(() => createExportMessage("pdf", 11), /unsupported export selection/i);
  assert.throws(() => createExportMessage("json", 0), /tab id/i);
});

test("createExportSuccess returns serializable response metadata without sharing the input array", () => {
  const formats = ["json", "html"];
  const response = createExportSuccess(formats);

  assert.deepEqual(response, { ok: true, count: 2, formats: ["json", "html"] });
  assert.notEqual(response.formats, formats);
});
