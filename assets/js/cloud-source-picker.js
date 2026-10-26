const DEFAULT_CLOUD_ORIGIN = "https://cloud.hiddenroom.mx";

export function normalizeCloudPath(value) {
  if (!value || value === "/") return "/";
  let path = String(value).replace(/\\/g, "/").replace(/\/+/g, "/");
  if (!path.startsWith("/")) path = `/${path}`;
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
}

export function joinCloudPath(parent, name) {
  const base = normalizeCloudPath(parent);
  const child = String(name || "").replace(/^\/+|\/+$/g, "");
  return normalizeCloudPath(base === "/" ? `/${child}` : `${base}/${child}`);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}
function bytesLabel(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes; let index = -1;
  do { size /= 1024; index += 1; } while (size >= 1024 && index < units.length - 1);
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`;
}
function fileSource(path, item) {
  return { kind: "file", path: normalizeCloudPath(path), name: String(item?.name || item?.fileName || "").trim(), size: Number(item?.size) || 0, mimeType: item?.mimeType || item?.type || "application/octet-stream" };
}
function folderSource(path, name) { return { kind: "folder", path: normalizeCloudPath(path), name: String(name || "").trim() }; }
function sourceFolderPath(source) { return joinCloudPath(source.path, source.name); }

async function headersFor(supabase, accept = "application/json") {
  const { data: { session } = {} } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sesión de Supabase no disponible.");
  return { Accept: accept, Authorization: `Bearer ${session.access_token}` };
}

async function listPath({ supabase, cloudOrigin = DEFAULT_CLOUD_ORIGIN, path }) {
  const origin = String(cloudOrigin || DEFAULT_CLOUD_ORIGIN).replace(/\/$/, "");
  const response = await fetch(`${origin}/api/files?path=${encodeURIComponent(normalizeCloudPath(path))}`, { headers: await headersFor(supabase) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || `No se pudo cargar Cloud (${response.status}).`);
  if (body?.status === "pending") throw new Error("Cloud está procesando la carpeta. Intenta de nuevo.");
  const listedPath = normalizeCloudPath(body?.path || path);
  return { path: listedPath, folders: (body?.folders || []).map((item) => String(item?.name || item)).filter(Boolean), files: (body?.files || []).map((item) => fileSource(listedPath, item)).filter((item) => item.name) };
}

export async function cloudSourceToFile(source, { supabase, cloudOrigin = DEFAULT_CLOUD_ORIGIN } = {}) {
  if (!source || source.kind !== "file") throw new Error("La fuente Cloud no es un archivo.");
  const response = await fetch(`${cloudOrigin.replace(/\/$/, "")}/api/download?path=${encodeURIComponent(normalizeCloudPath(source.path))}&name=${encodeURIComponent(source.name)}`, { headers: await headersFor(supabase, "application/octet-stream") });
  if (!response.ok) throw new Error((await response.text().catch(() => "")) || `No se pudo leer el archivo de Cloud (${response.status}).`);
  const blob = await response.blob();
  return new File([blob], source.name, { type: source.mimeType || blob.type || "application/octet-stream", lastModified: Date.now() });
}

export async function walkCloudSource(source, { supabase, cloudOrigin = DEFAULT_CLOUD_ORIGIN, maxFiles = 500 } = {}) {
  if (!source || source.kind !== "folder") return [];
  const files = [];
  async function walk(path, relative = "") {
    if (files.length >= maxFiles) throw new Error(`La carpeta supera el límite de ${maxFiles} archivos.`);
    const listing = await listPath({ supabase, cloudOrigin, path });
    listing.files.forEach((file) => files.push({ ...file, relativePath: relative ? `${relative}/${file.name}` : file.name }));
    for (const folder of listing.folders) await walk(joinCloudPath(path, folder), relative ? `${relative}/${folder}` : folder);
  }
  await walk(sourceFolderPath(source));
  return files;
}

function installStyles() {
  if (document.getElementById("hr-cloud-picker-styles")) return;
  const style = document.createElement("style"); style.id = "hr-cloud-picker-styles";
  style.textContent = `.hr-cloud-picker[hidden]{display:none}.hr-cloud-picker{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:1rem;background:#030508c7}.hr-cloud-picker__panel{display:flex;flex-direction:column;width:min(720px,100%);max-height:90vh;overflow:hidden;color:#f5f7fa;background:#11161b;border:1px solid #48c8f2;border-radius:1rem;box-shadow:0 24px 80px #0008}.hr-cloud-picker__head,.hr-cloud-picker__foot{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:1rem;border-bottom:1px solid #fff2}.hr-cloud-picker__foot{justify-content:flex-end;border-top:1px solid #fff2;border-bottom:0}.hr-cloud-picker__body{display:flex;flex-direction:column;min-height:0;gap:.7rem;padding:.85rem 1rem}.hr-cloud-picker__crumbs{display:flex;flex-wrap:wrap;gap:.2rem;color:#aeb7c0;font-size:.85rem}.hr-cloud-picker__crumbs button{padding:.25rem;color:inherit;background:transparent;border:0;cursor:pointer}.hr-cloud-picker__list{min-height:150px;overflow:auto;display:grid;gap:.35rem}.hr-cloud-picker__row{display:grid;grid-template-columns:2rem minmax(0,1fr) auto;align-items:center;gap:.65rem;width:100%;padding:.7rem;color:inherit;text-align:left;background:#ffffff09;border:1px solid transparent;border-radius:.6rem;cursor:pointer}.hr-cloud-picker__row:hover,.hr-cloud-picker__row.is-selected{background:#48c8f21a;border-color:#48c8f2}.hr-cloud-picker__name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hr-cloud-picker__meta,.hr-cloud-picker__status,.hr-cloud-picker__selection{color:#aeb7c0;font-size:.8rem}.hr-cloud-picker__open{padding:.3rem .5rem;color:inherit;background:transparent;border:1px solid #fff3;border-radius:.4rem;cursor:pointer}.hr-cloud-picker__foot button{padding:.55rem .85rem;border:1px solid #fff3;border-radius:.5rem;cursor:pointer}.hr-cloud-picker__select{color:#061018;background:#48c8f2;border-color:#48c8f2!important;font-weight:700}`;
  document.head.append(style);
}

export function createCloudSourcePicker({ button, supabase, cloudOrigin = DEFAULT_CLOUD_ORIGIN, allowFolders = false, rootPath = "/", onSelect, onError, title = "Seleccionar desde Cloud" } = {}) {
  if (!button || !supabase || !cloudOrigin) return null;
  installStyles();
  const overlay = document.createElement("div"); overlay.className = "hr-cloud-picker"; overlay.hidden = true;
  overlay.innerHTML = `<section class="hr-cloud-picker__panel" role="dialog" aria-modal="true"><header class="hr-cloud-picker__head"><h2>${escapeHtml(title)}</h2><button type="button" data-cloud-picker-close aria-label="Cerrar">×</button></header><div class="hr-cloud-picker__body"><nav class="hr-cloud-picker__crumbs" aria-label="Ruta de Cloud"></nav><p class="hr-cloud-picker__status" role="status"></p><div class="hr-cloud-picker__list"></div><p class="hr-cloud-picker__selection">Nada seleccionado.</p></div><footer class="hr-cloud-picker__foot"><button type="button" data-cloud-picker-cancel>Cancelar</button><button type="button" class="hr-cloud-picker__select" data-cloud-picker-select disabled>Subir</button></footer></section>`;
  document.body.append(overlay);
  const crumbs = overlay.querySelector(".hr-cloud-picker__crumbs"); const status = overlay.querySelector(".hr-cloud-picker__status"); const list = overlay.querySelector(".hr-cloud-picker__list"); const selection = overlay.querySelector(".hr-cloud-picker__selection"); const selectButton = overlay.querySelector("[data-cloud-picker-select]"); const closeButtons = overlay.querySelectorAll("[data-cloud-picker-close], [data-cloud-picker-cancel]");
  const pickerRoot = normalizeCloudPath(rootPath); let currentPath = pickerRoot; let selected = null; let loading = false; let selectionInFlight = false;
  function setSelectionBusy(busy) {
    selectionInFlight = Boolean(busy);
    overlay.dataset.busy = selectionInFlight ? "true" : "false";
    selectButton.disabled = selectionInFlight || !selected;
    selectButton.setAttribute("aria-busy", selectionInFlight ? "true" : "false");
    selectButton.textContent = selectionInFlight ? "Procesando…" : "Subir";
    closeButtons.forEach((button) => { button.disabled = selectionInFlight; });
  }
  const close = ({ force = false } = {}) => { if (selectionInFlight && !force) return; overlay.hidden = true; selected = null; setSelectionBusy(false); };
  const setStatus = (message, error = false) => { status.textContent = message || ""; status.dataset.tone = error ? "error" : ""; };
  function renderCrumbs() { let path = "/"; const parts = currentPath === "/" ? [] : currentPath.slice(1).split("/"); crumbs.innerHTML = `<button type="button" data-cloud-path="/">Cloud</button>${parts.map((part) => { path = joinCloudPath(path, part); return `<span>/</span><button type="button" data-cloud-path="${escapeHtml(path)}">${escapeHtml(part)}</button>`; }).join("")}`; }
  function choose(item) { selected = item; selectButton.disabled = !item || (item.kind === "folder" && !allowFolders); selection.textContent = item ? `${item.kind === "folder" ? "Carpeta" : "Archivo"}: ${item.name}` : "Nada seleccionado."; list.querySelectorAll(".is-selected").forEach((row) => row.classList.remove("is-selected")); list.querySelector(`[data-kind="${item?.kind}"][data-name="${CSS.escape(item?.name || "")}"]`)?.classList.add("is-selected"); }
  function render(listing) { const folders = listing.folders.map((name) => `<button class="hr-cloud-picker__row" type="button" data-kind="folder" data-name="${escapeHtml(name)}"><span>📁</span><span><span class="hr-cloud-picker__name">${escapeHtml(name)}</span><span class="hr-cloud-picker__meta">Carpeta</span></span><span class="hr-cloud-picker__open" data-cloud-open-folder>Abrir</span></button>`).join(""); const files = listing.files.map((file) => `<button class="hr-cloud-picker__row" type="button" data-kind="file" data-name="${escapeHtml(file.name)}"><span>📄</span><span><span class="hr-cloud-picker__name">${escapeHtml(file.name)}</span><span class="hr-cloud-picker__meta">${escapeHtml(file.mimeType)} · ${escapeHtml(bytesLabel(file.size))}</span></span><span>›</span></button>`).join(""); list.innerHTML = folders + files || `<p class="hr-cloud-picker__status">Esta carpeta está vacía.</p>`; }
  async function load(path = currentPath) { if (loading) return; loading = true; currentPath = normalizeCloudPath(path); choose(null); renderCrumbs(); list.innerHTML = ""; setStatus("Cargando Cloud…"); try { render(await listPath({ supabase, cloudOrigin, path: currentPath })); setStatus(""); } catch (error) { list.innerHTML = ""; setStatus(error?.message || "No se pudo cargar Cloud.", true); onError?.(error); } finally { loading = false; } }
  const open = () => { overlay.hidden = false; load(pickerRoot); };
  button.addEventListener("click", open); overlay.querySelector("[data-cloud-picker-close]").addEventListener("click", close); overlay.querySelector("[data-cloud-picker-cancel]").addEventListener("click", close);
  overlay.addEventListener("click", (event) => { if (selectionInFlight) return; if (event.target === overlay) return close(); const crumb = event.target.closest("[data-cloud-path]"); if (crumb) return load(crumb.dataset.cloudPath); const row = event.target.closest(".hr-cloud-picker__row"); if (!row) return; const item = row.dataset.kind === "folder" ? folderSource(currentPath, row.dataset.name) : fileSource(currentPath, { name: row.dataset.name }); if (event.target.closest("[data-cloud-open-folder]") || (event.detail > 1 && item.kind === "folder")) return load(joinCloudPath(currentPath, item.name)); choose(item); });
  selectButton.addEventListener("click", async () => { if (!selected || loading || selectionInFlight) return; loading = true; setSelectionBusy(true); setStatus("Preparando selección…"); try { await onSelect?.({ ...selected, source: selected, sourceFile: selected.kind === "file" ? await cloudSourceToFile(selected, { supabase, cloudOrigin }) : null }); close({ force: true }); } catch (error) { setStatus(error?.message || "No se pudo usar la selección.", true); onError?.(error); setSelectionBusy(false); } finally { loading = false; } });
  return { open, close, destroy: () => { close(); overlay.remove(); } };
}
