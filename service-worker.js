const GENSPARK_HOSTS = new Set(["genspark.ai", "www.genspark.ai"]);

const setActionState = async (tabId, text, title) => {
  await Promise.all([
    chrome.action.setBadgeText({ tabId, text }),
    chrome.action.setTitle({ tabId, title }),
  ]);
};

const sanitizeFilename = (value) => {
  const sanitized = value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 100);

  return sanitized || "genspark-export";
};

const captureArtifact = () => {
  const normalizeText = (value) => value.replace(/\s+/g, " ").trim();
  const toAbsoluteUrl = (value) => {
    try {
      return new URL(value, document.baseURI).href;
    } catch {
      return null;
    }
  };

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

  const classifyArtifact = () => {
    const signal = `${location.pathname} ${document.title}`.toLowerCase();

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

  const root = document.querySelector("main") || document.body;
  const title =
    normalizeText(document.querySelector("h1")?.textContent || "") ||
    normalizeText(document.title) ||
    "Untitled Genspark artifact";

  const headings = visibleElements("h1, h2, h3, h4, h5, h6").map(
    (heading) => ({
      level: Number(heading.tagName.slice(1)),
      text: normalizeText(heading.textContent || ""),
    }),
  );

  const links = visibleElements("a[href]")
    .map((link) => ({
      text: normalizeText(link.textContent || ""),
      url: toAbsoluteUrl(link.getAttribute("href") || ""),
    }))
    .filter((link) => link.url);

  const images = visibleElements("img")
    .map((image) => ({
      alt: normalizeText(image.getAttribute("alt") || ""),
      url: toAbsoluteUrl(image.currentSrc || image.getAttribute("src") || ""),
      width: image.naturalWidth || null,
      height: image.naturalHeight || null,
    }))
    .filter((image) => image.url);

  const slideCandidates = visibleElements(
    '[data-slide-index], [data-testid*="slide" i], [aria-label*="slide" i], section[class*="slide" i]',
  );

  const slides = slideCandidates.map((slide, index) => ({
    index: index + 1,
    text: normalizeText(slide.innerText || slide.textContent || ""),
    images: [...slide.querySelectorAll("img")]
      .map((image) => toAbsoluteUrl(image.currentSrc || image.getAttribute("src") || ""))
      .filter(Boolean),
  }));

  return {
    schemaVersion: 1,
    source: {
      application: "Genspark",
      url: location.href,
      title,
      capturedAt: new Date().toISOString(),
      language: document.documentElement.lang || null,
    },
    artifact: {
      type: classifyArtifact(),
      title,
      description:
        document.querySelector('meta[name="description"]')?.getAttribute("content") || null,
      text: normalizeText(root?.innerText || root?.textContent || ""),
      headings,
      links,
      images,
      slides,
    },
  };
};

chrome.action.onClicked.addListener(async (tab) => {
  const tabId = tab.id;

  if (!tabId || !tab.url) {
    return;
  }

  let url;
  try {
    url = new URL(tab.url);
  } catch {
    await setActionState(tabId, "!", "This page cannot be exported.");
    return;
  }

  if (!GENSPARK_HOSTS.has(url.hostname)) {
    await setActionState(tabId, "!", "Open a Genspark artifact before exporting.");
    return;
  }

  try {
    await setActionState(tabId, "…", "Exporting Genspark artifact…");

    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func: captureArtifact,
    });

    if (!result?.artifact?.text && result?.artifact?.slides?.length === 0) {
      throw new Error("No exportable artifact content was found on this page.");
    }

    const filename = `${sanitizeFilename(result.artifact.title)}.genspark.json`;
    const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(result, null, 2),
    )}`;

    await chrome.downloads.download({
      url: dataUrl,
      filename,
      saveAs: true,
      conflictAction: "uniquify",
    });

    await setActionState(tabId, "✓", "Genspark artifact exported.");
  } catch (error) {
    console.error("Genspark export failed", error);
    await setActionState(
      tabId,
      "!",
      error instanceof Error ? error.message : "Genspark export failed.",
    );
  }
});
