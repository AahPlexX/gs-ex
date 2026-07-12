(() => {
  const EXPORT_FORMATS = Object.freeze(["json", "markdown", "html"]);

  const createDiagnosticMessage = (tabId) => {
    if (!Number.isInteger(tabId) || tabId <= 0) {
      throw new TypeError("Expected a positive tab ID.");
    }

    return { type: "capture-diagnostic", tabId };
  };

  const createExportMessage = (selection, tabId) => {
    if (!Number.isInteger(tabId) || tabId <= 0) {
      throw new TypeError("Expected a positive tab ID.");
    }

    const formats =
      selection === "bundle"
        ? [...EXPORT_FORMATS]
        : EXPORT_FORMATS.includes(selection)
          ? [selection]
          : null;

    if (!formats) {
      throw new RangeError(`Unsupported export selection: ${String(selection)}`);
    }

    return {
      type: "export-artifact",
      tabId,
      formats,
    };
  };

  const setFormBusy = (form, busy) => {
    form.setAttribute("aria-busy", String(busy));

    for (const control of form.elements) {
      control.disabled = busy;
    }
  };

  const setStatus = (status, message, state = "idle") => {
    status.textContent = message;
    status.dataset.state = state;
  };

  const getActiveTabId = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!Number.isInteger(tab?.id) || tab.id <= 0) {
      throw new Error("The active tab is unavailable.");
    }
    return tab.id;
  };

  const runRequest = async ({
    form,
    status,
    pendingMessage,
    requestFactory,
    successMessage,
  }) => {
    setFormBusy(form, true);
    setStatus(status, pendingMessage, "pending");

    try {
      const response = await chrome.runtime.sendMessage(requestFactory(await getActiveTabId()));
      if (!response?.ok) {
        throw new Error(response?.error || "The request did not complete.");
      }
      setStatus(status, successMessage(response), "success");
    } catch (error) {
      setStatus(
        status,
        error instanceof Error ? error.message : "The request did not complete.",
        "error",
      );
    } finally {
      setFormBusy(form, false);
    }
  };

  const submitExport = async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const status = document.querySelector("#status");
    const selection = new FormData(form).get("format");

    await runRequest({
      form,
      status,
      pendingMessage: "Exporting…",
      requestFactory: (tabId) => createExportMessage(selection, tabId),
      successMessage: (response) =>
        `Exported ${response.count} ${response.count === 1 ? "file" : "files"}.`,
    });
  };

  const submitDiagnostic = async () => {
    const form = document.querySelector("#export-form");
    const status = document.querySelector("#status");

    await runRequest({
      form,
      status,
      pendingMessage: "Collecting sanitized structure…",
      requestFactory: createDiagnosticMessage,
      successMessage: (response) => {
        if (response.kind !== "diagnostic") {
          throw new Error("The diagnostic response was invalid.");
        }
        return "Downloaded sanitized diagnostic.";
      },
    });
  };

  if (typeof document !== "undefined") {
    document.querySelector("#export-form")?.addEventListener("submit", submitExport);
    document.querySelector("#diagnostic-button")?.addEventListener("click", submitDiagnostic);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      createDiagnosticMessage,
      createExportMessage,
    };
  }
})();
