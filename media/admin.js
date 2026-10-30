import {
  MEDIA_CATEGORIES,
  escapeHTML,
  formatDate,
  sanitizeContent,
  slugify,
  supabase,
} from "./config.js?v=20261015-view-as-readonly-v1";

const state = {
  user: null,
  profile: null,
  posts: [],
  slugTouched: false,
  currentPost: null,
};

const statusBox = document.getElementById("admin-status");
const listView = document.getElementById("list-view");
const editorView = document.getElementById("editor-view");
const tableBody = document.getElementById("posts-table-body");
const form = document.getElementById("post-form");
const titleInput = document.getElementById("post-title-input");
const slugInput = document.getElementById("post-slug");
const excerptInput = document.getElementById("post-excerpt-input");
const contentEditor = document.getElementById("post-content-editor");
const categoryInput = document.getElementById("post-category-input");
const coverURLInput = document.getElementById("post-cover-url");
const coverFileInput = document.getElementById("post-cover-file");
const toast = document.getElementById("admin-toast");

MEDIA_CATEGORIES.forEach((category) => {
  const option = document.createElement("option");
  option.value = category;
  option.textContent = category;
  categoryInput.append(option);
});

function showToast(message, type = "success") {
  toast.className = `admin-toast hr-toast hr-toast--${type} hr-toast--visible`;
  toast.innerHTML = '<span class="hr-toast__dot" aria-hidden="true"></span><span class="hr-toast__message"></span>';
  toast.querySelector(".hr-toast__message").textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("hr-toast--visible");
    toast.hidden = true;
  }, 4200);
}

function currentView() {
  const value = new URLSearchParams(window.location.search).get("view");
  return ["posts", "editor", "drafts"].includes(value) ? value : "posts";
}

function isAdmin(roles) {
  return String(roles || "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .includes("admin");
}

async function authorize() {
  const viewAs = await Promise.resolve(window.HiddenRoomViewAs?.ready?.());
  if (viewAs?.active) {
    statusBox.textContent = "El CMS esta bloqueado durante Ver como. Vuelve a tu vista para administrarlo.";
    return false;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    sessionStorage.setItem("hr_return_after_login", "../media/admin.html");
    window.location.href = "/portal/";
    return false;
  }

  const [{ data: profile, error: profileError }, { data: permissions, error: permissionsError }] = await Promise.all([
    supabase.from("users").select("id,display_name,email,roles").eq("id", user.id).maybeSingle(),
    supabase.from("user_permissions").select("permission_key").eq("user_id", user.id),
  ]);

  if (profileError || permissionsError) {
    console.error("[Media Admin] auth:", profileError || permissionsError);
  }

  const canEdit = isAdmin(profile?.roles)
    || (permissions || []).some((row) => row.permission_key === "media.posts");

  if (!canEdit) {
    statusBox.textContent = "No tienes permiso para administrar MEDIA.";
    return false;
  }

  state.user = user;
  state.profile = profile;
  statusBox.hidden = true;
  return true;
}

function setActiveNavigation(view) {
  document.querySelectorAll("[data-admin-view]").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.adminView === view);
  });
}

function statusLabel(value) {
  return { published: "Publicado", draft: "Borrador", archived: "Archivado" }[value] || value;
}

function renderPosts() {
  const term = document.getElementById("admin-search").value.trim().toLowerCase();
  const selectedStatus = document.getElementById("admin-status-filter").value;
  const rows = state.posts.filter((post) => {
    const matchesText = !term || [
      post.title, post.author_name, post.category, post.slug,
    ].some((value) => String(value || "").toLowerCase().includes(term));
    return matchesText && (!selectedStatus || post.status === selectedStatus);
  });

  tableBody.innerHTML = rows.length ? rows.map((post) => `
    <tr>
      <td data-label="Publicación">
        <div class="admin-post-cell">
          ${post.cover_image
            ? `<img src="${escapeHTML(post.cover_image)}" alt="">`
            : `<span class="admin-post-thumb"></span>`}
          <div>
            <strong>${escapeHTML(post.title)}</strong>
            <small>${escapeHTML(post.category)} · /${escapeHTML(post.slug)}</small>
          </div>
        </div>
      </td>
      <td data-label="Estado"><span class="status-pill status-pill--${escapeHTML(post.status)} hr-badge ${post.status === "published" ? "hr-badge-success" : post.status === "draft" ? "hr-badge-info" : "hr-badge-muted"}">${statusLabel(post.status)}</span>${post.featured ? '<br><small class="admin-featured hr-badge hr-badge-info">Destacado</small>' : ""}</td>
      <td data-label="Fecha">${formatDate(post.published_at || post.updated_at)}</td>
      <td data-label="Vistas">${Number(post.views || 0).toLocaleString("es-MX")}</td>
      <td data-label="Acciones">
        <div class="admin-row-actions">
          <a class="hr-btn hr-btn-ghost hr-btn-sm" href="?view=editor&id=${encodeURIComponent(post.id)}">Editar</a>
          ${post.status === "published" ? `<a class="hr-btn hr-btn-ghost hr-btn-sm" href="/media/post.html?slug=${encodeURIComponent(post.slug)}" target="_blank" rel="noopener">Ver</a>` : ""}
          <button class="hr-btn hr-btn-ghost hr-btn-sm" type="button" data-action="delete" data-id="${escapeHTML(post.id)}">Eliminar</button>
        </div>
      </td>
    </tr>
  `).join("") : '<tr><td class="hr-table-empty" colspan="5">No hay publicaciones con estos filtros.</td></tr>';
}

async function loadPosts(draftsOnly = false) {
  const { data, error } = await supabase
    .from("media_posts")
    .select("id,slug,title,category,author_name,status,featured,views,cover_image,published_at,updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[Media Admin] list:", error);
    statusBox.hidden = false;
    statusBox.textContent = "No se pudo cargar MEDIA. Aplica la migración de Supabase y vuelve a intentar.";
    return;
  }

  state.posts = draftsOnly ? (data || []).filter((post) => post.status === "draft") : (data || []);
  document.getElementById("list-title").textContent = draftsOnly ? "Borradores" : "Publicaciones";
  if (draftsOnly) document.getElementById("admin-status-filter").value = "draft";
  renderPosts();
}

function updateCoverPreview(url = coverURLInput.value.trim()) {
  const holder = document.getElementById("cover-preview");
  holder.innerHTML = url
    ? `<img src="${escapeHTML(url)}" alt="Vista previa de portada">`
    : "Sin portada";
}

function resetEditor() {
  form.reset();
  state.currentPost = null;
  state.slugTouched = false;
  document.getElementById("post-id").value = "";
  document.getElementById("editor-title").textContent = "Crear publicación";
  document.getElementById("post-author-name").value = state.profile?.display_name || state.profile?.email || "";
  contentEditor.innerHTML = "";
  document.getElementById("excerpt-count").textContent = "0";
  updateCoverPreview("");
}

async function loadEditor() {
  resetEditor();
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) return;

  const { data: post, error } = await supabase
    .from("media_posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !post) {
    showToast("No se pudo cargar la publicación.", "error");
    return;
  }

  state.currentPost = post;
  state.slugTouched = true;
  document.getElementById("editor-title").textContent = "Editar publicación";
  document.getElementById("post-id").value = post.id;
  titleInput.value = post.title || "";
  slugInput.value = post.slug || "";
  excerptInput.value = post.excerpt || "";
  categoryInput.value = post.category || MEDIA_CATEGORIES[0];
  document.getElementById("post-tags").value = (post.tags || []).join(", ");
  document.getElementById("post-author-name").value = post.author_name || "";
  coverURLInput.value = post.cover_image || "";
  document.getElementById("post-featured").checked = Boolean(post.featured);
  contentEditor.innerHTML = sanitizeContent(post.content || "");
  document.getElementById("excerpt-count").textContent = String(excerptInput.value.length);
  updateCoverPreview();
}

async function uploadCover() {
  const file = coverFileInput.files?.[0];
  if (!file) return coverURLInput.value.trim() || null;
  if (file.size > 10 * 1024 * 1024) throw new Error("La portada supera el límite de 10 MB.");

  const extension = file.name.split(".").pop()?.toLowerCase() || "webp";
  const path = `${state.user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage
    .from("media-covers")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from("media-covers").getPublicUrl(path);
  return data.publicUrl;
}

async function savePost(saveStatus, submitButton) {
  const cleanContent = sanitizeContent(contentEditor.innerHTML);
  const title = titleInput.value.trim();
  const slug = slugify(slugInput.value || title);
  if (!title || !slug || !categoryInput.value) {
    showToast("Completa título, slug y categoría.", "error");
    return;
  }
  if (!cleanContent && saveStatus === "published") {
    showToast("Agrega contenido antes de publicar.", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Guardando…";

  try {
    const coverImage = await uploadCover();
    const publishedAt = saveStatus === "published"
      ? (state.currentPost?.published_at || new Date().toISOString())
      : null;
    const payload = {
      slug,
      title,
      excerpt: excerptInput.value.trim() || null,
      content: cleanContent,
      cover_image: coverImage,
      category: categoryInput.value,
      tags: document.getElementById("post-tags").value
        .split(",")
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean)
        .slice(0, 20),
      author_name: document.getElementById("post-author-name").value.trim() || "Hidden Room Media",
      status: saveStatus,
      featured: document.getElementById("post-featured").checked,
      published_at: publishedAt,
    };

    let result;
    if (state.currentPost?.id) {
      result = await supabase.from("media_posts").update(payload).eq("id", state.currentPost.id).select("id").single();
    } else {
      result = await supabase.from("media_posts").insert({
        ...payload,
        author_id: state.user.id,
      }).select("id").single();
    }
    if (result.error) throw result.error;

    showToast(saveStatus === "published" ? "Publicación publicada." : "Borrador guardado.");
    setTimeout(() => { window.location.href = "?view=posts"; }, 650);
  } catch (error) {
    console.error("[Media Admin] save:", error);
    const message = String(error.message || "").includes("duplicate")
      ? "Ese slug ya está en uso."
      : (error.message || "No se pudo guardar la publicación.");
    showToast(message, "error");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = saveStatus === "published" ? "Publicar" : "Guardar borrador";
  }
}

function openPreview() {
  document.getElementById("preview-category").textContent = categoryInput.value;
  document.getElementById("preview-title").textContent = titleInput.value || "Título de la publicación";
  document.getElementById("preview-excerpt").textContent = excerptInput.value;
  document.getElementById("preview-content").innerHTML = sanitizeContent(contentEditor.innerHTML);
  const image = document.getElementById("preview-cover");
  const url = coverURLInput.value.trim();
  image.hidden = !url;
  if (url) image.src = url;
  document.getElementById("preview-dialog").showModal();
}

async function deletePost(id) {
  const post = state.posts.find((item) => item.id === id);
  if (!post || !window.confirm(`¿Eliminar permanentemente "${post.title}"?`)) return;
  const { error } = await supabase.from("media_posts").delete().eq("id", id);
  if (error) {
    showToast(error.message || "No se pudo eliminar.", "error");
    return;
  }
  state.posts = state.posts.filter((item) => item.id !== id);
  renderPosts();
  showToast("Publicación eliminada.");
}

function attachEvents() {
  document.getElementById("admin-search").addEventListener("input", renderPosts);
  document.getElementById("admin-status-filter").addEventListener("change", renderPosts);
  tableBody.addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="delete"]');
    if (button) deletePost(button.dataset.id);
  });

  titleInput.addEventListener("input", () => {
    if (!state.slugTouched) slugInput.value = slugify(titleInput.value);
  });
  slugInput.addEventListener("input", () => {
    state.slugTouched = true;
    slugInput.value = slugify(slugInput.value);
  });
  excerptInput.addEventListener("input", () => {
    document.getElementById("excerpt-count").textContent = String(excerptInput.value.length);
  });
  coverURLInput.addEventListener("input", () => updateCoverPreview());
  coverFileInput.addEventListener("change", () => {
    const file = coverFileInput.files?.[0];
    if (!file) return updateCoverPreview();
    const reader = new FileReader();
    reader.addEventListener("load", () => updateCoverPreview(String(reader.result)));
    reader.readAsDataURL(file);
  });

  document.querySelector(".editor-toolbar").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    contentEditor.focus();
    if (button.dataset.editorAction === "link") {
      const url = window.prompt("URL del enlace:");
      if (url && /^https?:\/\//i.test(url)) document.execCommand("createLink", false, url);
      return;
    }
    document.execCommand(button.dataset.command, false, button.dataset.value || null);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const submitButton = event.submitter;
    savePost(submitButton?.dataset.saveStatus || "draft", submitButton);
  });
  document.getElementById("preview-button").addEventListener("click", openPreview);
  document.getElementById("preview-close").addEventListener("click", () => {
    document.getElementById("preview-dialog").close();
  });
  document.getElementById("logout-button")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    window.location.href = "/portal/";
  });
}

async function init() {
  attachEvents();
  if (!await authorize()) return;

  const view = currentView();
  setActiveNavigation(view);
  if (view === "editor") {
    editorView.hidden = false;
    await loadEditor();
  } else {
    listView.hidden = false;
    await loadPosts(view === "drafts");
  }
}

init();
