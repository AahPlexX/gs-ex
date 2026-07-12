(() => {
  const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

  const toAbsoluteUrl = (value, baseUrl) => {
    try {
      return new URL(value, baseUrl).href;
    } catch {
      return null;
    }
  };

  const classifyArtifact = ({ pathname = "", title = "" } = {}) => {
    const signal = `${pathname} ${title}`.toLowerCase();

    if (/slide|presentation|deck/.test(signal)) {
      return "slides";
    }

    if (/document|\bdoc\b|writer/.test(signal)) {
      return "document";
    }

    if (/page|sparkpage|report|research/.test(signal)) {
      return "page";
    }

    return "unknown";
  };

  const createArtifactCapture = ({
    url,
    pathname = "",
    documentTitle = "",
    headingTitle = "",
    language = null,
    description = null,
    mainText = "",
    headings = [],
    links = [],
    images = [],
    slides = [],
    capturedAt = new Date().toISOString(),
  }) => {
    const title = normalizeText(headingTitle) || normalizeText(documentTitle) || "Untitled Genspark artifact";

    return {
      schemaVersion: 1,
      source: {
        application: "Genspark",
        url,
        title,
        capturedAt,
        language: normalizeText(language) || null,
      },
      artifact: {
        type: classifyArtifact({ pathname, title: documentTitle }),
        title,
        description: normalizeText(description) || null,
        text: normalizeText(mainText),
        headings: headings.map((heading) => ({
          level: Number(heading.level),
          text: normalizeText(heading.text),
        })),
        links: links
          .map((link) => ({
            text: normalizeText(link.text),
            url: toAbsoluteUrl(link.url, url),
          }))
          .filter((link) => link.url),
        images: images
          .map((image) => ({
            alt: normalizeText(image.alt),
            url: toAbsoluteUrl(image.url, url),
            width: Number.isFinite(image.width) && image.width > 0 ? image.width : null,
            height: Number.isFinite(image.height) && image.height > 0 ? image.height : null,
          }))
          .filter((image) => image.url),
        slides: slides.map((slide, index) => ({
          index: index + 1,
          text: normalizeText(slide.text),
          images: (slide.images || [])
            .map((imageUrl) => toAbsoluteUrl(imageUrl, url))
            .filter(Boolean),
        })),
      },
    };
  };

  const captureArtifact = () => {
    const visibleElements = (selector) =>
      [...document.querySelectorAll(selector)].filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      });

    const root = document.querySelector("main") || document.body;
    const slideCandidates = visibleElements(
      '[data-slide-index], [data-testid*="slide" i], [aria-label*="slide" i], section[class*="slide" i]',
    );

    return createArtifactCapture({
      url: location.href,
      pathname: location.pathname,
      documentTitle: document.title,
      headingTitle: document.querySelector("h1")?.textContent || "",
      language: document.documentElement.lang || null,
      description: document.querySelector('meta[name="description"]')?.getAttribute("content") || null,
      mainText: root?.innerText || root?.textContent || "",
      headings: visibleElements("h1, h2, h3, h4, h5, h6").map((heading) => ({
        level: Number(heading.tagName.slice(1)),
        text: heading.textContent || "",
      })),
      links: visibleElements("a[href]").map((link) => ({
        text: link.textContent || "",
        url: link.getAttribute("href") || "",
      })),
      images: visibleElements("img").map((image) => ({
        alt: image.getAttribute("alt") || "",
        url: image.currentSrc || image.getAttribute("src") || "",
        width: image.naturalWidth,
        height: image.naturalHeight,
      })),
      slides: slideCandidates.map((slide) => ({
        text: slide.innerText || slide.textContent || "",
        images: [...slide.querySelectorAll("img")].map(
          (image) => image.currentSrc || image.getAttribute("src") || "",
        ),
      })),
    });
  };

  const api = {
    captureArtifact,
    classifyArtifact,
    createArtifactCapture,
    normalizeText,
  };

  globalThis.GensparkExporter = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
