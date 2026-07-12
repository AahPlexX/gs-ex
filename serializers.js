(() => {
  const FORMAT_DEFINITIONS = Object.freeze({
    json: Object.freeze({ extension: "genspark.json", mimeType: "application/json" }),
    markdown: Object.freeze({ extension: "md", mimeType: "text/markdown" }),
    html: Object.freeze({ extension: "html", mimeType: "text/html" }),
  });

  const asArray = (value) => (Array.isArray(value) ? value : []);
  const asText = (value) => String(value ?? "");

  const assertCapture = (capture) => {
    if (
      !capture ||
      capture.schemaVersion !== 1 ||
      typeof capture.source !== "object" ||
      typeof capture.artifact !== "object"
    ) {
      throw new TypeError("Expected a schema version 1 capture.");
    }
  };

  const safeHttpUrl = (value) => {
    try {
      const url = new URL(asText(value));
      return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
    } catch {
      return null;
    }
  };

  const escapeMarkdown = (value) =>
    asText(value).replace(/([\\`*_[\]<>])/g, "\\$1");

  const escapeHtml = (value) =>
    asText(value).replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );

  const serializeJson = (capture) => `${JSON.stringify(capture, null, 2)}\n`;

  const serializeMarkdown = (capture) => {
    const { source, artifact } = capture;
    const lines = [`# ${escapeMarkdown(artifact.title || source.title || "Untitled Genspark artifact")}`];
    const sourceUrl = safeHttpUrl(source.url);

    if (artifact.description) {
      lines.push("", escapeMarkdown(artifact.description));
    }

    lines.push("", "## Export details");
    lines.push(`- Type: ${escapeMarkdown(artifact.type || "unknown")}`);
    lines.push(`- Captured: ${escapeMarkdown(source.capturedAt || "Unknown")}`);
    if (sourceUrl) {
      lines.push(`- Source: <${sourceUrl}>`);
    }

    if (artifact.text) {
      lines.push("", "## Content", "", escapeMarkdown(artifact.text));
    }

    const slides = asArray(artifact.slides);
    if (slides.length > 0) {
      lines.push("", "## Slides");
      for (const slide of slides) {
        const slideNumber = Number.isFinite(slide.index) ? slide.index : lines.length;
        lines.push("", `### Slide ${slideNumber}`);
        if (slide.text) {
          lines.push("", escapeMarkdown(slide.text));
        }
        for (const imageUrl of asArray(slide.images)) {
          const safeUrl = safeHttpUrl(imageUrl);
          if (safeUrl) {
            lines.push("", `![Slide ${slideNumber} image](${safeUrl})`);
          }
        }
      }
    }

    const headings = asArray(artifact.headings);
    if (headings.length > 0) {
      lines.push("", "## Heading outline");
      for (const heading of headings) {
        lines.push(`- H${Number(heading.level) || 1}: ${escapeMarkdown(heading.text)}`);
      }
    }

    const links = asArray(artifact.links)
      .map((link) => ({ text: escapeMarkdown(link.text || link.url), url: safeHttpUrl(link.url) }))
      .filter((link) => link.url);
    if (links.length > 0) {
      lines.push("", "## Links");
      for (const link of links) {
        lines.push(`- [${link.text}](${link.url})`);
      }
    }

    const images = asArray(artifact.images)
      .map((image) => ({ alt: escapeMarkdown(image.alt || "Image"), url: safeHttpUrl(image.url) }))
      .filter((image) => image.url);
    if (images.length > 0) {
      lines.push("", "## Images");
      for (const image of images) {
        lines.push("", `![${image.alt}](${image.url})`);
      }
    }

    return `${lines.join("\n")}\n`;
  };

  const serializeHtml = (capture) => {
    const { source, artifact } = capture;
    const title = artifact.title || source.title || "Untitled Genspark artifact";
    const sourceUrl = safeHttpUrl(source.url);
    const language = /^[A-Za-z0-9-]{1,35}$/.test(asText(source.language)) ? source.language : "en";
    const csp = "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'";

    const details = [
      `<li><strong>Type:</strong> ${escapeHtml(artifact.type || "unknown")}</li>`,
      `<li><strong>Captured:</strong> <time datetime="${escapeHtml(source.capturedAt)}">${escapeHtml(source.capturedAt || "Unknown")}</time></li>`,
    ];
    if (sourceUrl) {
      details.push(`<li><strong>Source:</strong> <a href="${escapeHtml(sourceUrl)}" rel="noreferrer noopener">${escapeHtml(sourceUrl)}</a></li>`);
    }

    const contentSection = artifact.text
      ? `<section aria-labelledby="content-heading"><h2 id="content-heading">Content</h2><p>${escapeHtml(artifact.text)}</p></section>`
      : "";

    const slides = asArray(artifact.slides);
    const slidesSection = slides.length
      ? `<section aria-labelledby="slides-heading"><h2 id="slides-heading">Slides</h2>${slides
          .map((slide, index) => {
            const slideNumber = Number.isFinite(slide.index) ? slide.index : index + 1;
            const images = asArray(slide.images)
              .map((imageUrl) => safeHttpUrl(imageUrl))
              .filter(Boolean)
              .map((imageUrl) => `<img src="${escapeHtml(imageUrl)}" alt="Slide ${slideNumber} image" loading="lazy">`)
              .join("");
            return `<article><h3>Slide ${slideNumber}</h3>${slide.text ? `<p>${escapeHtml(slide.text)}</p>` : ""}${images}</article>`;
          })
          .join("")}</section>`
      : "";

    const headings = asArray(artifact.headings);
    const headingsSection = headings.length
      ? `<section aria-labelledby="outline-heading"><h2 id="outline-heading">Heading outline</h2><ul>${headings
          .map((heading) => `<li><strong>H${Number(heading.level) || 1}:</strong> ${escapeHtml(heading.text)}</li>`)
          .join("")}</ul></section>`
      : "";

    const links = asArray(artifact.links)
      .map((link) => ({ text: link.text || link.url, url: safeHttpUrl(link.url) }))
      .filter((link) => link.url);
    const linksSection = links.length
      ? `<section aria-labelledby="links-heading"><h2 id="links-heading">Links</h2><ul>${links
          .map((link) => `<li><a href="${escapeHtml(link.url)}" rel="noreferrer noopener">${escapeHtml(link.text)}</a></li>`)
          .join("")}</ul></section>`
      : "";

    const images = asArray(artifact.images)
      .map((image) => ({ alt: image.alt || "Image", url: safeHttpUrl(image.url) }))
      .filter((image) => image.url);
    const imagesSection = images.length
      ? `<section aria-labelledby="images-heading"><h2 id="images-heading">Images</h2><div class="images">${images
          .map((image) => `<figure><img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" loading="lazy"><figcaption>${escapeHtml(image.alt)}</figcaption></figure>`)
          .join("")}</div></section>`
      : "";

    return `<!doctype html>
<html lang="${escapeHtml(language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
<title>${escapeHtml(title)}</title>
<style>
:root { color-scheme: light dark; font-family: system-ui, sans-serif; line-height: 1.5; }
body { margin: 0 auto; max-width: 72rem; padding: clamp(1rem, 4vw, 3rem); }
main { display: grid; gap: 1.5rem; }
section, article { border: 1px solid currentColor; border-radius: 0.75rem; padding: 1rem; }
img { display: block; height: auto; max-width: 100%; }
.images { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr)); }
a { overflow-wrap: anywhere; }
</style>
</head>
<body>
<main>
<header><h1>${escapeHtml(title)}</h1>${artifact.description ? `<p>${escapeHtml(artifact.description)}</p>` : ""}</header>
<section aria-labelledby="details-heading"><h2 id="details-heading">Export details</h2><ul>${details.join("")}</ul></section>
${contentSection}
${slidesSection}
${headingsSection}
${linksSection}
${imagesSection}
</main>
</body>
</html>
`;
  };

  const serializeCapture = (capture, format) => {
    assertCapture(capture);
    const definition = FORMAT_DEFINITIONS[format];
    if (!definition) {
      throw new RangeError(`Unsupported export format: ${format}`);
    }

    const serializers = {
      json: serializeJson,
      markdown: serializeMarkdown,
      html: serializeHtml,
    };

    return {
      content: serializers[format](capture),
      extension: definition.extension,
      mimeType: definition.mimeType,
    };
  };

  const api = {
    serializeCapture,
  };

  globalThis.GensparkSerializers = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
