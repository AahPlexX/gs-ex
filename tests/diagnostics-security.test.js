const test = require("node:test");
const assert = require("node:assert/strict");

const { createDiagnosticSnapshot } = require("../diagnostics.js");

test("diagnostic snapshots retain only approved structural attribute names", () => {
  const snapshot = createDiagnosticSnapshot({
    url: "https://www.genspark.ai/slides/private-project",
    capturedAt: "2026-07-12T12:00:00.000Z",
    title: "Private deck",
    candidates: [
      {
        path: "html>body>main>section",
        tagName: "section",
        attributes: {
          "data-testid": "slide-card",
          "aria-label": "slide-panel",
          "data-private-project-84729301": "slide-card",
          "aria-secret-account": "slide-panel",
        },
        text: "Private slide content",
      },
    ],
  });

  assert.deepEqual(snapshot.candidates[0].safeAttributes, [
    { name: "aria-label", value: "slide-panel" },
    { name: "data-testid", value: "slide-card" },
  ]);

  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /private-project-84729301/i);
  assert.doesNotMatch(serialized, /secret-account/i);
});
