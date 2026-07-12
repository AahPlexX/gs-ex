if (typeof importScripts === "function") {
  importScripts("serializers.js");
}

const GENSPARK_HOSTS = new Set(["genspark.ai", "www.genspark.ai"]);
const SUPPORTED_EXPORT_FORMATS = new Set(["json", "markdown", "html"]);

const normalizeExportRequest = (message) => {
  if (!message || typeof message !== "object" || message.type !== "export-artifact") {
    throw new TypeError("Unsupported message type.");
  }

  if (!Number.isInteger(message.tabId) || message.tabId <= 0) {
    throw new TypeError("Expected a positive tab ID.");
  }

  if (!Array.isArray(message.formats) || message.formats.length === 0) {
    throw new TypeError("Expected at least one export format.");
  }

  const formats = [...new Set(message.formats)];
  const unsupportedFormat = formats.find(
    (format) => typeof format !== "string" || !SUPPORTED_EXPORT_FORMATS.has(format),
  );

  if (unsupportedFormat !== undefined) {
    throw new RangeError(`Unsupported export format: ${String(unsupportedFormat)}`);
  }

  return { tabId: message.tabId, formats };
};

const setActionState = async (tabId, text, title) => {
  await Promise.all([
    chrome.action.setBadgeText({ tabId, text }),
    chrome.action.setTitle({ tabId, title }),
  ]);
};

const sanitizeFilename = (value) => {
  const sanitized = String(value ?? "")
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

const downloadExports = async (capture, formats) => {
  const basename = sanitizeFilename(capture.artifact.title);
  const directory = `Genspark Exports/${basename}`;

  for (const format of formats) {
    const { content, extension, mimeType } =
      globalThis.GensparkSerializers.serializeCapture(capture, format);
    const dataUrl = `data:${mimeType};charset=utf-8,${encodeURIComponent(content)}`;

    await chrome.downloads.download({
      url: dataUrl,
      filename: `${directory}/${basename}.${extension}`,
      saveAs: false,
      conflictAction: "uniquify",
    });
  }
};

const exportArtifact = async ({ tabId, formats }) => {
  const tab = await chrome.tabs.get(tabId);

  if (!tab?.url) {
    throw new Error("The selected tab cannot be exported.");
  }

  let url;
  try {
    url = new URL(tab.url);
  } catch {
    throw new Error("The selected tab has an invalid URL.");
  }

  if (!GENSPARK_HOSTS.has(url.hostname)) {
    throw new Error("Open a Genspark artifact before exporting.");
  }

  await setActionState(tabId, "…", "Exporting Genspark artifact…");
  const capture = await executeCapture(tabId);

  if (!capture?.artifact?.text && capture?.artifact?.slides?.length === 0) {
    throw new Error("No exportable artifact content was found on this page.");
  }

  await downloadExports(capture, formats);
  const count = formats.length;
  await setActionState(
    tabId,
    String(count),
    `Exported ${count} ${count === 1 ? "file" : "files"}.`,
  );

  return { ok: true, count, formats };
};

const toErrorMessage = (error) =>
  error instanceof Error ? error.message : "Genspark export failed.";

const registerMessageListener = () => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "export-artifact") {
      return false;
    }

    Promise.resolve()
      .then(() => normalizeExportRequest(message))
      .then((request) => exportArtifact(request))
      .catch(async (error) => {
        const tabId = Number.isInteger(message?.tabId) ? message.tabId : undefined;
        if (tabId) {
          await setActionState(tabId, "!", toErrorMessage(error)).catch(() => {});
        }
        return { ok: false, error: toErrorMessage(error) };
      })
      .then(sendResponse);

    return true;
  });
};

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  registerMessageListener();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    normalizeExportRequest,
  };
}
