const grid = document.getElementById("editorial-grid");
const status = document.getElementById("editorial-status");

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function articleCard(article) {
  const image = article.coverImage
    ? `<img src="${escapeHTML(article.coverImage)}" alt="" loading="lazy">`
    : `<div class="media-card__placeholder" aria-hidden="true">HR</div>`;
  return `<article class="media-card hr-media-card hr-hover-lift"><a class="media-card__image" href="${escapeHTML(article.url)}">${image}</a><div class="media-card__body hr-card-body hr-stack"><div class="media-card__meta hr-cluster"><span>${escapeHTML(article.category)}</span><time datetime="${escapeHTML(article.publishedAt)}">${escapeHTML(article.publishedAt)}</time></div><h3><a href="${escapeHTML(article.url)}">${escapeHTML(article.title)}</a></h3><p>${escapeHTML(article.excerpt)}</p><a class="media-card__read hr-btn hr-btn-ghost hr-btn-sm" href="${escapeHTML(article.url)}">Leer artículo →</a></div></article>`;
}

async function loadEditorialArticles() {
  if (!grid || !status) return;
  try {
    const response = await fetch("./articles/index.json", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.schemaVersion !== 1 || !Array.isArray(payload.articles) || !payload.articles.length) throw new Error("Contenido editorial inválido");
    grid.innerHTML = articleCard(payload.articles[0]);
    status.hidden = true;
  } catch (error) {
    console.error("[Media] contenido editorial:", error);
    status.textContent = "El contenido editorial no está disponible en este momento.";
  }
}

loadEditorialArticles();
