const test = require("node:test");
const assert = require("node:assert/strict");

const {
  classifyArtifact,
  createArtifactCapture,
  normalizeText,
} = require("../extractor.js");

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
  const capture = createArtifactCapture({
    url: "https://www.genspark.ai/slides/example",
    pathname: "/slides/example",
    documentTitle: "  Product\nLaunch  ",
    headingTitle: " Product Launch ",
    language: "en",
    description: "  A launch deck  ",
    mainText: " Intro\n\nDetails ",
    headings: [{ level: 2, text: "  Overview " }],
    links: [{ text: " Source ", url: "/sources/1" }],
    images: [{ alt: " Diagram ", url: "/assets/diagram.png", width: 640, height: 480 }],
    slides: [{ text: " First slide ", images: ["/assets/slide.png"] }],
    capturedAt: "2026-07-12T12:00:00.000Z",
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
