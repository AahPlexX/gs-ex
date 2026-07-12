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

const executeCapture = async (tabId) => {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["extractor.js"],
  });

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => globalThis.GensparkExporter?.captureArtifact(),
  });

  return result;
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

    const result = await executeCapture(tabId);

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
