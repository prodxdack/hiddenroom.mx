import {
  MEDIA_CATEGORIES,
  escapeHTML,
  formatDate,
  postURL,
  revealMediaAdminLink,
  supabase,
} from "./config.js?v=20261015-view-as-readonly-v1";

const PAGE_SIZE = 9;
const state = { page: 0, loading: false, done: false };
const postsGrid = document.getElementById("posts-grid");
const featuredGrid = document.getElementById("featured-grid");
const featuredSection = document.getElementById("featured-section");
const status = document.getElementById("media-status");
const loadMore = document.getElementById("load-more");
const search = document.getElementById("media-search");
const category = document.getElementById("media-category");

MEDIA_CATEGORIES.forEach((name) => {
  const option = document.createElement("option");
  option.value = name;
  option.textContent = name;
  category.append(option);
});

const requestedCategory = new URLSearchParams(window.location.search).get("category");
if (MEDIA_CATEGORIES.includes(requestedCategory)) category.value = requestedCategory;

function card(post, featured = false) {
  const cover = post.cover_image
    ? `<img src="${escapeHTML(post.cover_image)}" alt="" loading="lazy">`
    : `<div class="media-card__placeholder" aria-hidden="true">HR</div>`;

  return `
    <article class="media-card hr-media-card hr-hover-lift ${featured ? "media-card--featured" : ""}">
      <a class="media-card__image" href="${postURL(post.slug)}">${cover}</a>
      <div class="media-card__body hr-card-body hr-stack">
        <div class="media-card__meta hr-cluster">
          <span>${escapeHTML(post.category)}</span>
          <time datetime="${escapeHTML(post.published_at || post.created_at)}">${formatDate(post.published_at || post.created_at)}</time>
        </div>
        <h3><a href="${postURL(post.slug)}">${escapeHTML(post.title)}</a></h3>
        <p>${escapeHTML(post.excerpt || "")}</p>
        <a class="media-card__read hr-btn hr-btn-ghost hr-btn-sm" href="${postURL(post.slug)}">Leer artículo →</a>
      </div>
    </article>
  `;
}

function filteredQuery() {
  let query = supabase
    .from("media_posts")
    .select("id,slug,title,excerpt,cover_image,category,tags,author_name,published_at,created_at,featured", { count: "exact" })
    .eq("status", "published")
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false });

  if (category.value) query = query.eq("category", category.value);
  const term = search.value.trim().replace(/[,%()]/g, " ");
  if (term) query = query.or(`title.ilike.%${term}%,excerpt.ilike.%${term}%`);
  return query;
}

async function loadFeatured() {
  const { data, error } = await supabase
    .from("media_posts")
    .select("slug,title,excerpt,cover_image,category,published_at,created_at")
    .eq("status", "published")
    .eq("featured", true)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(2);

  if (error || !data?.length) return;
  featuredGrid.innerHTML = data.map((post) => card(post, true)).join("");
  featuredSection.hidden = false;
}

async function loadPosts(reset = false) {
  if (state.loading) return;
  if (reset) {
    state.page = 0;
    state.done = false;
    status.hidden = false;
    postsGrid.innerHTML = '<div class="hr-skeleton-grid hr-skeleton-grid--media" aria-hidden="true">' + Array.from({ length: 3 }, () => '<article class="hr-skeleton-card"><div class="hr-skeleton-block hr-skeleton-block--media"></div><div class="hr-skeleton-line hr-skeleton-line--short"></div><div class="hr-skeleton-line"></div><div class="hr-skeleton-line hr-skeleton-line--medium"></div></article>').join("") + '</div>';
  }
  if (state.done) return;

  state.loading = true;
  postsGrid.classList.add("hr-filtering");
  status.textContent = "Cargando publicaciones…";
  loadMore.hidden = true;

  const from = state.page * PAGE_SIZE;
  const { data, error, count } = await filteredQuery().range(from, from + PAGE_SIZE - 1);
  state.loading = false;
  postsGrid.classList.remove("hr-filtering");

  if (error) {
    console.error("[Media] feed:", error);
    status.textContent = "El archivo Media estará disponible al aplicar la migración de Supabase.";
    return;
  }

  postsGrid.querySelector(".hr-skeleton-grid")?.remove();
  postsGrid.insertAdjacentHTML("beforeend", (data || []).map((post) => card(post)).join(""));
  state.page += 1;
  state.done = from + (data?.length || 0) >= (count || 0) || (data?.length || 0) < PAGE_SIZE;

  if (!postsGrid.children.length) {
    status.hidden = true;
    postsGrid.innerHTML = '<div class="hr-empty-state"><p>No encontramos publicaciones con esos filtros.</p></div>';
  } else {
    status.hidden = false;
    status.textContent = `${count || postsGrid.children.length} publicaciones en el archivo.`;
  }
  loadMore.hidden = state.done;
}

let searchTimer;
const hrMediaLifecycle = () => window.clearTimeout(searchTimer);
window.HiddenRoomApp?.register(hrMediaLifecycle);
search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadPosts(true), 280);
});
category.addEventListener("change", () => loadPosts(true));
loadMore.addEventListener("click", () => loadPosts());

loadFeatured();
loadPosts(true);
revealMediaAdminLink();
