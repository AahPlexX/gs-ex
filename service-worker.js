if (typeof importScripts === "function") {
  importScripts("serializers.js");
}

const GENSPARK_HOSTS = new Set(["genspark.ai", "www.genspark.ai"]);
const SUPPORTED_EXPORT_FORMATS = new Set(["json", "markdown", "html"]);

const normalizeDiagnosticRequest = (message) => {
  if (!message || typeof message !== "object" || message.type !== "capture-diagnostic") {
    throw new TypeError("Unsupported message type.");
  }

  if (!Number.isInteger(message.tabId) || message.tabId <= 0) {
    throw new TypeError("Expected a positive tab ID.");
  }

  return { tabId: message.tabId };
};

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

const createDiagnosticSuccess = () => ({
  ok: true,
  count: 1,
  kind: "diagnostic",
});

const createDiagnosticFilename = (capturedAt) => {
  const date = new Date(capturedAt);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Expected a valid capture timestamp.");
  }

  return `genspark-diagnostic-${date.toISOString().replace(/[:.]/g, "-")}.json`;
};

const createExportSuccess = (formats) => ({
  ok: true,
  count: formats.length,
  formats: [...formats],
});

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

const getValidatedGensparkUrl = async (tabId, unavailableMessage, invalidUrlMessage, hostMessage) => {
  const tab = await chrome.tabs.get(tabId);
  if (!tab?.url) {
    throw new Error(unavailableMessage);
  }

  let url;
  try {
    url = new URL(tab.url);
  } catch {
    throw new Error(invalidUrlMessage);
  }

  if (!GENSPARK_HOSTS.has(url.hostname)) {
    throw new Error(hostMessage);
  }

  return url;
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

const executeDiagnosticCapture = async (tabId) => {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["diagnostics.js"],
  });

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => globalThis.GensparkDiagnostics?.captureDiagnostic(),
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

const downloadDiagnostic = async (snapshot) => {
  const content = `${JSON.stringify(snapshot, null, 2)}\n`;
  const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(content)}`;

  await chrome.downloads.download({
    url: dataUrl,
    filename: `Genspark Diagnostics/${createDiagnosticFilename(snapshot.capturedAt)}`,
    saveAs: false,
    conflictAction: "uniquify",
  });
};

const exportArtifact = async ({ tabId, formats }) => {
  await getValidatedGensparkUrl(
    tabId,
    "The selected tab cannot be exported.",
    "The selected tab has an invalid URL.",
    "Open a Genspark artifact before exporting.",
  );

  await setActionState(tabId, "…", "Exporting Genspark artifact…");
  const capture = await executeCapture(tabId);

  if (!capture?.artifact?.text && capture?.artifact?.slides?.length === 0) {
    throw new Error("No exportable artifact content was found on this page.");
  }

  await downloadExports(capture, formats);
  const response = createExportSuccess(formats);
  await setActionState(
    tabId,
    String(response.count),
    `Exported ${response.count} ${response.count === 1 ? "file" : "files"}.`,
  );

  return response;
};

const captureDiagnostic = async ({ tabId }) => {
  await getValidatedGensparkUrl(
    tabId,
    "The selected tab cannot be inspected.",
    "The selected tab has an invalid URL.",
    "Open a Genspark artifact before collecting a diagnostic.",
  );

  await setActionState(tabId, "…", "Collecting sanitized Genspark structure…");
  const snapshot = await executeDiagnosticCapture(tabId);

  if (!snapshot?.candidates?.length) {
    throw new Error("No structural diagnostic candidates were found on this page.");
  }

  await downloadDiagnostic(snapshot);
  await setActionState(tabId, "D", "Downloaded sanitized Genspark diagnostic.");
  return createDiagnosticSuccess();
};

const toErrorMessage = (error) =>
  error instanceof Error ? error.message : "Genspark export failed.";

const registerMessageListener = () => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!["capture-diagnostic", "export-artifact"].includes(message?.type)) {
      return false;
    }

    const operation =
      message.type === "capture-diagnostic"
        ? () => captureDiagnostic(normalizeDiagnosticRequest(message))
        : () => exportArtifact(normalizeExportRequest(message));

    Promise.resolve()
      .then(operation)
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
    createDiagnosticFilename,
    createDiagnosticSuccess,
    createExportSuccess,
    normalizeDiagnosticRequest,
    normalizeExportRequest,
  };
}
