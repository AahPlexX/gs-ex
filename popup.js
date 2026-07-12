(() => {
  const EXPORT_FORMATS = Object.freeze(["json", "markdown", "html"]);

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

  const submitExport = async (event) => {
    event.preventDefault();

    const form = event.currentTarget;
    const status = document.querySelector("#status");
    const selection = new FormData(form).get("format");

    setFormBusy(form, true);
    setStatus(status, "Exporting…", "pending");

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const request = createExportMessage(selection, tab?.id);
      const response = await chrome.runtime.sendMessage(request);

      if (!response?.ok) {
        throw new Error(response?.error || "The export did not complete.");
      }

      setStatus(
        status,
        `Exported ${response.count} ${response.count === 1 ? "file" : "files"}.`,
        "success",
      );
    } catch (error) {
      setStatus(
        status,
        error instanceof Error ? error.message : "The export did not complete.",
        "error",
      );
    } finally {
      setFormBusy(form, false);
    }
  };

  if (typeof document !== "undefined") {
    document.querySelector("#export-form")?.addEventListener("submit", submitExport);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      createExportMessage,
    };
  }
})();
