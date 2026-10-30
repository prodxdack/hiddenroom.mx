import {
  MEDIA_CATEGORIES,
  escapeHTML,
  formatDate,
  postURL,
  revealMediaAdminLink,
  supabase,
} from "./config.js?v=20261015-view-as-readonly-v1";

const PAGE_SIZE = 9;
const STATIC_ARTICLES_URL = "./articles/index.json";
const state = { page: 0, loading: false, done: false };
const postsGrid = document.getElementById("posts-grid");
const status = document.getElementById("media-status");
const loadMore = document.getElementById("load-more");
const search = document.getElementById("media-search");
const categoryNav = document.getElementById("media-category-nav");
let currentCategory = new URLSearchParams(window.location.search).get("category") || "";
let staticPostsPromise;

const categoryNames = [...new Set([
  "",
  "Studio",
  "Escena",
  ...MEDIA_CATEGORIES,
])];

function renderCategoryNav() {
  categoryNav.innerHTML = categoryNames.map((name) => `
    <button type="button" class="${name === currentCategory ? "is-active" : ""}" data-category="${escapeHTML(name)}" aria-pressed="${name === currentCategory}">
      ${escapeHTML(name || "Todo")}
    </button>
  `).join("");
}

function card(post, featured = false) {
  const date = post.published_at || post.created_at;
  const href = escapeHTML(post.url || postURL(post.slug));
  const cover = post.cover_image
    ? `<img src="${escapeHTML(post.cover_image)}" alt="" loading="lazy">`
    : `<div class="media-card__placeholder" aria-hidden="true">HR</div>`;

  return `
    <article class="media-card hr-media-card hr-hover-lift ${featured ? "media-card--featured" : ""}">
      <a class="media-card__image" href="${href}">${cover}</a>
      <div class="media-card__body hr-card-body hr-stack">
        <div class="media-card__meta hr-cluster">
          <span>${escapeHTML(post.category || "Media")}</span>
          <time datetime="${escapeHTML(date || "")}">${formatDate(date)}</time>
        </div>
        <h3><a href="${href}">${escapeHTML(post.title)}</a></h3>
        <p>${escapeHTML(post.excerpt || "")}</p>
        <a class="media-card__read hr-btn hr-btn-ghost hr-btn-sm" href="${href}">Leer artículo →</a>
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

  if (currentCategory) query = query.eq("category", currentCategory);
  const term = search.value.trim().replace(/[,%()]/g, " ");
  if (term) query = query.or(`title.ilike.%${term}%,excerpt.ilike.%${term}%`);
  return query;
}

async function getStaticPosts() {
  staticPostsPromise ||= fetch(STATIC_ARTICLES_URL, { headers: { Accept: "application/json" } })
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.schemaVersion !== 1 || !Array.isArray(payload.articles)) throw new Error("Contenido editorial inválido");
      return payload.articles.map((article) => ({
        id: `static-${article.slug}`,
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        cover_image: article.coverImage,
        category: article.category,
        author_name: article.author,
        published_at: article.publishedAt,
        created_at: article.publishedAt,
        url: article.url,
      }));
    });
  return staticPostsPromise;
}

function filterStaticPosts(posts) {
  const term = search.value.trim().toLowerCase();
  return posts.filter((post) => {
    const matchesCategory = !currentCategory || post.category === currentCategory;
    const matchesTerm = !term || [post.title, post.excerpt, post.category]
      .some((value) => String(value || "").toLowerCase().includes(term));
    return matchesCategory && matchesTerm;
  });
}

async function loadPosts(reset = false) {
  if (state.loading) return;
  if (reset) {
    state.page = 0;
    state.done = false;
    status.hidden = false;
    postsGrid.innerHTML = '<div class="hr-skeleton-grid hr-skeleton-grid--media" aria-hidden="true">' + Array.from({ length: 3 }, () => '<article class="hr-skeleton-card"><div class="hr-skeleton-block hr-skeleton-block--media"></div><div class="hr-skeleton-line hr-skeleton-line--short"></div><div class="hr-skeleton-line"></div><div class="hr-skeleton-line hr-skeleton-line--medium"></div></article>').join("") + "</div>";
  }
  if (state.done) return;

  state.loading = true;
  postsGrid.classList.add("hr-filtering");
  status.textContent = "Cargando publicaciones…";
  loadMore.hidden = true;

  const from = state.page * PAGE_SIZE;
  let { data, error, count } = await filteredQuery().range(from, from + PAGE_SIZE - 1);
  let source = "database";

  if (error || (!data?.length && from === 0)) {
    try {
      const fallback = filterStaticPosts(await getStaticPosts());
      data = fallback.slice(from, from + PAGE_SIZE);
      count = fallback.length;
      error = null;
      source = "static";
    } catch (fallbackError) {
      console.error("[Media] archivo estático:", fallbackError);
    }
  }

  state.loading = false;
  postsGrid.classList.remove("hr-filtering");
  postsGrid.querySelector(".hr-skeleton-grid")?.remove();

  if (error) {
    console.error("[Media] feed:", error);
    status.textContent = "No se pudo cargar el archivo Media.";
    return;
  }

  const rendered = data || [];
  postsGrid.insertAdjacentHTML("beforeend", rendered.map((post) => card(post)).join(""));
  state.page += 1;
  state.done = from + rendered.length >= (count || 0) || rendered.length < PAGE_SIZE;

  if (!postsGrid.querySelector(".media-card")) {
    status.hidden = true;
    postsGrid.innerHTML = '<div class="hr-empty-state"><p>No encontramos publicaciones con esos filtros.</p></div>';
  } else {
    status.hidden = false;
    status.textContent = source === "static"
      ? `${count || 0} publicaciones en el archivo.`
      : `${count || postsGrid.querySelectorAll(".media-card").length} publicaciones en el archivo.`;
  }
  loadMore.hidden = state.done;
}

let searchTimer;
const hrMediaLifecycle = () => window.clearTimeout(searchTimer);
window.HiddenRoomApp?.register(hrMediaLifecycle);

renderCategoryNav();
categoryNav.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  currentCategory = button.dataset.category || "";
  renderCategoryNav();
  loadPosts(true);
});

search.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadPosts(true), 280);
});
loadMore.addEventListener("click", () => loadPosts());

loadPosts(true);
revealMediaAdminLink();
