const CLOUD_ORIGIN = "https://cloud.hiddenroom.mx";
const list = document.getElementById("docs-list");
const status = document.getElementById("docs-status");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
  }[character]));
}

function formatSize(value) {
  const size = Number(value || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(date);
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function renderEmpty(message) {
  list.innerHTML = `<div class="docs-empty"><strong>Sin documentos</strong><span>${escapeHtml(message)}</span></div>`;
}

function renderDocuments(files) {
  const pdfs = (Array.isArray(files) ? files : []).filter((file) => /\.pdf$/i.test(String(file?.name || "")));
  if (!pdfs.length) {
    renderEmpty("Aún no hay PDFs publicados en Raíz Cloud /docs.");
    return;
  }

  list.innerHTML = pdfs.map((file) => {
    const viewUrl = String(file.view_url || "");
    const downloadUrl = String(file.download_url || "");
    return `
      <article class="docs-file-card db-card-list__item">
        <div class="docs-file-card__main">
          <span class="docs-file-card__type">PDF</span>
          <h2 class="docs-file-card__title">${escapeHtml(file.name)}</h2>
          <p class="docs-file-card__meta">${escapeHtml(formatSize(file.size))}${file.modified ? ` · ${escapeHtml(formatDate(file.modified))}` : ""}</p>
        </div>
        <div class="docs-file-card__actions">
          <a class="db-download-action db-download-action--primary" href="${escapeHtml(viewUrl)}" target="_blank" rel="noopener">Ver</a>
          <a class="db-download-action" href="${escapeHtml(downloadUrl)}">Descargar</a>
          </div>
      </article>`;
  }).join("");
}

async function loadDocuments() {
  list.setAttribute("aria-busy", "true");
  setStatus("Cargando documentos…");
  try {
    const response = await fetch(`${CLOUD_ORIGIN}/api/public-docs`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || "No se pudo consultar Raíz Cloud.");
    renderDocuments(payload?.files);
    const count = Array.isArray(payload?.files) ? payload.files.length : 0;
    setStatus(`${count} PDF disponible${count === 1 ? "" : "s"}.`);
  } catch (error) {
    renderEmpty("No se pudo cargar la biblioteca de documentos.");
    setStatus(error.message || "No se pudo cargar la biblioteca de documentos.", true);
  } finally {
    list.setAttribute("aria-busy", "false");
  }
}

loadDocuments();
