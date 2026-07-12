(() => {
  const MAX_CANDIDATES = 150;
  const MAX_REPEATED_STRUCTURES = 50;
  const MAX_SAFE_TOKEN_LENGTH = 64;
  const MAX_SCANNED_ELEMENTS = 5000;

  const GENSPARK_HOSTS = new Set(["genspark.ai", "www.genspark.ai"]);
  const STRUCTURAL_WORDS = new Set([
    "body",
    "canvas",
    "card",
    "container",
    "content",
    "control",
    "controls",
    "deck",
    "doc",
    "document",
    "documents",
    "editor",
    "element",
    "elements",
    "frame",
    "grid",
    "image",
    "images",
    "item",
    "layer",
    "layers",
    "list",
    "main",
    "media",
    "node",
    "nodes",
    "outline",
    "page",
    "pages",
    "panel",
    "presentation",
    "preview",
    "region",
    "report",
    "research",
    "root",
    "scene",
    "scenes",
    "section",
    "sidebar",
    "slide",
    "slides",
    "stage",
    "surface",
    "thumbnail",
    "thumbnails",
    "toolbar",
    "track",
    "viewport",
    "workspace",
    "wrapper",
  ]);
  const ROUTE_WORDS = new Set([
    "doc",
    "document",
    "documents",
    "editor",
    "item",
    "page",
    "pages",
    "presentation",
    "presentations",
    "project",
    "report",
    "reports",
    "research",
    "share",
    "slide",
    "slides",
    "sparkpage",
    "tools",
    "view",
    "workspace",
  ]);
  const ARIA_ROLES = new Set([
    "article",
    "button",
    "dialog",
    "document",
    "figure",
    "group",
    "list",
    "listitem",
    "main",
    "navigation",
    "presentation",
    "region",
    "tab",
    "tabpanel",
    "toolbar",
  ]);
  const SAFE_ATTRIBUTE_NAMES = new Set([
    "aria-controls",
    "aria-current",
    "aria-describedby",
    "aria-expanded",
    "aria-hidden",
    "aria-label",
    "aria-labelledby",
    "aria-orientation",
    "aria-selected",
    "data-component",
    "data-index",
    "data-kind",
    "data-page",
    "data-role",
    "data-slide",
    "data-slot",
    "data-state",
    "data-test",
    "data-test-id",
    "data-testid",
    "data-type",
    "data-view",
    "role",
  ]);
  const DISPLAY_VALUES = new Set([
    "block",
    "contents",
    "flex",
    "grid",
    "inline",
    "inline-block",
    "inline-flex",
    "inline-grid",
    "list-item",
    "table",
  ]);
  const VISIBILITY_VALUES = new Set(["collapse", "hidden", "visible"]);
  const POSITION_VALUES = new Set(["absolute", "fixed", "relative", "static", "sticky"]);
  const SEMANTIC_TAGS = new Set(["article", "main", "section"]);
  const MEDIA_TAGS = new Set(["canvas", "iframe", "img", "svg"]);

  const asArray = (value) => (Array.isArray(value) ? value : []);
  const asText = (value) => String(value ?? "");
  const clampInteger = (value, { min = 0, max = 10_000_000 } = {}) => {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return 0;
    }
    return Math.min(max, Math.max(min, Math.round(number)));
  };

  const isSensitiveValue = (value) => {
    const text = asText(value).trim();
    return (
      !text ||
      text.length > MAX_SAFE_TOKEN_LENGTH ||
      /[?#]/.test(text) ||
      /^data:/i.test(text) ||
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text) ||
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(text) ||
      /\d{7,}/.test(text) ||
      /^(?:[0-9a-f]{16,}|[A-Za-z0-9+/_=-]{24,})$/i.test(text) ||
      /(?:bearer|token|secret|session|auth|authorization|api[-_]?key|access[-_]?key|jwt)\s*[:=]/i.test(text)
    );
  };

  const splitIdentifierWords = (value) =>
    asText(value)
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .toLowerCase()
      .split(/[-_]+/)
      .filter(Boolean);

  const sanitizeIdentifier = (value) => {
    const text = asText(value).trim();
    if (isSensitiveValue(text) || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(text)) {
      return null;
    }

    const words = splitIdentifierWords(text);
    if (words.length === 0 || words.some((word) => !STRUCTURAL_WORDS.has(word))) {
      return null;
    }

    return text;
  };

  const sanitizeUrlShape = (value, baseUrl) => {
    let url;
    try {
      url = new URL(value, baseUrl);
    } catch {
      return null;
    }

    if (
      url.protocol !== "https:" ||
      !GENSPARK_HOSTS.has(url.hostname) ||
      url.username ||
      url.password
    ) {
      return null;
    }

    const segments = url.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => {
        let decoded = segment;
        try {
          decoded = decodeURIComponent(segment);
        } catch {
          decoded = segment;
        }
        const normalized = decoded.toLowerCase();
        return ROUTE_WORDS.has(normalized) ? normalized : ":segment";
      });

    return {
      origin: url.origin,
      pathnameShape: segments.length > 0 ? `/${segments.join("/")}` : "/",
    };
  };

  const sanitizeLanguage = (value) => {
    const text = asText(value).trim();
    return /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(text) ? text : null;
  };

  const sanitizeTagName = (value) => {
    const text = asText(value).trim().toLowerCase();
    return /^[a-z][a-z0-9-]{0,31}$/.test(text) ? text : null;
  };

  const sanitizeStructuralPath = (value) => {
    const text = asText(value).trim().toLowerCase();
    const segment = "[a-z][a-z0-9-]{0,31}(?::nth-of-type\\([1-9]\\d{0,5}\\))?";
    return new RegExp(`^${segment}(?:>${segment})*$`).test(text) && text.length <= 512
      ? text
      : null;
  };

  const sanitizeRole = (value) => {
    const role = asText(value).trim().toLowerCase();
    return ARIA_ROLES.has(role) ? role : null;
  };

  const sanitizeAttributes = (value) => {
    const entries = Array.isArray(value)
      ? value.map((entry) => [entry?.name, entry?.value])
      : Object.entries(value && typeof value === "object" ? value : {});

    return entries
      .map(([name, attributeValue]) => [asText(name).toLowerCase(), attributeValue])
      .filter(([name]) => SAFE_ATTRIBUTE_NAMES.has(name))
      .map(([name, attributeValue]) => ({
        name,
        value: name === "role" ? sanitizeRole(attributeValue) : sanitizeIdentifier(attributeValue),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const sanitizeBounds = (value) => ({
    x: clampInteger(value?.x, { min: -10_000_000 }),
    y: clampInteger(value?.y, { min: -10_000_000 }),
    width: clampInteger(value?.width),
    height: clampInteger(value?.height),
  });

  const sanitizeCounts = (value) => ({
    canvas: clampInteger(value?.canvas),
    svg: clampInteger(value?.svg),
    img: clampInteger(value?.img),
    iframe: clampInteger(value?.iframe),
    role: clampInteger(value?.role),
  });

  const sanitizeCandidate = (candidate) => {
    const path = sanitizeStructuralPath(candidate?.path);
    const tagName = sanitizeTagName(candidate?.tagName);
    if (!path || !tagName) {
      return null;
    }

    return {
      path,
      tagName,
      safeId: sanitizeIdentifier(candidate.id),
      safeClasses: [...new Set(asArray(candidate.classes).map(sanitizeIdentifier).filter(Boolean))]
        .sort(),
      safeAttributes: sanitizeAttributes(candidate.attributes),
      role: sanitizeRole(candidate.role),
      childElementCount: clampInteger(candidate.childElementCount),
      textLength: asText(candidate.text).length,
      bounds: sanitizeBounds(candidate.bounds),
      display: DISPLAY_VALUES.has(candidate.display) ? candidate.display : null,
      visibility: VISIBILITY_VALUES.has(candidate.visibility) ? candidate.visibility : null,
      position: POSITION_VALUES.has(candidate.position) ? candidate.position : null,
      descendantCounts: sanitizeCounts(candidate.descendantCounts),
    };
  };

  const sanitizeChildSignature = (value) => {
    const match = /^([a-z][a-z0-9-]{0,31}):([A-Za-z][A-Za-z0-9_-]*)$/.exec(
      asText(value).trim(),
    );
    if (!match) {
      return null;
    }
    const tagName = sanitizeTagName(match[1]);
    const identifier = sanitizeIdentifier(match[2]);
    return tagName && identifier ? `${tagName}:${identifier}` : null;
  };

  const sanitizeRepeatedStructure = (structure) => {
    const parentPath = sanitizeStructuralPath(structure?.parentPath);
    const childSignature = sanitizeChildSignature(structure?.childSignature);
    if (!parentPath || !childSignature) {
      return null;
    }

    return {
      parentPath,
      childSignature,
      count: clampInteger(structure.count),
      representativeBounds: {
        width: clampInteger(structure?.representativeBounds?.width),
        height: clampInteger(structure?.representativeBounds?.height),
      },
    };
  };

  const normalizeTimestamp = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new TypeError("Expected a valid capture timestamp.");
    }
    return date.toISOString();
  };

  const createDiagnosticSnapshot = ({
    url,
    capturedAt = new Date().toISOString(),
    viewport = {},
    documentLanguage = null,
    title = "",
    bodyChildCount = 0,
    capabilities = {},
    candidates = [],
    repeatedStructures = [],
  } = {}) => {
    const pageShape = sanitizeUrlShape(url, url);
    if (!pageShape) {
      throw new TypeError("Expected a supported Genspark URL.");
    }

    const sanitizedCandidates = asArray(candidates)
      .map(sanitizeCandidate)
      .filter(Boolean)
      .sort((a, b) => a.path.localeCompare(b.path) || a.tagName.localeCompare(b.tagName))
      .slice(0, MAX_CANDIDATES);

    if (sanitizedCandidates.length === 0) {
      throw new Error("No structural diagnostic candidates were found.");
    }

    const sanitizedRepeatedStructures = asArray(repeatedStructures)
      .map(sanitizeRepeatedStructure)
      .filter(Boolean)
      .sort(
        (a, b) =>
          a.parentPath.localeCompare(b.parentPath) ||
          a.childSignature.localeCompare(b.childSignature),
      )
      .slice(0, MAX_REPEATED_STRUCTURES);

    return {
      diagnosticSchemaVersion: 1,
      capturedAt: normalizeTimestamp(capturedAt),
      page: {
        origin: pageShape.origin,
        pathnameShape: pageShape.pathnameShape,
        viewport: {
          width: clampInteger(viewport.width),
          height: clampInteger(viewport.height),
          devicePixelRatio: Math.min(10, Math.max(0, Number(viewport.devicePixelRatio) || 0)),
        },
        documentLanguage: sanitizeLanguage(documentLanguage),
        titleLength: asText(title).length,
        bodyChildCount: clampInteger(bodyChildCount),
      },
      capabilities: {
        openShadowRootCount: clampInteger(capabilities.openShadowRootCount),
        iframeCount: clampInteger(capabilities.iframeCount),
        canvasCount: clampInteger(capabilities.canvasCount),
        svgCount: clampInteger(capabilities.svgCount),
        imageCount: clampInteger(capabilities.imageCount),
      },
      candidates: sanitizedCandidates,
      repeatedStructures: sanitizedRepeatedStructures,
    };
  };

  const captureDiagnostic = () => {
    const scannedElements = [...document.querySelectorAll("*")].slice(0, MAX_SCANNED_ELEMENTS);

    const isVisible = (element) => {
      const style = getComputedStyle(element);
      const bounds = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        bounds.width > 0 &&
        bounds.height > 0
      );
    };

    const structuralPath = (element) => {
      const parts = [];
      let current = element;
      while (current?.nodeType === Node.ELEMENT_NODE && parts.length < 20) {
        const tagName = current.tagName.toLowerCase();
        const siblings = current.parentElement
          ? [...current.parentElement.children].filter(
              (sibling) => sibling.tagName === current.tagName,
            )
          : [];
        const index = siblings.length > 1 ? siblings.indexOf(current) + 1 : null;
        parts.unshift(index ? `${tagName}:nth-of-type(${index})` : tagName);
        if (current === document.documentElement) {
          break;
        }
        current = current.parentElement;
      }
      return parts.join(">");
    };

    const rawAttributes = (element) =>
      Object.fromEntries(
        [...element.attributes]
          .filter((attribute) => /^(?:role|data-|aria-)/i.test(attribute.name))
          .map((attribute) => [attribute.name, attribute.value]),
      );

    const hasStructuralSignal = (element) => {
      const values = [
        element.id,
        ...element.classList,
        ...[...element.attributes]
          .filter((attribute) => /^(?:role|data-|aria-)/i.test(attribute.name))
          .map((attribute) => attribute.value),
      ];
      const signal = values.join(" ").toLowerCase();
      return [...STRUCTURAL_WORDS].some((word) => signal.includes(word));
    };

    const candidateElements = scannedElements
      .filter(isVisible)
      .filter((element) => {
        const tagName = element.tagName.toLowerCase();
        return (
          SEMANTIC_TAGS.has(tagName) ||
          MEDIA_TAGS.has(tagName) ||
          Boolean(element.getAttribute("role")) ||
          Boolean(element.shadowRoot) ||
          hasStructuralSignal(element)
        );
      })
      .slice(0, MAX_CANDIDATES * 3);

    const candidates = candidateElements.map((element) => {
      const bounds = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        path: structuralPath(element),
        tagName: element.tagName.toLowerCase(),
        id: element.id,
        classes: [...element.classList],
        attributes: rawAttributes(element),
        role: element.getAttribute("role"),
        childElementCount: element.childElementCount,
        text: element.innerText || element.textContent || "",
        bounds: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        },
        display: style.display,
        visibility: style.visibility,
        position: style.position,
        descendantCounts: {
          canvas: element.querySelectorAll("canvas").length,
          svg: element.querySelectorAll("svg").length,
          img: element.querySelectorAll("img").length,
          iframe: element.querySelectorAll("iframe").length,
          role: element.querySelectorAll("[role]").length,
        },
      };
    });

    const repeatedStructures = [];
    for (const parent of scannedElements.filter(isVisible)) {
      const children = [...parent.children].filter(isVisible);
      if (children.length < 2) {
        continue;
      }

      const groups = new Map();
      for (const child of children) {
        const safeClass = [...child.classList].map(sanitizeIdentifier).find(Boolean);
        if (!safeClass) {
          continue;
        }
        const signature = `${child.tagName.toLowerCase()}:${safeClass}`;
        const group = groups.get(signature) || [];
        group.push(child);
        groups.set(signature, group);
      }

      for (const [childSignature, group] of groups) {
        if (group.length < 2) {
          continue;
        }
        const bounds = group[0].getBoundingClientRect();
        repeatedStructures.push({
          parentPath: structuralPath(parent),
          childSignature,
          count: group.length,
          representativeBounds: { width: bounds.width, height: bounds.height },
        });
        if (repeatedStructures.length >= MAX_REPEATED_STRUCTURES * 3) {
          break;
        }
      }

      if (repeatedStructures.length >= MAX_REPEATED_STRUCTURES * 3) {
        break;
      }
    }

    return createDiagnosticSnapshot({
      url: location.href,
      capturedAt: new Date().toISOString(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      },
      documentLanguage: document.documentElement.lang,
      title: document.title,
      bodyChildCount: document.body?.childElementCount || 0,
      capabilities: {
        openShadowRootCount: scannedElements.filter((element) => Boolean(element.shadowRoot)).length,
        iframeCount: document.querySelectorAll("iframe").length,
        canvasCount: document.querySelectorAll("canvas").length,
        svgCount: document.querySelectorAll("svg").length,
        imageCount: document.querySelectorAll("img").length,
      },
      candidates,
      repeatedStructures,
    });
  };

  const api = {
    captureDiagnostic,
    createDiagnosticSnapshot,
    sanitizeIdentifier,
    sanitizeUrlShape,
  };

  globalThis.GensparkDiagnostics = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})();
