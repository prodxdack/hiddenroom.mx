
import { beatCardMarkup as sharedBeatCardMarkup } from "./beat-card.js?v=20261019-beat-card-component-v2";
import { beatLicenseAssignmentIsSelectable, beatLicenseModalMarkup } from "./license-modal.js?v=20261018-license-request-v10";

const SUPABASE_URL = "https://rpcunbkstadgngqrjafp.supabase.co";
const BEAT_STORE_INVITE_NOTIFICATION_TYPE = "beat-store-invite";
import { createCloudSourcePicker } from '../../assets/js/cloud-source-picker.js';

const SUPABASE_ANON_KEY = "sb_publishable_7v_FIgTjWjJgtT1YHIAYSw_bRBmQjZO";
const CART_STORAGE_KEY = "hidden_room_store_cart";
const CLOUD_ORIGIN = "https://cloud.hiddenroom.mx";
const BEAT_STORE_ENDPOINT = `${CLOUD_ORIGIN}/api/beat-store`;
const ANALYZE_BEAT_AUDIO_ENDPOINT = `${SUPABASE_URL}/functions/v1/analyze-beat-audio`;
const BEAT_STORE_CLOUD_PATH = "/beats_store";
const CLOUD_FUNCTION_BASE = `${SUPABASE_URL}/functions/v1`;
const supabase = await window.HiddenRoomSupabase.getClient();
const hrBeatStoreLifecycle = new AbortController();
window.HiddenRoomApp?.register(() => hrBeatStoreLifecycle.abort());
const state = { products: [], adminProducts: [], beats: [], items: [], searchIndex: new Map(), genreIndex: new Map(), renderVersion: 0, renderedKey: "", licenses: [], assignments: [], producerProfiles: [], beatUploadUsers: [], beatUploadPermissions: [], beatUploadPermissionsError: null, mercadoPagoConfig: null, mercadoPagoConfigError: null, globalPlayerBeatId: "", globalPlayerSettingError: null, durationDetections: new Set(), isAdmin: false, canEditOwnBeats: false, currentUserId: null, currentUsername: "", hasBeatMetadata: true, hasBeatLicenses: true, hasBeatPreviews: true, hasBeatDeliveryPaths: true, hasBeatAutodetectFlags: true };

const grid = document.getElementById("beat-grid");
const searchInput = document.getElementById("beat-search");
const sortSelect = document.getElementById("beat-sort");
const genreSelect = document.getElementById("beat-genre");
const beatAdvancedToggle = document.querySelector("[data-beat-advanced-toggle]");
const beatFilterPanel = document.getElementById("beat-filter-panel");
const beatAdvancedClearButton = document.querySelector("[data-beat-advanced-clear]");
const producerSelect = document.getElementById("beat-producer-filter");
const advancedProducerSelect = document.getElementById("beat-producer-filter-advanced");
const priceMinInput = document.getElementById("beat-price-min");
const priceMaxInput = document.getElementById("beat-price-max");
const bpmMinInput = document.getElementById("beat-bpm-min");
const bpmMaxInput = document.getElementById("beat-bpm-max");
const clearFiltersButton = document.getElementById("beat-clear-filters");
const beatFilterCount = document.getElementById("beat-filter-count");
const activeProducerSelect = () => producerSelect || advancedProducerSelect;
const SELECT_PLACEHOLDER = "__placeholder__";
const MERGED_GENRE_KEY = "perreo-reggaeton";
const adminPanel = document.getElementById("beat-admin-panel");
const adminForm = document.getElementById("beat-admin-form");
const adminFormSlot = document.getElementById("beat-admin-upload-form-slot");
const adminList = document.getElementById("beat-admin-products");
const adminTabButtons = [...document.querySelectorAll("[data-admin-tab]")];
const adminTabPanels = [...document.querySelectorAll("[data-admin-panel]")];
const adminStatus = document.getElementById("beat-admin-status");
const globalPlayerSelect = document.getElementById("beat-global-player-select");
const globalPlayerSaveButton = document.getElementById("beat-global-player-save");
const globalPlayerStatus = document.getElementById("beat-global-player-status");
const adminError = document.getElementById("beat-admin-error");
const cancelEditButton = document.getElementById("beat-cancel-edit");
const beatUploadInput = document.getElementById("beat-upload-file");
const beatCoverInput = document.getElementById("beat-cover-file");
const beatUploadStatus = document.getElementById("beat-upload-status");
const beatSubmitButton = document.getElementById("beat-submit-button");
const beatProducerProfileButton = document.querySelector("[data-producer-profile-current]");
const beatProducerUsernameButton = document.querySelector("[data-use-current-username]");
const beatCoverEditor = document.getElementById("beat-cover-editor");
const beatCoverPreview = document.getElementById("beat-cover-preview");
const beatCoverStage = document.querySelector(".beat-cover-editor__stage");
const beatLicenseAssignmentList = document.getElementById("beat-license-assignment-list");
const beatLicenseForm = document.getElementById("beat-license-form");
const beatLicenseList = document.getElementById("beat-license-list");
const beatLicenseStatus = document.getElementById("beat-license-status");
const beatLicenseError = document.getElementById("beat-license-error");
const beatLicenseWarning = document.getElementById("beat-license-warning");
const beatLicenseCancel = document.getElementById("beat-license-cancel");
const beatUploadPermissionsList = document.getElementById("beat-upload-permissions-list");
const beatUploadPermissionsStatus = document.getElementById("beat-upload-permissions-status");
const beatUploadPermissionsSearch = document.getElementById("beat-upload-permissions-search");
const beatMercadoPagoForm = document.getElementById("beat-mercadopago-form");
const beatMercadoPagoStatus = document.getElementById("beat-mercadopago-status");
const beatMercadoPagoError = document.getElementById("beat-mercadopago-error");
const beatLicenseModal = document.getElementById("beat-license-modal");


const beatLicenseModalContent = document.getElementById("beat-license-modal-content");
let beatSearchTimer = 0;
let beatFilterUrlTimer = 0;
let beatLastUrlState = "";
let beatFilterPanelLastFocus = null;
let beatFilterPanelScrollY = 0;
let beatLicenseLastTrigger = null;
let beatCoverObjectUrl = "";
let beatUploadPermissionsSearchTimer = 0;
const beatCoverCropState = { x: 0.5, y: 0.5, zoom: 1 };
const beatCoverPointers = new Map();
let beatCoverDragStart = null;
let beatCoverPinchStart = null;

initBeatStore().catch((error) => {
  grid.innerHTML = errorState(error.message || "No se pudo cargar Beat Store.");
});

async function initBeatStore() {
  updateCartCount();
  if (beatFilterPanel && beatFilterPanel.parentElement !== document.body) document.body.appendChild(beatFilterPanel);
  state.isAdmin = await currentUserIsAdmin();
  const [products, beats, licenses, producerProfiles, beatUploadAccess, mercadoPagoConfig, globalPlayerSetting] = await Promise.all([fetchBeatProducts(state.isAdmin), fetchCloudBeats(), fetchBeatLicenses(state.isAdmin), fetchProducerProfiles(state.isAdmin), fetchBeatUploadAccess(state.isAdmin), fetchMercadoPagoConfig(state.isAdmin), fetchGlobalBeatPlayerSetting()]);
  state.products = products;
  state.adminProducts = state.isAdmin ? products : [];
  state.globalPlayerBeatId = globalPlayerSetting.id;
  state.globalPlayerSettingError = globalPlayerSetting.error;
  state.beats = beats;
  state.licenses = licenses;
  state.producerProfiles = producerProfiles;
  state.beatUploadUsers = beatUploadAccess.users;
  state.beatUploadPermissions = beatUploadAccess.permissions;
  state.beatUploadPermissionsError = beatUploadAccess.error;
  state.mercadoPagoConfig = mercadoPagoConfig.data;
  state.mercadoPagoConfigError = mercadoPagoConfig.error;
  state.assignments = await fetchBeatLicenseAssignments(products.map((product) => product.id), true);
  state.items = mergeProductsAndBeats(products, beats);
  buildBeatSearchIndex();
  renderGenreOptions();
  renderProducerOptions();
  applyBeatUrlState();
  renderBeats();
  initializeAdminPanel();
  if (state.isAdmin) openRequestedAdminEdit();

  window.addEventListener("popstate", () => {
    applyBeatUrlState();
    renderBeats();
    if (state.isAdmin) {
      setAdminMode(wantsAdminMode());
      setAdminTab(requestedAdminTab());
      if (wantsAdminMode()) openRequestedAdminEdit();
    }
  }, { signal: hrBeatStoreLifecycle.signal });

  searchInput?.addEventListener("input", () => {
    window.clearTimeout(beatSearchTimer);
    beatSearchTimer = window.setTimeout(() => {
      renderBeats();
      syncBeatUrlState(true);
    }, 90);
  }, { signal: hrBeatStoreLifecycle.signal });
  beatAdvancedToggle?.addEventListener("click", () => {
    setBeatAdvancedPanelOpen(true);
  }, { signal: hrBeatStoreLifecycle.signal });
  document.querySelectorAll("[data-beat-filter-close]").forEach((control) => control.addEventListener("click", () => {
    setBeatAdvancedPanelOpen(false);
  }, { signal: hrBeatStoreLifecycle.signal }));
  document.addEventListener("keydown", handleBeatFilterPanelKeydown, { signal: hrBeatStoreLifecycle.signal });
  [sortSelect, genreSelect, advancedProducerSelect].forEach((control) => control?.addEventListener("change", () => {
    if (control === producerSelect && advancedProducerSelect) advancedProducerSelect.value = producerSelect.value;
    renderBeats();
    syncBeatUrlState(true);
  }, { signal: hrBeatStoreLifecycle.signal }));
  [priceMinInput, priceMaxInput, bpmMinInput, bpmMaxInput].forEach((control) => control?.addEventListener("input", () => {
    window.clearTimeout(beatFilterUrlTimer);
    beatFilterUrlTimer = window.setTimeout(() => { renderBeats(); syncBeatUrlState(true); }, 120);
  }, { signal: hrBeatStoreLifecycle.signal }));
  clearFiltersButton?.addEventListener("click", () => {
    clearBeatFilters();
    renderBeats();
    syncBeatUrlState(true);
  }, { signal: hrBeatStoreLifecycle.signal });
  beatAdvancedClearButton?.addEventListener("click", () => {
    clearBeatAdvancedFilters();
    renderBeats();
    syncBeatUrlState(true);
  }, { signal: hrBeatStoreLifecycle.signal });
  grid?.addEventListener("click", handleGridClick);
  grid?.addEventListener("keydown", handleGridKeydown);
  window.addEventListener("hr:beat-player-state", syncBeatCardPlayState, { signal: hrBeatStoreLifecycle.signal });
  syncBeatCardPlayState({ detail: window.HiddenRoomBeatPlayer || {} });
  window.addEventListener("hr:beat-player-next", (event) => {
    if (event.defaultPrevented) return;
    const activeId = String(event.detail?.beatId || "");
    const activeSrc = String(event.detail?.src || "");
    const requestedShuffle = Boolean(event.detail?.shuffle);
    const visibleIds = [...document.querySelectorAll("[data-play-beat]")]
      .map((cover) => cover.dataset.playBeat)
      .filter(Boolean)
      .filter((id, index, ids) => ids.indexOf(id) === index);
    const visibleItems = visibleIds
      .map((id) => state.items.find((item) => item.id === id))
      .filter((item) => item && previewUrlForItem(item));
    const sequence = visibleItems.length
      ? visibleItems
      : state.items.filter((item) => previewUrlForItem(item));
    if (!sequence.length) return;
    const currentIndex = sequence.findIndex((item) => item.id === activeId || previewUrlForItem(item) === activeSrc);
    let nextItem;
    if (requestedShuffle && sequence.length > 1) {
      const choices = sequence.filter((item) => item.id !== activeId && previewUrlForItem(item) !== activeSrc);
      nextItem = choices[Math.floor(Math.random() * choices.length)];
    } else {
      nextItem = sequence[(currentIndex + 1 + sequence.length) % sequence.length];
    }
    if (nextItem) playBeat(nextItem.id);
  }, { signal: hrBeatStoreLifecycle.signal });
  window.addEventListener("hr:beat-player-state", (event) => {
    const activeId = String(event.detail?.beatId || "");
    const item = state.items.find((candidate) => candidate.id === activeId || candidate.product?.id === activeId);
    const edit = document.querySelector("[data-beat-player-edit]");
    if (!edit) return;
    const canEdit = canEditBeatItem(item) && Boolean(item?.product?.id);
    edit.hidden = !canEdit;
    if (canEdit) edit.href = state.isAdmin
      ? `?view=admin&tab=beats&edit=${encodeURIComponent(item.product.id)}`
      : `new-beat.html?id=${encodeURIComponent(item.product.id)}`;
  }, { signal: hrBeatStoreLifecycle.signal });
  window.dispatchEvent(new CustomEvent("hr:beat-player-state", { detail: window.HiddenRoomBeatPlayer || {} }));
  window.addEventListener("hr:beat-player-buy", (event) => {
    const itemId = String(event.detail?.beatId || "");
    if (!itemId) return;
    event.preventDefault();
    openBeatLicensesModal(itemId, event.detail?.trigger || null);
  }, { signal: hrBeatStoreLifecycle.signal });
  adminForm?.addEventListener("submit", handleAdminSubmit);
  adminTabButtons.forEach((button) => button.addEventListener("click", () => setAdminTab(button.dataset.adminTab, true), { signal: hrBeatStoreLifecycle.signal }));
  adminForm?.addEventListener("change", handleBeatLicenseAssignmentChange);
  adminList?.addEventListener("click", handleAdminListClick);
  globalPlayerSaveButton?.addEventListener("click", handleGlobalBeatPlayerSave, { signal: hrBeatStoreLifecycle.signal });
  beatUploadPermissionsList?.addEventListener("click", handleBeatUploadPermissionClick);
  beatUploadPermissionsSearch?.addEventListener("input", handleBeatUploadPermissionsSearch);
  beatMercadoPagoForm?.addEventListener("submit", handleMercadoPagoConfigSubmit);
  beatLicenseForm?.addEventListener("submit", handleBeatLicenseSubmit);
  beatLicenseList?.addEventListener("click", handleBeatLicenseListClick);
  beatLicenseCancel?.addEventListener("click", resetBeatLicenseForm);
  beatLicenseForm?.addEventListener("input", updateBeatLicenseRangeWarning);
  document.getElementById("beat-license-unlimited")?.addEventListener("change", syncBeatLicenseStreamLimitState);
  cancelEditButton?.addEventListener("click", () => {
    resetAdminForm();
    setAdminTab("beats", true);
  });
  beatCoverInput?.addEventListener("change", handleBeatCoverSelection);
  beatUploadInput?.addEventListener("change", handleBeatAudioSelection);
  document.getElementById("beat-bpm")?.addEventListener("input", handleManualBeatMetadataInput);
  document.getElementById("beat-key")?.addEventListener("input", handleManualBeatMetadataInput);
  adminForm?.addEventListener("click", handleBeatAutodetectClick);
  beatProducerProfileButton?.addEventListener("click", createOrOpenCurrentProducerProfile);
  beatProducerUsernameButton?.addEventListener("click", useCurrentUsernameAsProducer);
  beatCoverStage?.addEventListener("pointerdown", handleBeatCoverPointerDown);
  beatCoverStage?.addEventListener("pointermove", handleBeatCoverPointerMove);
  beatCoverStage?.addEventListener("pointerup", handleBeatCoverPointerEnd);
  beatCoverStage?.addEventListener("pointercancel", handleBeatCoverPointerEnd);
  beatCoverStage?.addEventListener("lostpointercapture", handleBeatCoverPointerEnd);
  beatCoverStage?.addEventListener("wheel", handleBeatCoverWheel, { passive: false });
  beatCoverStage?.addEventListener("dblclick", resetBeatCoverCrop);
  document.addEventListener("click", handleAdminModeClick, { signal: hrBeatStoreLifecycle.signal });
  beatLicenseModal?.addEventListener("click", handleBeatLicenseModalClick);
  document.addEventListener("keydown", handleBeatLicenseModalKeydown, { signal: hrBeatStoreLifecycle.signal });
}

function setBeatAdvancedPanelOpen(isOpen) {
  if (!beatFilterPanel) return;
  const nextOpen = Boolean(isOpen);
  beatFilterPanel.hidden = !nextOpen;
  beatAdvancedToggle?.setAttribute("aria-expanded", String(nextOpen));
  document.body.classList.toggle("beat-filter-panel-open", nextOpen);
  if (nextOpen) {
    beatFilterPanelScrollY = window.scrollY;
    beatFilterPanelLastFocus = document.activeElement;
    beatFilterPanel.querySelector(".beat-filter-panel__close")?.focus?.({ preventScroll: true });
    restoreBeatFilterPanelScroll();
  } else {
    beatFilterPanelLastFocus?.focus?.({ preventScroll: true });
    restoreBeatFilterPanelScroll();
    beatFilterPanelLastFocus = null;
  }
}

function restoreBeatFilterPanelScroll() {
  window.scrollTo(0, beatFilterPanelScrollY);
  window.requestAnimationFrame(() => window.scrollTo(0, beatFilterPanelScrollY));
  window.setTimeout(() => window.scrollTo(0, beatFilterPanelScrollY), 0);
}

function handleBeatFilterPanelKeydown(event) {
  if (!beatFilterPanel || beatFilterPanel.hidden) return;
  if (event.key === "Escape") {
    event.preventDefault();
    setBeatAdvancedPanelOpen(false);
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [...beatFilterPanel.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function ensureAdminMusicFields() {
  if (!adminForm || document.getElementById("beat-genre-input")) return;
  const producerField = document.getElementById("beat-producer")?.closest(".field");
  if (!producerField) return;

  const wrapper = document.createElement("div");
  wrapper.className = "beat-admin__music-fields";
  wrapper.innerHTML = `
    <div class="field hr-field"><label class="hr-label" for="beat-genre-input">Género</label><input class="hr-input" id="beat-genre-input" maxlength="80" placeholder="Trap, Boom bap, Reggaeton..."></div>
    <div class="field hr-field beat-autodetect-field"><label class="hr-label" for="beat-bpm">BPM</label><div class="beat-ad-input"><input class="hr-input" id="beat-bpm" type="number" min="1" max="300" step="1"><span class="beat-ad-badge" data-ad-badge="bpm" hidden>AD</span></div><button class="secondary-button beat-autodetect-button" type="button" data-autodetect="bpm">Autodetectar</button></div>
    <div class="field hr-field beat-autodetect-field"><label class="hr-label" for="beat-key">Tonalidad</label><div class="beat-ad-input"><input class="hr-input" id="beat-key" maxlength="24" placeholder="Cm, F# minor..."><span class="beat-ad-badge" data-ad-badge="key" hidden>AD</span></div><button class="secondary-button beat-autodetect-button" type="button" data-autodetect="key">Autodetectar</button></div>
    <input id="beat-duration" type="hidden">
  `;
  producerField.insertAdjacentElement("afterend", wrapper);
}

function adminProductMetaText(product) {
  return [
    product.beat_genre ? formatGenreLabel(product.beat_genre) : null,
    product.beat_bpm ? `${product.beat_bpm} BPM${product.beat_bpm_autodetected ? " (AD)" : ""}` : null,
    product.beat_key ? `${product.beat_key}${product.beat_key_autodetected ? " (AD)" : ""}` : null,
    product.beat_duration_seconds ? formatDuration(product.beat_duration_seconds) : null,
  ].filter(Boolean).join(" / ");
}

function adminBeatMissingAssetLabels(product) {
  if (!state.hasBeatDeliveryPaths) return [];
  return [
    ["beat_original_path", ".wav", "NO WAV"],
    ["beat_mp3_path", ".mp3", "NO MP3"],
    ["beat_stems_path", ".zip", "NO STEMS"],
  ]
    .filter(([field, extension]) => !beatDeliveryPathHasExtension(product?.[field], extension))
    .map(([, , label]) => label);
}

function beatDeliveryPathHasExtension(value, extension) {
  return String(value || "").trim().toLowerCase().endsWith(extension);
}

function adminBeatAssetBadges(product) {
  return adminBeatMissingAssetLabels(product)
    .map((label) => `<span class="product-category beat-admin-row__missing-asset">${escapeHtml(label)}</span>`)
    .join("");
}

function adminBeatDeliveryAvailability(beatId = "") {
  const product = state.adminProducts.find((candidate) => candidate.id === beatId);
  const selectedFile = beatUploadInput?.files?.[0];
  return {
    wav: beatDeliveryPathHasExtension(product?.beat_original_path, ".wav") || Boolean(selectedFile && /\.wav$/i.test(selectedFile.name)),
    mp3: beatDeliveryPathHasExtension(product?.beat_mp3_path, ".mp3"),
    stems: beatDeliveryPathHasExtension(product?.beat_stems_path, ".zip"),
  };
}

function beatLicenseRequiredAssets(license) {
  const format = String(license?.format || "").trim().toLowerCase();
  return [
    format.includes("wav") ? "wav" : "",
    format.includes("mp3") ? "mp3" : "",
    format.includes("stem") ? "stems" : "",
  ].filter(Boolean);
}

function beatLicenseMissingAssets(license, availability) {
  return beatLicenseRequiredAssets(license).filter((asset) => !availability[asset]);
}

function beatLicenseMissingAssetsLabel(missingAssets) {
  return missingAssets.map((asset) => asset === "stems" ? "STEMS" : asset.toUpperCase()).join(" + ");
}

function wantsAdminMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("view") === "admin" || params.get("admin") === "1";
}

function requestedAdminTab() {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return ["upload", "licenses", "upload-permissions", "mercadopago"].includes(tab) ? tab : "beats";
}

function setAdminTab(tab = "beats", syncUrl = false) {
  const activeTab = ["upload", "licenses", "upload-permissions", "mercadopago"].includes(tab) ? tab : "beats";
  adminTabButtons.forEach((button) => {
    const isActive = button.dataset.adminTab === activeTab;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    if (isActive) button.removeAttribute("tabindex");
    else button.setAttribute("tabindex", "-1");
  });
  adminTabPanels.forEach((panel) => {
    panel.hidden = panel.dataset.adminPanel !== activeTab;
  });
  if (syncUrl && wantsAdminMode()) {
    const url = new URL(window.location.href);
    url.searchParams.set("view", "admin");
    url.searchParams.set("tab", activeTab);
    url.searchParams.delete("edit");
    history.pushState(null, "", url);
  }
}

function setAdminMode(active) {
  const isActive = Boolean(active);
  document.body.classList.toggle("beat-admin-mode", isActive);
  if (adminPanel) adminPanel.hidden = !isActive;
  syncAdminSubNavState(isActive);
}

function syncAdminSubNavState(active) {
  document.querySelectorAll('.hr-nav__sub-link[href="/store/beat_store/"]').forEach((link) => {
    if (active) {
      link.removeAttribute("aria-current");
    } else {
      link.setAttribute("aria-current", "page");
    }
  });
  document.querySelectorAll('.hr-nav__sub-link[href="/store/beat_store/?view=admin"]').forEach((link) => {
    if (active) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function handleBeatLicenseAssignmentChange(event) {
  const checkbox = event.target.closest("[data-beat-license-check]");
  if (!checkbox) return;
  const input = beatLicenseAssignmentList?.querySelector(`[data-beat-license-price="${CSS.escape(checkbox.dataset.beatLicenseCheck)}"]`);
  if (input) input.disabled = !checkbox.checked;
}
function handleAdminModeClick(event) {
  const adminEntry = event.target.closest("[data-beat-admin-entry]");
  const storeEntry = event.target.closest("[data-beat-store-entry]");
  if (adminEntry) {
    event.preventDefault();
    const url = new URL(window.location.href);
    url.searchParams.set("view", "admin");
    url.searchParams.set("tab", "beats");
    url.hash = "";
    history.pushState(null, "", url);
    setAdminMode(true);
    requestAnimationFrame(() => adminPanel?.scrollIntoView({ behavior: "smooth", block: "start" }));
    return;
  }
  if (storeEntry) {
    event.preventDefault();
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    url.searchParams.delete("admin");
    url.searchParams.delete("tab");
    url.hash = "";
    history.pushState(null, "", url);
    setAdminMode(false);
    requestAnimationFrame(() => document.getElementById("beats-title")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
}

async function currentUserIsAdmin() {
  const viewAs = await Promise.resolve(window.HiddenRoomViewAs?.ready?.());
  if (viewAs?.active) return false;

  const { data: { session } } = await supabase.auth.getSession();
  state.currentUserId = session?.user?.id ?? null;
  if (!session?.user) return false;

  const { data: profile, error } = await supabase
    .from("users")
    .select("roles, username")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) return false;
  state.currentUsername = String(profile?.username || "").trim();
  const approvalResult = await supabase.rpc("is_approved_producer");
  state.canEditOwnBeats = !approvalResult.error && Boolean(approvalResult.data);
  syncProducerUsernameButton();
  return String(profile?.roles ?? "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .includes("admin");
}

const BEAT_PRODUCT_BASE_SELECT = "id, slug, name, description, category, price, currency, image_url, beat_cover_path, beat_thumb_path, file_url, producer, producer_profile_id, stock, is_digital, featured, is_active, created_at";
const BEAT_PRODUCT_META_SELECT = `${BEAT_PRODUCT_BASE_SELECT}, producer_user_id, beat_genre, beat_bpm, beat_key, beat_duration_seconds`;
const BEAT_PRODUCT_AUTODETECT_SELECT = `${BEAT_PRODUCT_META_SELECT}, beat_bpm_autodetected, beat_key_autodetected`;
const BEAT_PRODUCT_PREVIEW_COLUMNS = "beat_preview_path, beat_preview_status, beat_preview_error";
const BEAT_PRODUCT_DELIVERY_COLUMNS = "beat_original_path, beat_mp3_path, beat_stems_path";

function beatProductSelect(includeAdminAssets = false) {
  const metadata = state.hasBeatAutodetectFlags ? BEAT_PRODUCT_AUTODETECT_SELECT : BEAT_PRODUCT_META_SELECT;
  const columns = [metadata];
  if (includeAdminAssets && state.hasBeatDeliveryPaths) columns.push(BEAT_PRODUCT_DELIVERY_COLUMNS);
  if (state.hasBeatPreviews) columns.push(BEAT_PRODUCT_PREVIEW_COLUMNS);
  return columns.join(", ");
}

async function fetchBeatProducts(includeInactive = false) {
  const columns = state.hasBeatMetadata ? beatProductSelect(includeInactive) : BEAT_PRODUCT_BASE_SELECT;
  const { data, error } = await runBeatProductQuery(includeInactive, columns);

  if (!error) return data ?? [];

  if (state.hasBeatPreviews && isMissingBeatPreviewError(error)) {
    state.hasBeatPreviews = false;
    const fallbackColumns = state.hasBeatMetadata ? beatProductSelect(includeInactive) : BEAT_PRODUCT_BASE_SELECT;
    const fallback = await runBeatProductQuery(includeInactive, fallbackColumns);
    if (!fallback.error) return fallback.data ?? [];
    throw new Error(`No se pudieron cargar productos: ${fallback.error.message}`);
  }

  if (includeInactive && state.hasBeatDeliveryPaths && isMissingBeatDeliveryError(error)) {
    state.hasBeatDeliveryPaths = false;
    const fallback = await runBeatProductQuery(includeInactive, beatProductSelect(includeInactive));
    if (!fallback.error) return fallback.data ?? [];
    throw new Error(`No se pudieron cargar productos: ${fallback.error.message}`);
  }

  if (state.hasBeatAutodetectFlags && isMissingBeatAutodetectFlagError(error)) {
    state.hasBeatAutodetectFlags = false;
    const fallbackColumns = beatProductSelect(includeInactive);
    const fallback = await runBeatProductQuery(includeInactive, fallbackColumns);
    if (!fallback.error) return fallback.data ?? [];
    throw new Error(`No se pudieron cargar productos: ${fallback.error.message}`);
  }

  if (state.hasBeatMetadata && isMissingBeatMetadataError(error)) {
    state.hasBeatMetadata = false;
    const fallback = await runBeatProductQuery(includeInactive, BEAT_PRODUCT_BASE_SELECT);
    if (!fallback.error) return fallback.data ?? [];
    throw new Error(`No se pudieron cargar productos: ${fallback.error.message}`);
  }

  throw new Error(`No se pudieron cargar productos: ${error.message}`);
}

function runBeatProductQuery(includeInactive, columns) {
  let query = supabase
    .from("store_products")
    .select(columns)
    .eq("category", "beats")
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  if (!includeInactive) query = query.eq("is_active", true);
  return query;
}

function isMissingBeatPreviewError(error) {
  const message = String(error?.message || error?.details || "").toLowerCase();
  return error?.code === "42703" && ["beat_preview_path", "beat_preview_status", "beat_preview_error"].some((column) => message.includes(column));
}

function isMissingBeatDeliveryError(error) {
  const message = String(error?.message || error?.details || "").toLowerCase();
  return error?.code === "42703" && ["beat_original_path", "beat_mp3_path", "beat_stems_path"].some((column) => message.includes(column));
}

function isMissingBeatAutodetectFlagError(error) {
  const message = String(error?.message || error?.details || "").toLowerCase();
  return error?.code === "42703" && ["beat_bpm_autodetected", "beat_key_autodetected"].some((column) => message.includes(column));
}

function isMissingBeatMetadataError(error) {
  const message = String(error?.message || error?.details || "").toLowerCase();
  return error?.code === "42703" || ["beat_genre", "beat_bpm", "beat_key", "beat_duration_seconds", "producer_user_id", "producer_profile_id"].some((column) => message.includes(column));
}

async function fetchGlobalBeatPlayerSetting() {
  const { data, error } = await supabase
    .from("beat_store_settings")
    .select("global_player_beat_id")
    .eq("id", 1)
    .maybeSingle();
  return {
    id: String(data?.global_player_beat_id || "").trim(),
    error: error || null,
  };
}
async function fetchBeatLicenses(includeInactive = false) {
  if (!state.hasBeatLicenses) return [];
  let query = supabase
    .from("beat_licenses")
    .select("id, name, min_price, max_price, description, terms, stream_limit, unlimited_streams, format, is_active, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) {
    if (isMissingBeatLicensesError(error)) {
      state.hasBeatLicenses = false;
      return [];
    }
    throw new Error(`No se pudieron cargar licencias: ${error.message}`);
  }
  return data ?? [];
}

async function fetchProducerProfiles(includeInactive = false) {
  let query = supabase
    .from("producer_profiles")
    .select("id, user_id, slug, display_name, bio, avatar_url, cover_url, social_links, is_active, created_at")
    .order("display_name", { ascending: true });
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) return [];
  return data ?? [];
}

async function fetchBeatUploadAccess(includeAdmin = false, searchTerm = "") {
  if (!includeAdmin) return { users: [], permissions: [], error: null };
  const { data: permissions, error: permissionsError } = await supabase
    .from("user_permissions")
    .select("id, user_id, permission_key")
    .eq("permission_key", "beats.upload");
  if (permissionsError) return { users: [], permissions: [], error: permissionsError };

  const normalizedSearch = String(searchTerm || "").trim();
  const safeSearch = normalizedSearch.replace(/[%,_*\\()]/g, " ").trim().slice(0, 80);
  let userQuery = supabase
    .from("users")
    .select("id, display_name, username, email, roles")
    .order("display_name", { ascending: true })
    .limit(50);
  if (safeSearch) {
    userQuery = userQuery.or(`display_name.ilike.%${safeSearch}%,username.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`);
  } else {
    const authorizedIds = permissions.map((permission) => String(permission.user_id)).filter(Boolean);
    const adminUsers = await supabase
      .from("users")
      .select("id, display_name, username, email, roles")
      .ilike("roles", "%admin%")
      .order("display_name", { ascending: true });
    const adminRows = adminUsers.data ?? [];
    if (adminUsers.error) return { users: [], permissions, error: adminUsers.error };
    if (!authorizedIds.length) return { users: adminRows, permissions, error: null };
    userQuery = userQuery.in("id", [...new Set([...authorizedIds, ...adminRows.map((user) => String(user.id))])]);
  }
  const { data: users, error: usersError } = await userQuery;
  return {
    users: users ?? [],
    permissions: permissions ?? [],
    error: usersError || permissionsError,
  };
}

async function fetchMercadoPagoConfig(includeAdmin = false) {
  if (!includeAdmin) return { data: null, error: null };
  const { data, error } = await supabase.rpc("mp_config_status");
  return { data, error };
}

async function fetchBeatLicenseAssignments(beatIds, includeDisabled = false) {
  if (!state.hasBeatLicenses || !beatIds.length) return [];
  let query = supabase
    .from("beat_license_assignments")
    .select("id, beat_id, license_id, price, is_enabled, beat_licenses(id, name, min_price, max_price, description, terms, stream_limit, unlimited_streams, format, is_active)")
    .in("beat_id", beatIds);
  if (!includeDisabled) query = query.eq("is_enabled", true);
  const { data, error } = await query;
  if (error) {
    if (isMissingBeatLicensesError(error)) {
      state.hasBeatLicenses = false;
      return [];
    }
    throw new Error(`No se pudieron cargar asignaciones de licencias: ${error.message}`);
  }
  return data ?? [];
}

function isMissingBeatLicensesError(error) {
  const message = String(error?.message || error?.details || "").toLowerCase();
  return error?.code === "42P01" || error?.code === "42703" || message.includes("beat_licenses") || message.includes("beat_license_assignments");
}
async function fetchCloudBeats() {
  const response = await fetch(BEAT_STORE_ENDPOINT, { headers: { Accept: "application/json" } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "No se pudo leer beats_store en Cloud.");
  return Array.isArray(result.beats) ? result.beats : [];
}

function mergeProductsAndBeats(products, beats) {
  const beatBySlug = new Map();
  const beatByTitle = new Map();
  const beatByFilePath = new Map();
  const beatByFileName = new Map();
  for (const beat of beats) {
    beatBySlug.set(normalizeKey(beat.slug), beat);
    beatByTitle.set(normalizeKey(beat.title), beat);
    beatByFilePath.set(normalizeKey(BEAT_STORE_CLOUD_PATH + '/' + beat.file), beat);
    beatByFilePath.set(normalizeKey(beat.file), beat);
    beatByFileName.set(normalizeKey(cloudFileName(beat.file)), beat);
  }

  return products.map((product) => {
    const beat = beatByFilePath.get(normalizeKey(product.file_url))
      || beatByFileName.get(normalizeKey(cloudFileName(product.file_url)))
      || beatBySlug.get(normalizeKey(product.slug))
      || beatByTitle.get(normalizeKey(product.name))
      || null;
    return { id: 'product:' + product.id, beat, product };
  });
}
function buildBeatSearchIndex() {
  state.searchIndex = new Map();
  state.genreIndex = new Map();
  for (const item of state.items) {
    const product = item.product;
    const beat = item.beat;
    const genre = beatGenre(item);
    const profile = producerProfileForProduct(product);
    const haystack = [product?.name, product?.description, product?.producer, profile?.display_name, product?.slug, beat?.title, beat?.file, beat?.slug, genre, itemMusicMeta(item).map((entry) => entry.value).join(" ")]
      .filter(Boolean).join(" ").toLowerCase();
    state.searchIndex.set(item.id, haystack);
    state.genreIndex.set(item.id, beatGenreGroupKey(genre));
  }
  state.renderVersion += 1;
  state.renderedKey = "";
}

function renderBeats() {
  const query = String(searchInput?.value || "").trim().toLowerCase();
  const genre = genreSelect?.value === SELECT_PLACEHOLDER ? "" : String(genreSelect?.value || "").trim();
  const selectedGenreKey = genre ? beatGenreGroupKey(genre) : "";
  const producer = String(activeProducerSelect()?.value || "").trim();
  const priceMin = numericFilterValue(priceMinInput);
  const priceMax = numericFilterValue(priceMaxInput);
  const bpmMin = numericFilterValue(bpmMinInput);
  const bpmMax = numericFilterValue(bpmMaxInput);
  const sortMode = sortSelect?.value && sortSelect.value !== SELECT_PLACEHOLDER ? sortSelect.value : "featured_desc";
  const sorted = sortItems(state.items, sortMode);
  const filtered = sorted.filter((item) => {
    const price = Number(item.product?.price || 0);
    const bpm = Number(item.product?.beat_bpm || item.beat?.bpm || 0);
    const profile = producerProfileForProduct(item.product);
    const itemProducer = normalizeKey(profile?.slug || item.product?.producer || "");
    return (!query || state.searchIndex.get(item.id)?.includes(query))
      && (!selectedGenreKey || state.genreIndex.get(item.id) === selectedGenreKey)
      && (!producer || itemProducer === producer)
      && (priceMin === null || price >= priceMin)
      && (priceMax === null || price <= priceMax)
      && (bpmMin === null || bpm >= bpmMin)
      && (bpmMax === null || bpm <= bpmMax);
  });
  const renderKey = `${state.renderVersion}|${query}|${genre}|${producer}|${priceMin ?? ""}|${priceMax ?? ""}|${bpmMin ?? ""}|${bpmMax ?? ""}|${sortMode}|${filtered.map((item) => item.id).join(",")}`;
  if (renderKey === state.renderedKey) return;
  state.renderedKey = renderKey;
  updateBeatFilterUi(filtered.length, state.items.length, renderKey);
  grid.classList.add("hr-filtering");
  window.requestAnimationFrame(() => grid.classList.remove("hr-filtering"));

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state hr-empty-state beat-empty"><h2>Sin beats</h2><p>${query ? "Prueba otra búsqueda." : "No hay beats activos publicados."}</p></div>`;
    return;
  }

  grid.innerHTML = renderGenreRows(filtered);
  hydrateMissingBeatDurations(filtered);
}

function renderGenreRows(items) {
  const groups = new Map();
  for (const item of items) {
    const rawGenre = item?.product?.beat_genre || item?.beat?.genre || "";
    const normalizedGenre = normalizeKey(rawGenre);
    const key = ["perreo", "reggaeton"].includes(normalizedGenre)
      ? "perreo-reggaeton"
      : normalizedGenre || "__no_genre__";
    if (!groups.has(key)) {
      groups.set(key, {
        label: key === "perreo-reggaeton" ? "Perreo / Reggaeton" : formatGenreLabel(rawGenre) || "Sin género",
        filterValue: key === "__no_genre__" ? "" : key,
        items: [],
      });
    }
    groups.get(key).items.push(item);
  }

  return Array.from(groups.entries())
    .sort((a, b) => {
      const genreRank = (key) => {
        if (key === "perreo-reggaeton") return 0;
        if (key === normalizeKey("Boom Bap")) return 1;
        if (key === "__no_genre__") return 999;
        return 10;
      };
      const rankDifference = genreRank(a[0]) - genreRank(b[0]);
      if (rankDifference) return rankDifference;
      return a[1].label.localeCompare(b[1].label, "es-MX");
    })
    .map(([, group]) => (
      '<section class="beat-genre-row" aria-label="' + escapeHtml(group.label) + '">' +
        '<header class="beat-genre-row__heading"><h2>' + escapeHtml(group.label) + '</h2>' +
          (group.filterValue ? '<button class="beat-genre-row__view-all" type="button" data-genre-filter="' + escapeHtml(group.filterValue) + '">Ver todos →</button>' : '') +
        '</header>' +
        '<div class="beat-genre-row__track">' + group.items.map(beatCardMarkup).join("") + '</div>' +
      '</section>'
    ))
    .join("");
}

function hydrateMissingBeatDurations(items) {
  for (const item of items) {
    if (itemDurationSeconds(item)) continue;
    const previewUrl = previewUrlForItem(item);
    if (!previewUrl || state.durationDetections.has(item.id)) continue;
    state.durationDetections.add(item.id);
    detectAudioDurationFromUrl(previewUrl)
      .then(async (seconds) => {
        setItemDuration(item, seconds);
        updateBeatCardMeta(item);
        if (item.product?.id && state.isAdmin) {
          await supabase
            .from("store_products")
            .update({ beat_duration_seconds: seconds })
            .eq("id", item.product.id);
        }
      })
      .catch(() => {
        state.durationDetections.delete(item.id);
      });
  }
}

function updateBeatCardMeta(item) {
  const card = grid?.querySelector(`[data-item-id="${CSS.escape(item.id)}"]`);
  const slot = card?.querySelector(".beat-card__meta-slot");
  if (!slot) return;
  slot.innerHTML = musicMetaMarkup(itemMusicMeta(item));
}

function itemDurationSeconds(item) {
  return Number(item?.product?.beat_duration_seconds || item?.beat?.duration_seconds || item?.beat?.duration || 0) || 0;
}

function setItemDuration(item, seconds) {
  if (item.product) item.product.beat_duration_seconds = seconds;
  else if (item.beat) item.beat.duration_seconds = seconds;
}

function detectAudioDurationFromUrl(url) {
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.crossOrigin = "anonymous";
    audio.onloadedmetadata = () => {
      const seconds = Math.round(audio.duration || 0);
      if (Number.isFinite(seconds) && seconds > 0) resolve(seconds);
      else reject(new Error("Duración inválida"));
    };
    audio.onerror = () => reject(new Error("No se pudo leer el audio"));
    audio.src = url;
  });
}
function renderGenreOptions() {
  if (!genreSelect) return;
  const current = genreSelect.value;
  const genres = Array.from(new Map(state.items
    .map((item) => beatGenre(item))
    .filter(Boolean)
    .map((genre) => {
      const key = beatGenreGroupKey(genre);
      return [key, key === MERGED_GENRE_KEY ? "Reggaeton / Perreo" : genre];
    })).entries())
    .sort((a, b) => {
      const rank = (key) => key === MERGED_GENRE_KEY ? 0 : key === normalizeKey("Boom Bap") ? 1 : 10;
      return rank(a[0]) - rank(b[0]) || a[1].localeCompare(b[1], "es-MX");
    });
  genreSelect.innerHTML = `<option value="${SELECT_PLACEHOLDER}" disabled>Género</option><option value="">Todos</option>${genres.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(formatGenreLabel(label))}</option>`).join("")}`;
  const currentKey = current ? beatGenreGroupKey(current) : current;
  genreSelect.value = genres.some(([value]) => value === currentKey) || current === "" ? currentKey : SELECT_PLACEHOLDER;
}

function formatGenreLabel(value) {
  return String(value || "").trim().toLocaleLowerCase("es-MX").replace(/(^|[\s\/&'’-])(\p{L})/gu, (_, separator, letter) => separator + letter.toLocaleUpperCase("es-MX"));
}

function beatGenreGroupKey(value) {
  const normalized = normalizeKey(value);
  return ["perreo", "reggaeton"].includes(normalized) ? MERGED_GENRE_KEY : normalized || "__no_genre__";
}

function renderProducerOptions() {
  const targetSelect = activeProducerSelect();
  if (!targetSelect) return;
  const current = targetSelect.value;
  const producers = Array.from(new Map(state.items.map((item) => {
    const profile = producerProfileForProduct(item.product);
    const value = normalizeKey(profile?.slug || item.product?.producer || "");
    return [value, producerDisplayName(profile?.display_name || item.product?.producer || "")];
  }).filter(([value, label]) => value && label)).entries()).sort((a, b) => a[1].localeCompare(b[1]));
  const options = `<option value="" disabled>Productor</option>${producers.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("")}`;
  targetSelect.innerHTML = options;
  targetSelect.value = producers.some(([value]) => value === current) ? current : "";
  if (producerSelect && producerSelect !== targetSelect) {
    producerSelect.innerHTML = options;
    producerSelect.value = targetSelect.value;
  }
  if (advancedProducerSelect && advancedProducerSelect !== targetSelect) {
    advancedProducerSelect.innerHTML = options;
    advancedProducerSelect.value = targetSelect.value;
  }
}

function numericFilterValue(input) {
  if (!input || input.value === "") return null;
  const value = Number(input.value);
  return Number.isFinite(value) ? value : null;
}

function applyBeatUrlState() {
  if (searchInput) searchInput.value = "";
  if (genreSelect) genreSelect.value = SELECT_PLACEHOLDER;
  if (activeProducerSelect()) activeProducerSelect().value = "";
  if (priceMinInput) priceMinInput.value = "";
  if (priceMaxInput) priceMaxInput.value = "";
  if (bpmMinInput) bpmMinInput.value = "";
  if (bpmMaxInput) bpmMaxInput.value = "";
  if (sortSelect) sortSelect.value = SELECT_PLACEHOLDER;
  beatLastUrlState = beatUrlStateKey();
}

function beatUrlStateKey() {
  return [searchInput?.value || "", genreSelect?.value || "", activeProducerSelect()?.value || "", priceMinInput?.value || "", priceMaxInput?.value || "", bpmMinInput?.value || "", bpmMaxInput?.value || "", sortSelect?.value || "featured_desc"].join("|");
}

function syncBeatUrlState(push = false) {
  window.clearTimeout(beatFilterUrlTimer);
  beatFilterUrlTimer = window.setTimeout(() => {
    beatLastUrlState = beatUrlStateKey();
  }, push ? 0 : 120);
}

function updateBeatFilterUi(resultCount, totalCount) {
  const activeFilterCount = [genreSelect?.value === SELECT_PLACEHOLDER ? null : genreSelect, activeProducerSelect(), priceMinInput, priceMaxInput, bpmMinInput, bpmMaxInput]
    .filter((input) => input?.value.trim()).length;
  if (beatFilterCount) {
    beatFilterCount.textContent = String(activeFilterCount);
    beatFilterCount.hidden = activeFilterCount === 0;
  }
  if (beatAdvancedToggle) {
    beatAdvancedToggle.setAttribute("aria-label", activeFilterCount ? `Filtros, ${activeFilterCount} activos` : "Filtros");
  }
  if (clearFiltersButton) clearFiltersButton.disabled = !hasBeatFilters();
}

function hasBeatFilters() {
  return Boolean(searchInput?.value.trim() || (genreSelect?.value && genreSelect.value !== SELECT_PLACEHOLDER) || activeProducerSelect()?.value || priceMinInput?.value || priceMaxInput?.value || bpmMinInput?.value || bpmMaxInput?.value);
}

function clearBeatFilters() {
  [searchInput, producerSelect, advancedProducerSelect, priceMinInput, priceMaxInput, bpmMinInput, bpmMaxInput].forEach((input) => { if (input) input.value = ""; });
  if (genreSelect) genreSelect.value = SELECT_PLACEHOLDER;
  if (sortSelect) sortSelect.value = SELECT_PLACEHOLDER;
}

function clearBeatAdvancedFilters() {
  [genreSelect, producerSelect, advancedProducerSelect, priceMinInput, priceMaxInput, bpmMinInput, bpmMaxInput].forEach((input) => { if (input) input.value = ""; });
}

function sortItems(items, mode = "featured_desc") {
  const [parameter, order] = mode.split("_");
  const direction = order === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    let result = 0;
    if (parameter === "name") result = itemTitle(a).localeCompare(itemTitle(b));
    else if (parameter === "date") result = String(a.beat?.modified || "").localeCompare(String(b.beat?.modified || ""));
    else if (parameter === "price") result = Number(a.product?.price || 0) - Number(b.product?.price || 0);
    else if (parameter === "bpm") result = Number(a.product?.beat_bpm || a.beat?.bpm || 0) - Number(b.product?.beat_bpm || b.beat?.bpm || 0);
    else result = Number(Boolean(a.product?.featured)) - Number(Boolean(b.product?.featured));
    return result * direction || itemTitle(a).localeCompare(itemTitle(b));
  });
}

function beatCardMarkup(item) {
  const product = item.product;
  const title = beatDisplayTitle(item);
  const canPreview = Boolean(previewUrlForItem(item));
  const canBuy = Boolean(product && productCanBePurchased(product));
  const producer = productProducer(item);
  const meta = itemMusicMeta(item);
  const licensePrices = availableBeatLicenses(item)
    .map((license) => Number(license.price))
    .filter((price) => Number.isFinite(price) && price >= 0);
  const productPrice = Number(product?.price);
  const startingPrice = licensePrices.length
    ? Math.min(...licensePrices)
    : (Number.isFinite(productPrice) && productPrice > 0 ? productPrice : null);
  const priceLabel = startingPrice === null
    ? "Aún no disponible"
    : `Desde ${formatPrice(startingPrice, product?.currency)}`;

  return sharedBeatCardMarkup({
    id: escapeHtml(item.id),
    title: escapeHtml(title),
    slug: product?.slug || "",
    producerMarkup: producerLinkMarkup(item, producer),
    coverMarkup: coverMarkup(item),
    metaMarkup: musicMetaMarkup(meta),
    optionsMarkup: beatCardOptionsMarkup(item),
    priceLabel: escapeHtml(priceLabel),
    canBuy,
  });
}

function canEditBeatItem(item) {
  const ownerId = String(item?.product?.producer_user_id || "");
  if (!item?.product?.id || !state.currentUserId) return false;
  if (state.isAdmin) return true;
  if (ownerId !== state.currentUserId) return false;
  return Boolean(state.canEditOwnBeats);
}

function beatCardOptionsMarkup(item) {
  const canEdit = canEditBeatItem(item) && Boolean(item?.product?.id);
  const slug = String(item?.product?.slug || "").trim();
  if (!canEdit && !slug) return "";
  const editMarkup = canEdit
    ? `<a href="${escapeHtml(state.isAdmin ? `?view=admin&tab=beats&edit=${encodeURIComponent(item.product.id)}` : `new-beat.html?id=${encodeURIComponent(item.product.id)}`)}">Editar beat</a>`
    : "";
  const shareMarkup = slug
    ? `<button class="beat-card__share-action" type="button" data-share-beat="${escapeHtml(item.id)}" aria-label="Compartir ${escapeHtml(beatDisplayTitle(item))}">Compartir</button>`
    : "";
  return `
      <details class="beat-card__options">
        <summary aria-label="Opciones de ${escapeHtml(beatDisplayTitle(item))}">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9L12 15L18 9"></path></svg>
        </summary>
        <div class="beat-card__options-menu">
          ${editMarkup}${shareMarkup}
        </div>
      </details>`;
}

function beatLicensesContentMarkup(item) {
  if (!item?.product) return '<p class="beat-license-empty">Licencias no disponibles para este beat.</p>';
  return beatLicenseModalMarkup({
    product: item.product,
    assignments: state.assignments,
    targetId: item.id,
    includeStemsPlaceholder: true,
  });
}
function availableBeatLicenses(item) {
  return state.assignments
    .filter((assignment) => assignment.beat_id === item.product?.id && beatLicenseAssignmentIsSelectable(item.product, assignment))
    .map((assignment) => ({
      id: assignment.license_id,
      assignmentId: assignment.id,
      name: assignment.beat_licenses?.name || "Licencia",
      price: Number(assignment.price),
      description: assignment.beat_licenses?.description || "Licencia disponible para este beat.",
      streams: streamLimitLabel(assignment.beat_licenses),
      format: assignment.beat_licenses?.format || "",
      terms: assignment.beat_licenses?.terms || "",
    }));
}
function musicMetaMarkup(meta) {
  if (!meta.length) return '<p class="beat-card__music beat-card__music--empty">Género, BPM y tonalidad por confirmar</p>';
  return `<dl class="beat-card__music">${meta.map((entry) => `
    <div><dt>${escapeHtml(entry.label)}</dt><dd>${escapeHtml(entry.value)}</dd></div>
  `).join("")}</dl>`;
}
function coverMarkup(item) {
  const title = beatDisplayTitle(item);
  const imageUrl = coverUrlForItem(item);
  const canPreview = Boolean(previewUrlForItem(item));
  const playAttrs = canPreview ? ` role="button" tabindex="0" data-play-beat="${escapeHtml(item.id)}" aria-label="Preview ${escapeHtml(title)}"` : "";
  const playOverlay = canPreview ? '<span class="beat-card__cover-play" aria-hidden="true">&#9658;</span>' : "";
  if (imageUrl) {
    return `<div class="beat-card__cover"${playAttrs} aria-label="Portada de ${escapeHtml(title)}"><img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" onerror="this.hidden=true;this.parentElement.classList.add(\'beat-card__cover--empty\');this.nextElementSibling.hidden=false"><span class="beat-card__cover-fallback" hidden>${escapeHtml(coverInitials(title))}</span>${playOverlay}</div>`;
  }
  return `<div class="beat-card__cover beat-card__cover--empty"${playAttrs}><span>${escapeHtml(coverInitials(title))}</span>${playOverlay}</div>`;
}

function coverUrlForItem(item) {
  const raw = String(item?.product?.beat_cover_path || item?.product?.image_url || item?.beat?.cover_url || item?.beat?.image_url || "").trim();
  if (!raw) return "";
  if (/^(?:https?:|data:|blob:)/i.test(raw)) return raw;
  if (raw.startsWith("/")) return new URL(raw, window.location.origin).href;
  const clean = raw.replaceAll("\\", "/").replace(/^beats_store\//i, "");
  return new URL(`/api/beat-store/stream?file=${encodeURIComponent(clean)}`, CLOUD_ORIGIN).href;
}
function coverInitials(value) {
  return String(value || "Beat")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0] || "")
    .join("")
    .toUpperCase();
}
function waveMarkup(seed) {
  const base = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0) || 7;
  const bars = Array.from({ length: 28 }, (_, index) => {
    const height = 18 + ((base * (index + 3) + index * index * 11) % 72);
    return `<span style="height:${height}%"></span>`;
  }).join("");
  return `<div class="beat-card__wave" aria-hidden="true">${bars}</div>`;
}

function handleGridKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const playTarget = event.target.closest("[data-play-beat]");
  if (!playTarget) return;
  event.preventDefault();
  toggleBeatPreview(playTarget.dataset.playBeat);
}
function handleGridClick(event) {
  const genreButton = event.target.closest("[data-genre-filter]");
  const playButton = event.target.closest("[data-play-beat]");
  const addButton = event.target.closest("[data-add-beat]");
  const shareButton = event.target.closest("[data-share-beat]");
  const buyLicenseButton = event.target.closest("[data-buy-license]");
  const licenseButton = event.target.closest("[data-add-license]");

  if (genreButton) {
    if (genreSelect) genreSelect.value = genreButton.dataset.genreFilter || SELECT_PLACEHOLDER;
    renderBeats();
    syncBeatUrlState(true);
    return;
  }
  if (playButton) {
    toggleBeatPreview(playButton.dataset.playBeat);
    return;
  }
  if (addButton) {
    openBeatLicensesModal(addButton.dataset.addBeat, addButton);
    return;
  }
  if (shareButton) {
    void shareBeat(shareButton.dataset.shareBeat);
    return;
  }
  if (buyLicenseButton) {
    if (addBeatLicenseToCart(buyLicenseButton.dataset.buyLicense, buyLicenseButton.dataset.licenseId)) window.location.assign("../cart.html");
    return;
  }
  if (licenseButton) {
    addBeatLicenseToCart(licenseButton.dataset.addLicense, licenseButton.dataset.licenseId);
    return;
  }
}

async function shareBeat(itemId) {
  const item = state.items.find((candidate) => candidate.id === itemId || candidate.product?.id === itemId);
  const slug = String(item?.product?.slug || "").trim();
  if (!item || !slug) {
    showNotice("Este beat no tiene un enlace público.", true);
    return;
  }

  const title = beatDisplayTitle(item);
  const url = new URL(`../product.html?slug=${encodeURIComponent(slug)}`, window.location.href).href;
  const shareData = {
    title: `${title} | Hidden Room`,
    text: `Escucha ${title} en Hidden Room.`,
    url,
  };

  if (typeof navigator.share === "function") {
    try {
      await navigator.share(shareData);
      trackBeatShare("native_share", item);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  try {
    await copyTextToClipboard(url);
    trackBeatShare("copy_link", item);
    showNotice("Enlace del beat copiado");
  } catch {
    showNotice("No se pudo copiar el enlace. Intenta de nuevo.", true);
  }
}

function trackBeatShare(method, item) {
  if (typeof window.gtag !== "function") return;
  window.gtag("event", "share", {
    method,
    content_type: "beat",
    item_id: item?.product?.id || item?.id || "",
    funnel: "beat_store",
  });
}

async function copyTextToClipboard(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall back to the synchronous copy path for browsers without clipboard permission.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  Object.assign(textarea.style, { position: "fixed", opacity: "0", pointerEvents: "none" });
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("No se pudo copiar");
}

function addBeatLicenseToCart(itemId, licenseId) {
  const item = state.items.find((candidate) => candidate.id === itemId || candidate.product?.id === itemId);
  const license = availableBeatLicenses(item).find((candidate) => candidate.id === licenseId);
  const product = item?.product;
  if (!product || !license) return;
  let cart = [];
  try {
    const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    cart = Array.isArray(stored) ? stored : [];
  } catch {
    cart = [];
  }
  const existing = cart.find((entry) => entry?.id === product.id && entry?.license_id === license.id);
  if (existing) {
    showNotice("Esta licencia ya esta en tu carrito");
    return true;
  }
  cart.push({
    id: product.id,
    beat_id: product.id,
    license_id: license.id,
    license_price: license.price,
    license_name: license.name,
    license_description: license.description,
    license_format: license.format,
    license_terms: license.terms,
    beat_producer: producerDisplayName(productProducer(item)),
    producer_slug: producerProfileForProduct(product)?.slug || normalizeKey(productProducer(item)),
    quantity: 1,
  });
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  if (typeof window.gtag === "function") window.gtag("event", "add_to_cart", { funnel: "beat_store", item_type: "beat_license" });
  document.querySelectorAll(".cart-count").forEach((element) => { element.textContent = String(cart.reduce((sum, entry) => sum + Math.max(1, Number(entry?.quantity) || 1), 0)); });
  window.dispatchEvent(new CustomEvent("hr:store-cart-updated"));
  showNotice("añadido al carrito");
  return true;
}

function openBeatLicensesModal(itemId, trigger = null) {
  const item = state.items.find((candidate) => candidate.id === itemId || candidate.product?.id === itemId);
  if (!item || !beatLicenseModal || !beatLicenseModalContent) return;


  beatLicenseModalContent.innerHTML = beatLicensesContentMarkup(item);

  beatLicenseModalContent.querySelectorAll(".beat-license-terms").forEach((terms) => {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "Ver terminos registrados";
    details.append(summary, terms.cloneNode(true));
    terms.replaceWith(details);
  });
  if (typeof window.gtag === "function") window.gtag("event", "license_view", { funnel: "beat_store" });
  beatLicenseLastTrigger = trigger;
  trigger?.setAttribute("aria-expanded", "true");
  if (beatLicenseModal.parentElement !== document.body) document.body.appendChild(beatLicenseModal);
  beatLicenseModal.hidden = false;
  document.body.classList.add("beat-license-modal-open");
  beatLicenseModal.querySelector("[data-license-modal-close]")?.focus?.();
}

function closeBeatLicensesModal() {
  if (!beatLicenseModal) return;
  beatLicenseModal.hidden = true;
  document.body.classList.remove("beat-license-modal-open");
  if (beatLicenseModalContent) beatLicenseModalContent.innerHTML = "";
  beatLicenseLastTrigger?.setAttribute("aria-expanded", "false");
  beatLicenseLastTrigger?.focus?.();
  beatLicenseLastTrigger = null;
}

function handleBeatLicenseModalClick(event) {
  if (event.target.closest("[data-license-modal-close]")) {
    closeBeatLicensesModal();
    return;
  }
  const buyButton = event.target.closest("[data-buy-license]");
  const addButton = event.target.closest("[data-add-license]");
  if (buyButton) {
    if (addBeatLicenseToCart(buyButton.dataset.buyLicense, buyButton.dataset.licenseId)) window.location.assign("../cart.html");
    return;
  }
  if (addButton) addBeatLicenseToCart(addButton.dataset.addLicense, addButton.dataset.licenseId);
}

function handleBeatLicenseModalKeydown(event) {
  if (!beatLicenseModal || beatLicenseModal.hidden) return;
  if (event.key === "Escape") {
    closeBeatLicensesModal();
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = [...beatLicenseModal.querySelectorAll("button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])")];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function toggleBeatPreview(itemId) {
  const item = state.items.find((candidate) => candidate.id === itemId || candidate.product?.id === itemId);
  const previewUrl = previewUrlForItem(item);
  if (!item || !previewUrl) return;
  if (window.HiddenRoomBeatPlayer?.src === previewUrl && window.HiddenRoomBeatPlayer?.isPlaying) {
    window.dispatchEvent(new CustomEvent("hr:beat-preview-toggle", { detail: { source: "beat-store", action: "pause" } }));
    return;
  }
  playBeat(itemId);
}

function syncBeatCardPlayState(event) {
  const activeSrc = event.detail?.src || "";
  const isPlaying = Boolean(event.detail?.isPlaying);
  const activeId = String(event.detail?.beatId || "");
  const activeItem = state.items.find((candidate) => candidate.id === activeId || candidate.product?.id === activeId);
  const beatStoreUrl = new URL("/store/beat_store/", window.location.origin).href;
  [document.getElementById("player-title"), document.querySelector("#beat-player-fullscreen-title > a")].forEach((link) => {
    if (!link) return;
    link.href = beatStoreUrl;
    link.removeAttribute("aria-disabled");
    link.removeAttribute("tabindex");
  });
  const producerProfile = producerProfileForProduct(activeItem?.product);
  const producerLink = document.querySelector("#beat-player-fullscreen-producer > a");
  const producerUrl = producerProfile?.is_active === false || !producerProfile?.slug
    ? ""
    : `producer.html?producer=${encodeURIComponent(producerProfile.slug)}`;
  if (producerLink && producerUrl) {
    producerLink.href = producerUrl;
    producerLink.removeAttribute("aria-disabled");
    producerLink.removeAttribute("tabindex");
  }
  document.querySelectorAll(".beat-card__cover[data-play-beat]").forEach((cover) => {
    const item = state.items.find((candidate) => candidate.id === cover.dataset.playBeat);
    const isActive = previewUrlForItem(item) === activeSrc;
    cover.classList.toggle("is-playing", isActive && isPlaying);
    cover.closest(".beat-card")?.classList.toggle("is-active", isActive);
    cover.querySelector(".beat-card__cover-play").innerHTML = isActive && isPlaying ? "&#10074;&#10074;" : "&#9658;";
  });
}

function playBeat(itemId) {
  const item = state.items.find((candidate) => candidate.id === itemId || candidate.product?.id === itemId);
  const previewUrl = previewUrlForItem(item);
  if (!item || !previewUrl) return;
  const visibleIds = [...document.querySelectorAll("[data-play-beat]")]
    .map((cover) => cover.dataset.playBeat)
    .filter(Boolean)
    .filter((id, index, ids) => ids.indexOf(id) === index);
  const visibleItems = visibleIds
    .map((id) => state.items.find((candidate) => candidate.id === id))
    .filter((candidate) => candidate && previewUrlForItem(candidate));
  const sequence = visibleItems.length ? visibleItems : state.items.filter((candidate) => previewUrlForItem(candidate));
  const detail = beatPlayerDetailForItem(item);
  const producer = productProducer(item);
  const producerProfile = producerProfileForProduct(item.product);
  detail.detail = producerDisplayName(producer);
  detail.producerSlug = producerProfile?.is_active === false ? "" : producerProfile?.slug || normalizeKey(producer);
  window.dispatchEvent(new CustomEvent("hr:beat-preview", {
    detail: {
      ...detail,
      queue: sequence.map(beatPlayerDetailForItem),
    },
  }));
}

function beatPlayerDetailForItem(item) {
  if (!item) return null;
  const producer = productProducer(item);
  const producerProfile = producerProfileForProduct(item.product);
  return {
    source: "beat-store",
    src: previewUrlForItem(item),
    title: beatDisplayTitle(item),
    detail: producerDisplayName(producer),
    cover: coverUrlForItem(item),
    beatId: item.id,
    slug: item.product?.slug || "",
    producerSlug: producerProfile?.is_active === false ? "" : producerProfile?.slug || normalizeKey(producer),
    genre: item.product?.beat_genre || item.beat?.genre || "",
    bpm: item.product?.beat_bpm || item.beat?.bpm || "",
    key: item.product?.beat_key || item.beat?.key || "",
  };
}
function previewUrlForItem(item) {
  const productPreview = beatPreviewRelativeFile(item?.product?.beat_preview_path);
  if (productPreview && item?.product?.beat_preview_status !== "error") {
    return new URL(`/api/beat-store/stream?file=${encodeURIComponent(productPreview)}`, CLOUD_ORIGIN).href;
  }

  const streamUrl = item?.beat?.stream_url;
  const streamFile = beatPreviewRelativeFile(item?.beat?.file || streamUrl);
  if (streamUrl && streamFile) return new URL(streamUrl, CLOUD_ORIGIN).href;
  return "";
}

function beatPreviewRelativeFile(value) {
  const clean = beatRelativeFile(value);
  if (!clean) return "";
  return clean.toLowerCase().startsWith("previews/") && /\.mp3$/i.test(clean) ? clean : "";
}

function beatRelativeFile(value) {
  let clean = String(value || "").trim();
  if (!clean) return "";
  if (clean.startsWith("http://") || clean.startsWith("https://")) {
    try {
      const url = new URL(clean);
      clean = url.searchParams.get("file") || url.pathname;
    } catch {
      return "";
    }
  }
  clean = clean
    .split("?")[0]
    .split("#")[0]
    .replaceAll("\\", "/")
    .replace(/\/+/g, "/")
    .replace(/^\/+/g, "");
  if (clean.toLowerCase().startsWith("beats_store/")) clean = clean.slice("beats_store/".length);
  if (!clean || clean.split("/").some((part) => !part || part === "." || part === "..")) return "";
  if (!/\.(mp3|wav|m4a|aac|ogg|flac|aif|aiff)$/i.test(clean)) return "";
  return clean;
}
function addBeatToCart(itemId) {
  const item = state.items.find((candidate) => candidate.id === itemId || candidate.product?.id === itemId);
  if (!item?.product || !productCanBePurchased(item.product)) return;
  const cart = getCart();
  const existing = cart.find((candidate) => candidate.id === item.product.id);
  if (existing) existing.quantity = Math.min(10, existing.quantity + 1);
  else cart.push({ id: item.product.id, quantity: 1 });
  saveCart(cart);
  showNotice("Beat agregado al carrito");
}

function setBeatCloudInputFile(input, file) {
  if (!input || !file) return;
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function setupBeatCloudPickers() {
  if (!state.isAdmin) return;
  [{ key: "beat-cover", input: beatCoverInput, label: "portada" }, { key: "beat-audio", input: beatUploadInput, label: "audio" }].forEach(({ key, input, label }) => {
    const button = document.querySelector(`[data-cloud-source="${key}"]`);
    if (!button || !input || button.dataset.cloudPickerReady === "true") return;
    button.dataset.cloudPickerReady = "true";
    createCloudSourcePicker({
      button,
      supabase,
      cloudFunctionBase: CLOUD_FUNCTION_BASE,
      allowFolders: false,
      title: `Seleccionar ${label} desde Cloud`,
      onSelect: ({ sourceFile, source }) => {
        if (!sourceFile) throw new Error("Beat Store solo permite archivos individuales.");
        setBeatCloudInputFile(input, sourceFile);
        if (label === "audio") handleBeatAudioSelection();
        if (label === "portada") handleBeatCoverSelection();
        showNotice(`${source.name} seleccionado desde Cloud`);
      },
    });
  });
}
function globalBeatPlayerItemForProduct(product) {
  return state.items.find((item) => item?.product?.id === product.id || item?.id === product.id) || null;
}

function renderGlobalBeatPlayerSetting() {
  if (!globalPlayerSelect || !globalPlayerStatus || !state.isAdmin) return;
  const candidates = state.adminProducts.filter((product) => {
    if (!product.is_active || product.beat_preview_status === "error") return false;
    return Boolean(previewUrlForItem(globalBeatPlayerItemForProduct(product)));
  });
  const options = candidates.map((product) => {
    const producer = producerDisplayName(product.producer);
    return '<option value="' + escapeHtml(product.id) + '">' + escapeHtml(product.name) + " · " + escapeHtml(producer) + "</option>";
  });
  globalPlayerSelect.innerHTML = ['<option value="">Sin beat seleccionado</option>', ...options].join("");
  globalPlayerSelect.value = candidates.some((product) => String(product.id) === state.globalPlayerBeatId)
    ? state.globalPlayerBeatId
    : "";
  const missingMigration = Boolean(state.globalPlayerSettingError);
  globalPlayerSelect.disabled = missingMigration;
  if (globalPlayerSaveButton) globalPlayerSaveButton.disabled = missingMigration;
  globalPlayerStatus.classList.toggle("is-error", missingMigration);
  if (missingMigration) {
    globalPlayerStatus.textContent = "Aplica la migración beat_store_global_player para activar esta configuración.";
  } else if (!candidates.length) {
    globalPlayerStatus.textContent = "No hay beats activos con preview MP3 listo.";
  } else if (globalPlayerSelect.value) {
    globalPlayerStatus.textContent = "Este beat se cargará para todos los visitantes.";
  } else {
    globalPlayerStatus.textContent = "Selecciona un beat activo con preview MP3 listo.";
  }
}

async function handleGlobalBeatPlayerSave() {
  if (!state.isAdmin || !globalPlayerSelect || !globalPlayerStatus) return;
  const beatId = String(globalPlayerSelect.value || "").trim();
  const product = state.adminProducts.find((candidate) => String(candidate.id) === beatId);
  const item = product ? globalBeatPlayerItemForProduct(product) : null;
  if (beatId && (!product || !product.is_active || !previewUrlForItem(item))) {
    globalPlayerStatus.textContent = "Selecciona un beat activo con preview MP3 listo.";
    globalPlayerStatus.classList.add("is-error");
    return;
  }

  if (globalPlayerSaveButton) globalPlayerSaveButton.disabled = true;
  globalPlayerStatus.classList.remove("is-error");
  globalPlayerStatus.textContent = "Guardando configuración...";
  const { data, error } = await supabase
    .from("beat_store_settings")
    .update({ global_player_beat_id: beatId || null })
    .eq("id", 1)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    globalPlayerStatus.textContent = error?.message || "No se pudo guardar la configuración.";
    globalPlayerStatus.classList.add("is-error");
    if (globalPlayerSaveButton) globalPlayerSaveButton.disabled = false;
    return;
  }

  state.globalPlayerBeatId = beatId;
  state.globalPlayerSettingError = null;
  renderGlobalBeatPlayerSetting();
  if (item) {
    const detail = beatPlayerDetailForItem(item);
    const queue = state.items
      .filter((candidate) => previewUrlForItem(candidate))
      .map(beatPlayerDetailForItem)
      .filter(Boolean);
    window.dispatchEvent(new CustomEvent("hr:beat-player-default", {
      detail: { ...detail, queue },
    }));
  }
  showNotice(beatId ? "Beat global actualizado para todos los visitantes." : "Beat global retirado.");
}
function initializeAdminPanel() {
  if (!state.isAdmin || !adminPanel) return;
  if (adminFormSlot && adminForm && adminForm.parentElement !== adminFormSlot) adminFormSlot.append(adminForm);
  setAdminMode(wantsAdminMode());
  setAdminTab(requestedAdminTab());
  if (adminStatus && !adminStatus.querySelector('[data-review-queue-link]')) {
    adminStatus.insertAdjacentHTML('beforeend', ' <a data-review-queue-link class="secondary-button hr-btn" href="review.html">Bandeja de revisión</a>');
  }
  resetAdminForm();
  setupBeatCloudPickers();
  resetBeatLicenseForm();
  renderAdminProducts();
  renderGlobalBeatPlayerSetting();
  renderBeatLicenseAdmin();
  renderBeatUploadPermissions();
  renderMercadoPagoConfig();
  renderBeatLicenseAssignmentFields();
}

function openRequestedAdminEdit() {
  const editId = new URLSearchParams(window.location.search).get("edit");
  if (!editId || !state.isAdmin) return;
  setAdminMode(true);
  setAdminTab("upload", true);
  requestAnimationFrame(() => editAdminProduct(editId));
}

function renderBeatLicenseAdmin() {
  if (!beatLicenseList || !beatLicenseStatus) return;
  beatLicenseStatus.textContent = state.hasBeatLicenses
    ? `${state.licenses.length} licencia${state.licenses.length === 1 ? "" : "s"} registrada${state.licenses.length === 1 ? "" : "s"}.`
    : "Aplica la migracion de licencias para activar esta seccion.";

  if (!state.hasBeatLicenses) {
    beatLicenseList.innerHTML = '<div class="empty-state beat-empty"><h2>Sin tabla de licencias</h2><p>La migracion beat_store_licenses aun no esta aplicada.</p></div>';
    return;
  }

  if (!state.licenses.length) {
    beatLicenseList.innerHTML = '<div class="empty-state beat-empty"><h2>Sin licencias</h2><p>Crea la primera licencia para asignarla a beats.</p></div>';
    return;
  }

  beatLicenseList.innerHTML = state.licenses.map((license) => {
    const assignedCount = state.assignments.filter((assignment) => assignment.license_id === license.id).length;
    return `
      <article class="admin-product-row beat-admin-row beat-license-row">
        <div>
          <span class="product-category">${escapeHtml(license.is_active ? "Activa" : "Inactiva")}</span>
          <h3>${escapeHtml(license.name)}</h3>
          <p>${escapeHtml(formatPrice(license.min_price))} - ${escapeHtml(formatPrice(license.max_price))} / ${escapeHtml(streamLimitLabel(license))}${license.format ? ` / ${escapeHtml(license.format)}` : ""}</p>
          <p class="beat-admin-row__music">${escapeHtml(license.description)}</p>
        </div>
        <div class="admin-actions">
          <button class="secondary-button" type="button" data-edit-license="${escapeHtml(license.id)}">Editar</button>
          <button class="secondary-button" type="button" data-toggle-license="${escapeHtml(license.id)}" data-active="${license.is_active}">${license.is_active ? "Desactivar" : "Activar"}</button>
          <button class="remove-button" type="button" data-delete-license="${escapeHtml(license.id)}" ${assignedCount ? "disabled" : ""}>Eliminar</button>
        </div>
      </article>`;
  }).join("");
}

function renderBeatUploadPermissions() {
  if (!beatUploadPermissionsList || !beatUploadPermissionsStatus) return;
  if (state.beatUploadPermissionsError) {
    beatUploadPermissionsStatus.textContent = "No se pudieron cargar los permisos.";
    beatUploadPermissionsList.innerHTML = `<div class="empty-state beat-empty"><p>${escapeHtml(state.beatUploadPermissionsError.message || "Error al cargar permisos.")}</p></div>`;
    return;
  }
  const granted = new Set(state.beatUploadPermissions.map((permission) => String(permission.user_id)));
  const users = state.beatUploadUsers;
  const searchTerm = String(beatUploadPermissionsSearch?.value || "").trim();
  beatUploadPermissionsStatus.textContent = searchTerm
    ? `${users.length} resultado${users.length === 1 ? "" : "s"}.`
    : `${users.length} usuario${users.length === 1 ? "" : "s"} autorizado${users.length === 1 ? "" : "s"}.`;
  if (!users.length) {
    beatUploadPermissionsList.innerHTML = '<div class="empty-state beat-empty"><p>No hay usuarios registrados.</p></div>';
    return;
  }
  beatUploadPermissionsList.innerHTML = users.map((user) => {
    const userId = String(user.id || "");
    const isAdmin = String(user.roles || "").split(",").map((role) => role.trim().toLowerCase()).includes("admin");
    const hasPermission = isAdmin || granted.has(userId);
    const label = user.display_name || user.username || user.email || "Usuario";
    const detail = [user.username ? `@${String(user.username).replace(/^@+/, "")}` : "", user.email || ""].filter(Boolean).join(" · ");
    return `<article class="admin-product-row beat-admin-row"><div><span class="product-category">${isAdmin ? "Admin · acceso automático" : hasPermission ? "Autorizado" : "Sin autorización"}</span><h3>${escapeHtml(label)}</h3><p>${escapeHtml(detail || userId)}</p></div><div class="admin-actions">${isAdmin ? '<span class="db-field__hint">Admin</span>' : `<button class="secondary-button" type="button" data-beat-upload-permission-toggle="${escapeHtml(userId)}" data-granted="${hasPermission}">${hasPermission ? "Revocar" : "Autorizar"}</button>`}</div></article>`;
  }).join("");
}

async function handleBeatUploadPermissionClick(event) {
  const button = event.target.closest("[data-beat-upload-permission-toggle]");
  if (!button || !state.isAdmin) return;
  const userId = button.dataset.beatUploadPermissionToggle;
  const targetUser = state.beatUploadUsers.find((user) => String(user.id) === userId);
  const granted = button.dataset.granted === "true";
  button.disabled = true;
  const result = granted
    ? await supabase.from("user_permissions").delete().eq("user_id", userId).eq("permission_key", "beats.upload")
    : await supabase.from("user_permissions").insert({ user_id: userId, permission_key: "beats.upload" });
  if (result.error) {
    showNotice(result.error.message || "No se pudo actualizar el permiso.", true);
    button.disabled = false;
    return;
  }
  if (granted) {
    showNotice("Permiso de subida revocado.");
  } else {
    const username = String(targetUser?.username || targetUser?.display_name || "productor").trim().replace(/^@+/, "") || "productor";
    const { error: invitationError } = await supabase.from("notifications").insert({
      user_id: userId,
      message: `Invitación a Beat Store para @${username}`,
      type: BEAT_STORE_INVITE_NOTIFICATION_TYPE,
      read: false,
    });
    showNotice(
      invitationError
        ? "Usuario autorizado, pero no se pudo enviar la invitación."
        : "Usuario autorizado y bienvenida enviada.",
      Boolean(invitationError),
    );
  }
  await refreshBeatUploadPermissions();
}

function handleBeatUploadPermissionsSearch() {
  window.clearTimeout(beatUploadPermissionsSearchTimer);
  beatUploadPermissionsSearchTimer = window.setTimeout(() => refreshBeatUploadPermissions(), 220);
}

async function refreshBeatUploadPermissions() {
  if (!state.isAdmin) return;
  const searchTerm = String(beatUploadPermissionsSearch?.value || "").trim();
  beatUploadPermissionsStatus.textContent = searchTerm ? "Buscando usuarios…" : "Cargando autorizados…";
  const beatUploadAccess = await fetchBeatUploadAccess(true, searchTerm);
  state.beatUploadUsers = beatUploadAccess.users;
  state.beatUploadPermissions = beatUploadAccess.permissions;
  state.beatUploadPermissionsError = beatUploadAccess.error;
  renderBeatUploadPermissions();
}

function renderMercadoPagoConfig() {
  if (!beatMercadoPagoStatus || !beatMercadoPagoError) return;
  if (state.mercadoPagoConfigError) {
    beatMercadoPagoStatus.textContent = "Migración pendiente o configuración no disponible.";
    beatMercadoPagoError.textContent = state.mercadoPagoConfigError.message || "No se pudo leer la configuración.";
    return;
  }
  beatMercadoPagoError.textContent = "";
  const config = state.mercadoPagoConfig || {};
  const ready = [config.public_key_configured, config.access_token_configured, config.webhook_secret_configured].filter(Boolean).length;
  beatMercadoPagoStatus.textContent = `${ready}/3 claves configuradas.`;
}

async function handleMercadoPagoConfigSubmit(event) {
  event.preventDefault();
  if (!state.isAdmin) return;
  beatMercadoPagoError.textContent = "";
  const publicKey = document.getElementById("beat-mp-public-key")?.value.trim() || null;
  const accessToken = document.getElementById("beat-mp-access-token")?.value.trim() || null;
  const webhookSecret = document.getElementById("beat-mp-webhook-secret")?.value.trim() || null;
  if (!publicKey && !accessToken && !webhookSecret) {
    beatMercadoPagoError.textContent = "Escribe al menos una clave nueva.";
    return;
  }
  const submitButton = beatMercadoPagoForm.querySelector("button[type=submit]");
  submitButton.disabled = true;
  beatMercadoPagoStatus.textContent = "Guardando de forma segura…";
  const { data, error } = await supabase.rpc("set_mp_config", {
    p_public_key: publicKey,
    p_access_token: accessToken,
    p_webhook_secret: webhookSecret,
  });
  submitButton.disabled = false;
  if (error) {
    beatMercadoPagoError.textContent = error.message || "No se pudo guardar la configuración.";
    renderMercadoPagoConfig();
    return;
  }
  beatMercadoPagoForm.reset();
  state.mercadoPagoConfig = data;
  state.mercadoPagoConfigError = null;
  renderMercadoPagoConfig();
  showNotice("Configuración de Mercado Pago guardada.");
}

function renderBeatLicenseAssignmentFields() {
  if (!beatLicenseAssignmentList) return;
  if (!state.hasBeatLicenses) {
    beatLicenseAssignmentList.innerHTML = '<p class="beat-license-empty">Aplica la migracion de licencias para asignarlas.</p>';
    return;
  }
  const activeLicenses = state.licenses.filter((license) => license.is_active);
  if (!activeLicenses.length) {
    beatLicenseAssignmentList.innerHTML = '<p class="beat-license-empty">No hay licencias activas para asignar.</p>';
    return;
  }
  const beatId = document.getElementById("beat-product-id")?.value || "";
  const availability = adminBeatDeliveryAvailability(beatId);
  beatLicenseAssignmentList.innerHTML = activeLicenses.map((license) => {
    const assignment = state.assignments.find((candidate) => candidate.beat_id === beatId && candidate.license_id === license.id);
    const missingAssets = beatLicenseMissingAssets(license, availability);
    const unavailable = missingAssets.length > 0;
    const checked = !unavailable && assignment?.is_enabled !== false && Boolean(assignment);
    const price = assignment?.price ?? license.min_price;
    const invalid = assignment && !priceWithinLicenseRange(price, license);
    return `
      <label class="beat-license-check ${invalid ? "is-invalid" : ""}${unavailable ? " beat-license-check--unavailable" : ""}" data-license-assignment="${escapeHtml(license.id)}">
        <span><input type="checkbox" data-beat-license-check="${escapeHtml(license.id)}" ${checked ? "checked" : ""} ${unavailable ? "disabled" : ""}> ${escapeHtml(license.name)}</span>
        <input class="hr-input" type="number" min="${Number(license.min_price)}" max="${Number(license.max_price)}" step="0.01" value="${escapeHtml(price)}" data-beat-license-price="${escapeHtml(license.id)}" ${checked && !unavailable ? "" : "disabled"}>
        <small>Precio permitido: ${escapeHtml(formatPrice(license.min_price))} - ${escapeHtml(formatPrice(license.max_price))} MXN${invalid ? " / Fuera del rango vigente" : ""}${unavailable ? ` / No disponible: falta ${escapeHtml(beatLicenseMissingAssetsLabel(missingAssets))}` : ""}</small>
      </label>`;
  }).join("");
}
function renderAdminProducts() {
  if (!adminList || !adminStatus) return;
  adminStatus.textContent = `${state.adminProducts.length} beat${state.adminProducts.length === 1 ? "" : "s"} en productos de tienda.`;

  if (!state.adminProducts.length) {
    adminList.innerHTML = '<div class="empty-state beat-empty"><h2>Sin productos beat</h2><p>Crea el primer beat desde el formulario.</p></div>';
    return;
  }

  adminList.innerHTML = state.adminProducts.map((product) => `
    <article class="admin-product-row beat-admin-row">
      <div>
        <div class="beat-admin-row__categories">
          <span class="product-category">${escapeHtml(product.is_active ? "Activo" : "Inactivo")}${product.featured ? " / Featured" : ""}</span>
          ${adminBeatAssetBadges(product)}
        </div>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${escapeHtml(product.slug)} / ${product.producer ? producerLinkMarkup({ product }, product.producer) : "Sin productor"} / stock ${escapeHtml(product.stock ?? "ilimitado")}</p>${adminProductMetaText(product) ? `<p class="beat-admin-row__music">${escapeHtml(adminProductMetaText(product))}</p>` : ""}
      </div>
      <div class="admin-actions">
        <button class="secondary-button" type="button" data-edit-beat="${escapeHtml(product.id)}">Editar</button>
        <button class="secondary-button" type="button" data-toggle-beat="${escapeHtml(product.id)}" data-active="${product.is_active}">${product.is_active ? "Desactivar" : "Activar"}</button>
        <button class="secondary-button" type="button" data-feature-beat="${escapeHtml(product.id)}" data-featured="${product.featured}">${product.featured ? "Quitar featured" : "Featured"}</button>
        <button class="remove-button" type="button" data-delete-beat="${escapeHtml(product.id)}">Eliminar</button>
      </div>
    </article>`).join("");
}

async function handleBeatLicenseSubmit(event) {
  event.preventDefault();
  if (!state.isAdmin || !state.hasBeatLicenses) return;
  beatLicenseError.textContent = "";

  const id = document.getElementById("beat-license-id").value;
  const unlimited = document.getElementById("beat-license-unlimited").checked;
  const payload = {
    name: document.getElementById("beat-license-name").value.trim(),
    min_price: Number(document.getElementById("beat-license-min-price").value),
    max_price: Number(document.getElementById("beat-license-max-price").value),
    description: document.getElementById("beat-license-description").value.trim(),
    terms: document.getElementById("beat-license-terms").value.trim() || null,
    stream_limit: unlimited ? null : nullableNumberFromInput("beat-license-stream-limit"),
    unlimited_streams: unlimited,
    format: document.getElementById("beat-license-format").value.trim() || null,
    is_active: document.getElementById("beat-license-active").checked,
  };

  const validation = validateBeatLicensePayload(payload);
  if (validation) {
    beatLicenseError.textContent = validation;
    return;
  }

  if (id && outOfRangeAssignmentCount(id, payload.min_price, payload.max_price) > 0) {
    const count = outOfRangeAssignmentCount(id, payload.min_price, payload.max_price);
    const confirmed = window.confirm(`${count} beat${count === 1 ? "" : "s"} quedarian fuera del nuevo rango. Puedes guardar, pero deberan corregirse despues.`);
    if (!confirmed) return;
  }

  const query = id
    ? supabase.from("beat_licenses").update(payload).eq("id", id)
    : supabase.from("beat_licenses").insert(payload);
  const { error } = await query;
  if (error) {
    beatLicenseError.textContent = error.message;
    return;
  }

  showNotice(id ? "Licencia actualizada" : "Licencia creada");
  resetBeatLicenseForm();
  await reloadBeatStore();
}

async function handleBeatLicenseListClick(event) {
  const editButton = event.target.closest("[data-edit-license]");
  const toggleButton = event.target.closest("[data-toggle-license]");
  const deleteButton = event.target.closest("[data-delete-license]");

  if (editButton) {
    editBeatLicense(editButton.dataset.editLicense);
    return;
  }
  if (toggleButton) {
    const { error } = await supabase
      .from("beat_licenses")
      .update({ is_active: toggleButton.dataset.active !== "true" })
      .eq("id", toggleButton.dataset.toggleLicense);
    if (error) beatLicenseStatus.textContent = error.message;
    else await reloadBeatStore();
    return;
  }
  if (deleteButton) {
    const assignedCount = state.assignments.filter((assignment) => assignment.license_id === deleteButton.dataset.deleteLicense).length;
    if (assignedCount) {
      showNotice("No se puede eliminar una licencia asignada");
      return;
    }
    const { error } = await supabase.rpc("delete_beat_license_if_unused", { p_license_id: deleteButton.dataset.deleteLicense });
    if (error) beatLicenseStatus.textContent = error.message;
    else {
      showNotice("Licencia eliminada");
      await reloadBeatStore();
    }
  }
}

function editBeatLicense(id) {
  const license = state.licenses.find((candidate) => candidate.id === id);
  if (!license) return;
  document.getElementById("beat-license-id").value = license.id;
  document.getElementById("beat-license-name").value = license.name;
  document.getElementById("beat-license-min-price").value = license.min_price;
  document.getElementById("beat-license-max-price").value = license.max_price;
  document.getElementById("beat-license-description").value = license.description;
  document.getElementById("beat-license-terms").value = license.terms ?? "";
  document.getElementById("beat-license-stream-limit").value = license.stream_limit ?? "";
  document.getElementById("beat-license-unlimited").checked = Boolean(license.unlimited_streams);
  document.getElementById("beat-license-format").value = license.format ?? "";
  document.getElementById("beat-license-active").checked = Boolean(license.is_active);
  document.getElementById("beat-license-form-title").textContent = "Editar licencia";
  beatLicenseCancel.hidden = false;
  updateBeatLicenseRangeWarning();
  beatLicenseForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetBeatLicenseForm() {
  if (!beatLicenseForm) return;
  beatLicenseForm.reset();
  document.getElementById("beat-license-id").value = "";
  document.getElementById("beat-license-active").checked = true;
  document.getElementById("beat-license-form-title").textContent = "Nueva licencia";
  beatLicenseCancel.hidden = true;
  beatLicenseError.textContent = "";
  beatLicenseWarning.textContent = "";
}

function syncBeatLicenseStreamLimitState() {
  const unlimited = document.getElementById("beat-license-unlimited");
  const streamLimit = document.getElementById("beat-license-stream-limit");
  if (!unlimited || !streamLimit) return;
  streamLimit.disabled = unlimited.checked;
  streamLimit.required = !unlimited.checked;
  if (unlimited.checked) streamLimit.value = "";
}
function updateBeatLicenseRangeWarning() {
  if (!beatLicenseWarning) return;
  const id = document.getElementById("beat-license-id")?.value;
  if (!id) {
    beatLicenseWarning.textContent = "";
    return;
  }
  const min = Number(document.getElementById("beat-license-min-price")?.value);
  const max = Number(document.getElementById("beat-license-max-price")?.value);
  const count = outOfRangeAssignmentCount(id, min, max);
  beatLicenseWarning.textContent = count > 0
    ? `${count} beat${count === 1 ? "" : "s"} quedarian fuera del nuevo rango.`
    : "";
}

function outOfRangeAssignmentCount(licenseId, min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
  return state.assignments.filter((assignment) => assignment.license_id === licenseId && (Number(assignment.price) < min || Number(assignment.price) > max)).length;
}

function validateBeatLicensePayload(payload) {
  if (!payload.name || !payload.description) return "Nombre y descripcion son obligatorios.";
  if (!Number.isFinite(payload.min_price) || payload.min_price < 0) return "El precio minimo no puede ser negativo.";
  if (!Number.isFinite(payload.max_price) || payload.max_price < payload.min_price) return "El precio maximo no puede ser menor que el minimo.";
  if (!payload.unlimited_streams && (!Number.isFinite(payload.stream_limit) || payload.stream_limit < 0)) return "Define un limite de streams o marca ilimitados.";
  return "";
}
async function handleAdminSubmit(event) {
  event.preventDefault();
  if (!state.isAdmin) return;
  adminError.textContent = "";
  setBeatSubmitLoading(true);

  let uploadedBeatAudio = null;
  let uploadedCoverUrl = "";
  let editingId = "";
  try {
    const id = document.getElementById("beat-product-id").value || adminForm.dataset.editingProductId || "";
    editingId = id;
    const slug = document.getElementById("beat-slug").value.trim().toLowerCase();
    await ensureBeatSlugAvailable(slug, id);
    const stockValue = document.getElementById("beat-stock").value;
    uploadedCoverUrl = await uploadSelectedBeatCoverFile();
    uploadedBeatAudio = await uploadSelectedBeatFile(id, slug);

    const payload = beatProductPayload({
      uploadedCoverUrl,
      uploadedBeatAudio,
      isActive: document.getElementById("beat-active").checked,
      stockValue,
    });

    if (!id && state.currentUserId && state.hasBeatLicenses) payload.producer_user_id = state.currentUserId;

    const result = id
      ? await supabase.from("store_products").update(payload).eq("id", id).select("id").single()
      : await supabase.from("store_products").insert(payload).select("id").single();

    if (result.error) throw new Error(result.error.message);

    const beatId = result.data?.id || id;
    await saveBeatLicenseAssignments(beatId);

    showNotice(id ? "Beat actualizado" : "Beat creado");
    resetAdminForm();
    setAdminTab("beats", true);
    await reloadBeatStore({ refreshBeats: Boolean(uploadedBeatAudio || uploadedCoverUrl) });
  } catch (error) {
    if (error.beatUploadResult) await saveBeatUploadError(editingId, error).catch(() => {});
    adminError.textContent = error.message || "No se pudo guardar el beat.";
    setUploadStatus(adminError.textContent, true);
  } finally {
    setBeatSubmitLoading(false);
  }
}

async function ensureBeatSlugAvailable(slug, currentId = "") {
  if (!slug) throw new Error("Define un slug para el beat.");
  const { data, error } = await supabase
    .from("store_products")
    .select("id, name, is_active")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message || "No se pudo validar el slug.");
  if (data?.id && data.id !== currentId) {
    const status = data.is_active === false ? "inactivo" : "activo";
    throw new Error(`El slug \"${slug}\" ya existe en el beat \"${data.name || "sin nombre"}\" (${status}). Edita ese beat o usa otro slug.`);
  }
}
function beatProductPayload({ uploadedCoverUrl = null, uploadedBeatAudio = null, isActive = true, stockValue = "" } = {}) {
  const payload = {
    name: document.getElementById("beat-name").value.trim(),
    slug: document.getElementById("beat-slug").value.trim().toLowerCase(),
    description: document.getElementById("beat-description").value.trim() || null,
    producer: producerStorageName(document.getElementById("beat-producer").value) || null,
    category: "beats",
    price: 0,
    currency: "MXN",
    image_url: uploadedCoverUrl?.image_url || uploadedCoverUrl || document.getElementById("beat-image-url")?.value.trim() || null,
    file_url: uploadedBeatAudio?.file_url || document.getElementById("beat-file-url").value.trim() || null,
    stock: stockValue === "" ? null : Number(stockValue),
    is_digital: document.getElementById("beat-digital").checked,
    featured: document.getElementById("beat-featured").checked,
    is_active: isActive,
  };
  if (uploadedCoverUrl?.beat_cover_path || uploadedCoverUrl?.image_url) payload.beat_cover_path = uploadedCoverUrl.beat_cover_path || uploadedCoverUrl.image_url;
  if (uploadedCoverUrl?.beat_thumb_path) payload.beat_thumb_path = uploadedCoverUrl.beat_thumb_path;
  if (state.hasBeatMetadata) {
    payload.beat_genre = formatGenreLabel(document.getElementById("beat-genre-input").value) || null;
    payload.beat_bpm = nullableNumberFromInput("beat-bpm");
    payload.beat_key = document.getElementById("beat-key").value.trim() || null;
    payload.beat_duration_seconds = nullableNumberFromInput("beat-duration");
    if (state.hasBeatAutodetectFlags) {
      payload.beat_bpm_autodetected = Boolean(payload.beat_bpm && document.getElementById("beat-bpm")?.dataset.autodetected === "true");
      payload.beat_key_autodetected = Boolean(payload.beat_key && document.getElementById("beat-key")?.dataset.autodetected === "true");
    }
  }
  if (state.hasBeatPreviews && uploadedBeatAudio) {
    payload.beat_original_path = uploadedBeatAudio.beat_original_path || null;
    payload.beat_preview_path = uploadedBeatAudio.beat_preview_path || null;
    payload.beat_preview_status = uploadedBeatAudio.beat_preview_status || "ready";
    payload.beat_preview_error = null;
  }
  return payload;
}

async function saveBeatUploadError(id, error) {
  if (!state.hasBeatPreviews) return;
  const result = error.beatUploadResult || {};
  const payload = beatProductPayload({
    uploadedBeatAudio: {
      file_url: result.original_file_url || null,
      beat_original_path: result.beat_original_path || null,
      beat_preview_path: null,
      beat_preview_status: "error",
    },
    isActive: false,
    stockValue: document.getElementById("beat-stock").value,
  });
  payload.beat_preview_status = "error";
  payload.beat_preview_error = "No se pudo generar el preview MP3.";
  if (!payload.name || !payload.slug || !payload.file_url) return;
  if (id) {
    await supabase.from("store_products").update(payload).eq("id", id);
    return;
  }
  const { data: existing } = await supabase
    .from("store_products")
    .select("id")
    .eq("slug", payload.slug)
    .maybeSingle();
  if (existing?.id) return;
  await supabase.from("store_products").insert(payload);
}
async function saveBeatLicenseAssignments(beatId) {
  if (!state.hasBeatLicenses || !beatLicenseAssignmentList || !beatId) return;
  const availability = adminBeatDeliveryAvailability(beatId);
  const selectedIds = new Set();
  for (const license of state.licenses.filter((candidate) => candidate.is_active)) {
    const checkbox = beatLicenseAssignmentList.querySelector(`[data-beat-license-check="${CSS.escape(license.id)}"]`);
    const priceInput = beatLicenseAssignmentList.querySelector(`[data-beat-license-price="${CSS.escape(license.id)}"]`);
    const existing = state.assignments.find((assignment) => assignment.beat_id === beatId && assignment.license_id === license.id);
    if (!checkbox?.checked) {
      if (existing) {
        const { error } = await supabase.from("beat_license_assignments").delete().eq("id", existing.id);
        if (error) throw new Error(error.message);
      }
      continue;
    }

    const missingAssets = beatLicenseMissingAssets(license, availability);
    if (missingAssets.length) {
      throw new Error(`${license.name}: falta el archivo protegido ${beatLicenseMissingAssetsLabel(missingAssets)}.`);
    }

    const price = Number(priceInput?.value);
    if (!priceWithinLicenseRange(price, license)) {
      throw new Error(`${license.name}: el precio debe estar entre ${formatPrice(license.min_price)} y ${formatPrice(license.max_price)} MXN.`);
    }
    selectedIds.add(license.id);
    const payload = { beat_id: beatId, license_id: license.id, price, is_enabled: true };
    const { error } = await supabase
      .from("beat_license_assignments")
      .upsert(payload, { onConflict: "beat_id,license_id" });
    if (error) throw new Error(error.message);
  }
}
async function handleBeatAutodetectClick(event) {
  const button = event.target.closest("[data-autodetect]");
  if (!button) return;
  const target = button.dataset.autodetect;
  if (target !== "bpm" && target !== "key") return;

  const file = beatUploadInput?.files?.[0];
  const existingAudioPath = currentEditingBeatAudioPath();
  if (!file && !existingAudioPath) {
    setUploadStatus("Selecciona un archivo de audio o edita un beat que ya tenga audio en Cloud.", true);
    return;
  }
  if (file && !file.type.startsWith("audio/") && !/\.(mp3|wav|m4a|aac|ogg|flac|aif|aiff)$/i.test(file.name)) {
    setUploadStatus("Selecciona un archivo de audio valido para autodetectar.", true);
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    setUploadStatus("Sesión requerida para autodetectar audio.", true);
    return;
  }

  setBeatAutodetectLoading(button, true);
  setUploadStatus(`Autodetectando ${target === "bpm" ? "BPM" : "tonalidad"}...`);
  try {
    const request = beatAudioAnalysisRequest({ file, existingAudioPath, target, token: session.access_token });
    const response = await safeFetch(ANALYZE_BEAT_AUDIO_ENDPOINT, request, { retries: 1, retryDelayMs: 900, label: "autodetectar audio" });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "No se pudo autodetectar el audio.");

    applyBeatAudioAnalysis(result, target);
    setUploadStatus(beatAudioAnalysisMessage(result, target));
  } catch (error) {
    setUploadStatus(error.message || "No se pudo autodetectar el audio.", true);
  } finally {
    setBeatAutodetectLoading(button, false);
  }
}

function applyBeatAudioAnalysis(result, target = "all") {
  if ((target === "bpm" || target === "all") && Number.isFinite(Number(result.bpm))) {
    const input = document.getElementById("beat-bpm");
    input.value = String(Math.round(Number(result.bpm)));
    input.dataset.autodetected = "true";
    syncBeatAdBadge("bpm");
  }
  if ((target === "key" || target === "all") && result.key) {
    const input = document.getElementById("beat-key");
    input.value = String(result.key);
    input.dataset.autodetected = "true";
    syncBeatAdBadge("key");
  }
}

function beatAudioAnalysisMessage(result, target) {
  if (target === "bpm" && result.bpm) return `BPM detectado: ${Math.round(Number(result.bpm))}.`;
  if (target === "key" && result.key) return `Tonalidad detectada: ${result.key}.`;
  return "Análisis de audio completado.";
}

function setBeatAutodetectLoading(button, isLoading) {
  if (!button) return;
  button.disabled = Boolean(isLoading);
  button.classList.toggle("is-loading", Boolean(isLoading));
  button.textContent = isLoading ? "Detectando..." : "Autodetectar";
}

function handleManualBeatMetadataInput(event) {
  if (!event?.isTrusted || !event.target) return;
  event.target.dataset.autodetected = "false";
  syncBeatAdBadge(event.target.id === "beat-bpm" ? "bpm" : "key");
}

function syncBeatAdBadge(target) {
  const input = document.getElementById(target === "bpm" ? "beat-bpm" : "beat-key");
  const badge = document.querySelector(`[data-ad-badge="${target}"]`);
  if (!input || !badge) return;
  badge.hidden = input.dataset.autodetected !== "true" || !input.value;
}

function currentEditingBeatAudioPath() {
  const id = document.getElementById("beat-product-id")?.value || "";
  if (!id) return "";
  const product = state.adminProducts.find((candidate) => candidate.id === id);
  return product?.beat_original_path || product?.file_url || document.getElementById("beat-file-url")?.value.trim() || "";
}

function beatAudioAnalysisRequest({ file, existingAudioPath, target, token }) {
  const headers = {
    Authorization: `Bearer ${token}`,
    apikey: SUPABASE_ANON_KEY,
    "X-Analyze-Target": target,
  };
  if (file) {
    return {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": file.type || "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name),
      },
      body: file,
    };
  }
  return {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ audio_path: existingAudioPath }),
  };
}


function handleBeatAudioSelection() {
  const file = beatUploadInput?.files?.[0];
  const durationInput = document.getElementById("beat-duration");
  renderBeatLicenseAssignmentFields();
  if (!file || !durationInput) return;
  if (!file.type.startsWith("audio/") && !/\.(mp3|wav|m4a|aac|ogg|flac|aif|aiff)$/i.test(file.name)) return;
  detectAudioDuration(file)
    .then((seconds) => {
      durationInput.value = String(seconds);
      setUploadStatus(`Duración detectada: ${formatDuration(seconds)}.`);
    })
    .catch(() => {
      setUploadStatus("No se pudo detectar la duracion automaticamente.", true);
    });
}

function detectAudioDuration(file) {
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(objectUrl);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      cleanup();
      const seconds = Math.round(audio.duration || 0);
      if (Number.isFinite(seconds) && seconds > 0) resolve(seconds);
      else reject(new Error("Duración inválida"));
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error("No se pudo leer el audio"));
    };
    audio.src = objectUrl;
  });
}

function setBeatSubmitLoading(isLoading) {
  if (!beatSubmitButton) return;
  beatSubmitButton.disabled = Boolean(isLoading);
  beatSubmitButton.classList.toggle("is-loading", Boolean(isLoading));
  beatSubmitButton.textContent = isLoading ? "Subiendo..." : "Guardar beat";
}
function handleBeatCoverSelection() {
  const file = beatCoverInput?.files?.[0];
  if (beatCoverObjectUrl) URL.revokeObjectURL(beatCoverObjectUrl);
  beatCoverObjectUrl = "";
  if (!file || !beatCoverEditor || !beatCoverPreview) {
    if (beatCoverEditor) beatCoverEditor.hidden = true;
    return;
  }
  beatCoverObjectUrl = URL.createObjectURL(file);
  beatCoverPreview.src = beatCoverObjectUrl;
  beatCoverPreview.onload = updateBeatCoverPreview;
  beatCoverEditor.hidden = false;
  resetBeatCoverCrop();
}

function beatCoverImageRatio() {
  const width = beatCoverPreview?.naturalWidth || 1;
  const height = beatCoverPreview?.naturalHeight || 1;
  return width / height;
}

function beatCoverAxisCanMove() {
  const ratio = beatCoverImageRatio();
  const zoom = beatCoverCropState.zoom;
  return {
    x: Math.max(ratio, 1) * zoom > 1.001,
    y: Math.max(1 / ratio, 1) * zoom > 1.001,
  };
}

function clampBeatCoverCrop() {
  beatCoverCropState.zoom = Math.max(1, Math.min(3, beatCoverCropState.zoom));
  const movable = beatCoverAxisCanMove();
  beatCoverCropState.x = movable.x ? Math.max(0, Math.min(1, beatCoverCropState.x)) : 0.5;
  beatCoverCropState.y = movable.y ? Math.max(0, Math.min(1, beatCoverCropState.y)) : 0.5;
}

function resetBeatCoverCrop() {
  beatCoverCropState.x = 0.5;
  beatCoverCropState.y = 0.5;
  beatCoverCropState.zoom = 1;
  updateBeatCoverPreview();
}

function currentBeatCoverCrop() {
  clampBeatCoverCrop();
  return {
    x: beatCoverCropState.x,
    y: beatCoverCropState.y,
    size: 1 / beatCoverCropState.zoom,
  };
}

function updateBeatCoverPreview() {
  if (!beatCoverPreview) return;
  clampBeatCoverCrop();
  const { x, y, zoom } = beatCoverCropState;
  const extraPan = zoom > 1 ? ((zoom - 1) / zoom) * 50 : 0;
  const translateX = (0.5 - x) * extraPan;
  const translateY = (0.5 - y) * extraPan;
  beatCoverPreview.style.objectPosition = `${x * 100}% ${y * 100}%`;
  beatCoverPreview.style.transform = `translate(${translateX}%, ${translateY}%) scale(${zoom})`;
}
function beatCoverPointerSnapshot(event) {
  return { x: event.clientX, y: event.clientY };
}

function beatCoverPointerDistance() {
  const points = Array.from(beatCoverPointers.values());
  if (points.length < 2) return 0;
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function handleBeatCoverPointerDown(event) {
  if (!beatCoverPreview?.src || !beatCoverStage) return;
  beatCoverStage.setPointerCapture?.(event.pointerId);
  beatCoverStage.classList.add("is-dragging");
  beatCoverPointers.set(event.pointerId, beatCoverPointerSnapshot(event));
  if (beatCoverPointers.size === 2) {
    beatCoverPinchStart = { distance: beatCoverPointerDistance(), zoom: beatCoverCropState.zoom };
    beatCoverDragStart = null;
    return;
  }
  beatCoverDragStart = {
    x: event.clientX,
    y: event.clientY,
    cropX: beatCoverCropState.x,
    cropY: beatCoverCropState.y,
  };
}

function handleBeatCoverPointerMove(event) {
  if (!beatCoverPointers.has(event.pointerId) || !beatCoverStage) return;
  beatCoverPointers.set(event.pointerId, beatCoverPointerSnapshot(event));
  if (beatCoverPointers.size >= 2 && beatCoverPinchStart?.distance) {
    const distance = beatCoverPointerDistance();
    beatCoverCropState.zoom = beatCoverPinchStart.zoom * (distance / beatCoverPinchStart.distance);
    updateBeatCoverPreview();
    return;
  }
  if (!beatCoverDragStart) return;
  const rect = beatCoverStage.getBoundingClientRect();
  const movable = beatCoverAxisCanMove();
  const dragRangeX = movable.x ? Math.max(0.25, beatCoverCropState.zoom - 0.5) : Number.POSITIVE_INFINITY;
  const dragRangeY = movable.y ? Math.max(0.25, beatCoverCropState.zoom - 0.5) : Number.POSITIVE_INFINITY;
  beatCoverCropState.x = beatCoverDragStart.cropX - ((event.clientX - beatCoverDragStart.x) / rect.width / dragRangeX);
  beatCoverCropState.y = beatCoverDragStart.cropY - ((event.clientY - beatCoverDragStart.y) / rect.height / dragRangeY);
  updateBeatCoverPreview();
}

function handleBeatCoverPointerEnd(event) {
  beatCoverPointers.delete(event.pointerId);
  beatCoverStage?.releasePointerCapture?.(event.pointerId);
  if (beatCoverPointers.size < 2) beatCoverPinchStart = null;
  if (beatCoverPointers.size === 0) {
    beatCoverDragStart = null;
    beatCoverStage?.classList.remove("is-dragging");
  }
}

function handleBeatCoverWheel(event) {
  if (!beatCoverPreview?.src) return;
  event.preventDefault();
  const delta = event.deltaY < 0 ? 0.08 : -0.08;
  beatCoverCropState.zoom += delta;
  updateBeatCoverPreview();
}
async function uploadSelectedBeatCoverFile() {
  const file = beatCoverInput?.files?.[0];
  if (!file) return "";
  if (!file.type.startsWith("image/") && !/\.(jpg|jpeg|png|webp)$/i.test(file.name)) {
    throw new Error("Selecciona una imagen válida para la portada.");
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sesión requerida para subir portadas.");

  setUploadStatus(`Procesando portada ${file.name}...`);
  const productId = document.getElementById("beat-product-id")?.value || "";
  const response = await safeFetch(`${CLOUD_ORIGIN}/api/beat-store/cover`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": file.type || "application/octet-stream",
      "X-Beat-Crop": JSON.stringify(currentBeatCoverCrop()),
      ...(productId ? { "X-Beat-Product-Id": productId } : {}),
    },
    body: file,
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "No se pudo procesar la imagen");

  setUploadStatus(`Portada procesada: ${file.name}`);
  return result;
}
async function uploadSelectedBeatFile(productId = "", beatSlug = "") {
  const file = beatUploadInput?.files?.[0];
  if (!file) return null;
  if (!file.type.startsWith("audio/") && !/\.(mp3|wav|m4a|aac|ogg|flac|aif|aiff)$/i.test(file.name)) {
    throw new Error("Selecciona un archivo de audio valido.");
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Sesión requerida para subir archivos.");

  setUploadStatus(`Subiendo ${file.name} y generando preview MP3...`);
  const response = await safeFetch(`${CLOUD_ORIGIN}/api/beat-store/upload-audio`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "X-File-Name": encodeURIComponent(file.name),
      "Content-Type": file.type || "application/octet-stream",
      ...(productId ? { "X-Beat-Product-Id": productId } : {}),
      ...(beatSlug ? { "X-Beat-Slug": beatSlug } : {}),
    },
    body: file,
  }, { retries: 1, retryDelayMs: 900, label: "subir audio" });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || "No se pudo generar el preview MP3. El original se conservo, pero el beat no se publico.");
    error.beatUploadResult = result;
    throw error;
  }

  setUploadStatus(`Preview MP3 listo: ${file.name}`);
  return result;
}

async function safeFetch(url, options = {}, retryOptions = {}) {
  const retries = Number(retryOptions.retries || 0);
  const retryDelayMs = Number(retryOptions.retryDelayMs || 700);
  const label = retryOptions.label || "conectar con el servidor";
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < retries) await wait(retryDelayMs);
    }
  }

  throw new Error(networkErrorMessage(lastError, label));
}

function networkErrorMessage(error, label) {
  const message = String(error?.message || error || "");
  if (/failed to fetch|load failed|networkerror|typeerror/i.test(message)) {
    return `No se pudo ${label}. Revisa tu conexión, sesión o intenta de nuevo.`;
  }
  return message || `No se pudo ${label}.`;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
function setUploadStatus(message, isError = false) {
  if (!beatUploadStatus) return;
  beatUploadStatus.textContent = message || "";
  beatUploadStatus.classList.toggle("is-error", Boolean(isError));
}

async function handleAdminListClick(event) {
  const editButton = event.target.closest("[data-edit-beat]");
  const toggleButton = event.target.closest("[data-toggle-beat]");
  const featuredButton = event.target.closest("[data-feature-beat]");
  const deleteButton = event.target.closest("[data-delete-beat]");
  const producerProfileButton = event.target.closest("[data-producer-profile-beat]");

  if (editButton) {
    editAdminProduct(editButton.dataset.editBeat);
    return;
  }
  if (toggleButton) {
    await updateAdminProduct(toggleButton.dataset.toggleBeat, { is_active: toggleButton.dataset.active !== "true" });
    return;
  }
  if (featuredButton) {
    await updateAdminProduct(featuredButton.dataset.featureBeat, { featured: featuredButton.dataset.featured !== "true" });
    return;
  }
  if (producerProfileButton) {
    await createOrOpenProducerProfile(producerProfileButton.dataset.producerProfileBeat);
    return;
  }
  if (deleteButton && window.confirm("¿Eliminar este beat de productos? Dejará de existir para clientes, pero no se borra el archivo de Cloud.")) {
    const { error } = await supabase.from("store_products").delete().eq("id", deleteButton.dataset.deleteBeat);
    if (error) adminStatus.textContent = error.message;
    else {
      showNotice("Beat eliminado");
      await reloadBeatStore();
    }
  }
}

async function updateAdminProduct(id, patch) {
  const { error } = await supabase.from("store_products").update(patch).eq("id", id);
  if (error) adminStatus.textContent = error.message;
  else await reloadBeatStore();
}

function editAdminProduct(id) {
  const product = state.adminProducts.find((candidate) => candidate.id === id);
  if (!product) return;

  setAdminTab("upload", true);
  const productId = String(product.id);
  const productIdInput = document.getElementById("beat-product-id");
  productIdInput.value = productId;
  productIdInput.setAttribute("value", productId);
  adminForm.dataset.editingProductId = productId;
  document.getElementById("beat-name").value = product.name;
  document.getElementById("beat-slug").value = product.slug;
  document.getElementById("beat-description").value = product.description ?? "";
  document.getElementById("beat-producer").value = product.producer ?? "";
  document.getElementById("beat-genre-input").value = product.beat_genre ?? "";
  const bpmInput = document.getElementById("beat-bpm");
  const keyInput = document.getElementById("beat-key");
  bpmInput.value = product.beat_bpm ?? "";
  bpmInput.dataset.autodetected = product.beat_bpm_autodetected ? "true" : "false";
  keyInput.value = product.beat_key ?? "";
  keyInput.dataset.autodetected = product.beat_key_autodetected ? "true" : "false";
  document.getElementById("beat-duration").value = product.beat_duration_seconds ?? "";
  document.getElementById("beat-image-url").value = product.image_url ?? "";
  if (beatCoverEditor) beatCoverEditor.hidden = true;
  document.getElementById("beat-file-url").value = product.file_url ?? "";
  document.getElementById("beat-stock").value = product.stock ?? "";
  document.getElementById("beat-featured").checked = Boolean(product.featured);
  document.getElementById("beat-active").checked = Boolean(product.is_active);
  document.getElementById("beat-digital").checked = Boolean(product.is_digital);
  document.getElementById("beat-form-title").textContent = "Editar beat";
  cancelEditButton.hidden = false;
  renderBeatLicenseAssignmentFields();
  syncProducerProfileButton(product);
  adminForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetAdminForm() {
  if (!adminForm) return;
  adminForm.reset();
  if (beatCoverEditor) beatCoverEditor.hidden = true;
  if (beatCoverObjectUrl) URL.revokeObjectURL(beatCoverObjectUrl);
  beatCoverObjectUrl = "";
  document.getElementById("beat-product-id").value = "";
  document.getElementById("beat-product-id").removeAttribute("value");
  delete adminForm.dataset.editingProductId;
  document.getElementById("beat-active").checked = true;
  document.getElementById("beat-digital").checked = true;
  document.getElementById("beat-form-title").textContent = "Nuevo beat";
  document.getElementById("beat-bpm").dataset.autodetected = "false";
  document.getElementById("beat-key").dataset.autodetected = "false";
  cancelEditButton.hidden = true;
  adminError.textContent = "";
  renderBeatLicenseAssignmentFields();
  syncProducerProfileButton(null);
}

async function reloadBeatStore(options = {}) {
  if (options.refreshBeats) state.beats = await fetchCloudBeats();
  const products = await fetchBeatProducts(state.isAdmin);
  state.products = products;
  state.adminProducts = state.isAdmin ? products : [];
  const globalPlayerSetting = await fetchGlobalBeatPlayerSetting();
  state.globalPlayerBeatId = globalPlayerSetting.id;
  state.globalPlayerSettingError = globalPlayerSetting.error;
  state.licenses = await fetchBeatLicenses(state.isAdmin);
  state.producerProfiles = await fetchProducerProfiles(state.isAdmin);
  state.assignments = await fetchBeatLicenseAssignments(products.map((product) => product.id), true);
  const beatUploadAccess = await fetchBeatUploadAccess(state.isAdmin);
  state.beatUploadUsers = beatUploadAccess.users;
  state.beatUploadPermissions = beatUploadAccess.permissions;
  state.beatUploadPermissionsError = beatUploadAccess.error;
  const mercadoPagoConfig = await fetchMercadoPagoConfig(state.isAdmin);
  state.mercadoPagoConfig = mercadoPagoConfig.data;
  state.mercadoPagoConfigError = mercadoPagoConfig.error;
  state.items = mergeProductsAndBeats(products, state.beats);
  buildBeatSearchIndex();
  renderGenreOptions();
  renderBeats();
  renderAdminProducts();
  renderGlobalBeatPlayerSetting();
  renderBeatLicenseAdmin();
  renderBeatUploadPermissions();
  renderMercadoPagoConfig();
  renderBeatLicenseAssignmentFields();
  syncProducerProfileButton();
}

function getCart() {
  try {
    const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored
      .map((item) => ({ id: String(item?.id || ""), quantity: Math.max(1, Math.min(10, Number.parseInt(item?.quantity, 10) || 1)) }))
      .filter((item) => item.id);
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  updateCartCount();
}

function updateCartCount() {
  const count = getCart().reduce((total, item) => total + item.quantity, 0);
  document.querySelectorAll(".cart-count").forEach((element) => {
    element.textContent = String(count);
  });
}

function cloudFileName(value) {
  const clean = String(value || "").split("?")[0].split("#")[0];
  try {
    return decodeURIComponent(clean.split("/").filter(Boolean).pop() || clean);
  } catch {
    return clean.split("/").filter(Boolean).pop() || clean;
  }
}

function itemTitle(item) {
  return item.product?.name || item.beat?.title || "Beat";
}

function beatDisplayTitle(item) {
  let title = itemTitle(item)
    .replace(/\s*@[^\s]+(?=\s|$)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) return "Beat";
  if (!/[a-záéíóúüñ]/.test(title)) title = title.toLocaleLowerCase("es-MX");
  return title.replace(/(^|[\s-])([a-záéíóúüñ])/gi, (_, prefix, letter) => `${prefix}${letter.toLocaleUpperCase("es-MX")}`);
}

function syncProducerUsernameButton() {
  if (!beatProducerUsernameButton) return;
  beatProducerUsernameButton.hidden = !state.currentUsername;
  beatProducerUsernameButton.textContent = state.currentUsername ? `Usar @${state.currentUsername}` : "Usar mi username";
  beatProducerUsernameButton.title = state.currentUsername ? `Usar @${state.currentUsername} como productor` : "No hay username disponible en tu usuario.";
}

function useCurrentUsernameAsProducer() {
  const input = document.getElementById("beat-producer");
  if (!input || !state.currentUsername) return;
  input.value = producerStorageName(state.currentUsername);
  input.focus();
}
function currentEditingProduct() {
  const productId = document.getElementById("beat-product-id")?.value || "";
  return state.adminProducts.find((candidate) => candidate.id === productId) || null;
}

function syncProducerProfileButton(product = currentEditingProduct()) {
  syncProducerUsernameButton();
  if (!beatProducerProfileButton) return;
  beatProducerProfileButton.hidden = !state.isAdmin;
  const profile = producerProfileForProduct(product);
  beatProducerProfileButton.textContent = profile ? "Ver perfil" : "Crear perfil";
  beatProducerProfileButton.disabled = !product;
  beatProducerProfileButton.title = product
    ? (profile ? "Abrir catálogo del productor" : "Crear catálogo del productor")
    : "Guarda el beat primero para crear el perfil.";
}

async function createOrOpenCurrentProducerProfile() {
  const product = currentEditingProduct();
  if (!product) {
    if (adminStatus) adminStatus.textContent = "Guarda el beat primero para crear y vincular el perfil del productor.";
    syncProducerProfileButton(null);
    return;
  }
  await createOrOpenProducerProfile(product.id);
}
function producerProfileForProduct(product = {}) {
  if (!product) return null;
  return state.producerProfiles.find((profile) => profile.id === product.producer_profile_id)
    || state.producerProfiles.find((profile) => profile.slug === normalizeKey(product.producer || ""))
    || null;
}

function producerLinkMarkup(item, fallbackName = "") {
  const product = item?.product || {};
  const profile = producerProfileForProduct(product);
  const name = producerDisplayName(profile?.display_name || fallbackName || "Productor por confirmar");
  const slug = profile?.slug || normalizeKey(fallbackName);
  if (!slug || profile?.is_active === false || name === "Productor por confirmar") return escapeHtml(name);
  return "<a href=\"producer.html?producer=" + encodeURIComponent(slug) + "\">" + escapeHtml(name) + "</a>";
}

async function createOrOpenProducerProfile(productId) {
  const product = state.adminProducts.find((candidate) => candidate.id === productId);
  if (!product) return;
  const existing = producerProfileForProduct(product);
  if (existing?.slug) {
    await linkMatchingProducerProducts(existing.id, product);
    window.open(`producer.html?producer=${encodeURIComponent(existing.slug)}`, "_blank", "noopener");
    return;
  }
  const displayName = producerStorageName(product.producer || product.name || "Productor");
  const slug = uniqueProducerSlug(displayName);
  const payload = {
    slug,
    display_name: displayName,
    user_id: product.producer_user_id || state.currentUserId || null,
    is_active: true,
  };
  const { data, error } = await supabase.from("producer_profiles").insert(payload).select("id, slug, display_name, is_active").single();
  if (error) {
    adminStatus.textContent = error.message;
    return;
  }
  const linkedBeatIds = await linkMatchingProducerProducts(data.id, product);
  showNotice(`Perfil de productor creado y vinculado a ${linkedBeatIds.length} beat${linkedBeatIds.length === 1 ? "" : "s"}`);
  window.open(`producer.html?producer=${encodeURIComponent(data.slug)}`, "_blank", "noopener");
}

async function linkMatchingProducerProducts(profileId, product = {}) {
  const linkedBeatIds = matchingProducerProductIds(product);
  const { error } = await supabase.from("store_products").update({ producer_profile_id: profileId }).in("id", linkedBeatIds);
  if (error) {
    if (adminStatus) adminStatus.textContent = error.message;
    throw new Error(error.message);
  }
  await reloadBeatStore();
  return linkedBeatIds;
}

function matchingProducerProductIds(product = {}) {
  const producerKey = normalizeKey(product.producer || "");
  const matches = state.adminProducts
    .filter((candidate) => candidate?.category === "beats")
    .filter((candidate) => normalizeKey(candidate.producer || "") === producerKey)
    .map((candidate) => candidate.id)
    .filter(Boolean);
  if (!matches.includes(product.id)) matches.push(product.id);
  return [...new Set(matches)];
}
function producerStorageName(value) {
  return String(value || "").trim().replace(/^@+/, "");
}

function producerDisplayName(value) {
  const clean = producerStorageName(value);
  if (!clean || ["Productor por confirmar", "Productor", "Sin productor", "Tu cuenta"].includes(clean)) return clean || "Productor por confirmar";
  return `@${clean}`;
}
function uniqueProducerSlug(name) {
  const base = normalizeKey(name) || "productor";
  const used = new Set(state.producerProfiles.map((profile) => profile.slug));
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}
function productProducer(item) {
  return item.product?.producer || item.beat?.producer || "";
}

function beatGenre(item) {
  return item?.product?.beat_genre || item?.beat?.genre || item?.product?.category || "";
}

function itemMusicMeta(item) {
  const product = item?.product || {};
  const beat = item?.beat || {};
  const bpm = product.beat_bpm || beat.bpm;
  const key = product.beat_key || beat.key;
  const genre = formatGenreLabel(product.beat_genre || beat.genre);
  const duration = product.beat_duration_seconds || beat.duration_seconds || beat.duration;
  const bpmText = bpm ? `${bpm}${product.beat_bpm_autodetected ? " (AD)" : ""}` : "";
  const keyText = key ? `${key}${product.beat_key_autodetected ? " (AD)" : ""}` : "";
  return [
    genre ? { label: "Género", value: genre } : null,
    bpmText ? { label: "BPM", value: bpmText } : null,
    keyText ? { label: "Tonalidad", value: keyText } : null,
    duration ? { label: "Duración", value: formatDuration(duration) } : null,
  ].filter(Boolean);
}

function formatDuration(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return String(value || "");
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function nullableNumberFromInput(id) {
  const value = document.getElementById(id)?.value;
  return value === "" ? null : Number(value);
}

function productCanBePurchased(product) {
  if (product.is_active === false) return false;
  return product.stock === null || Number(product.stock) > 0;
}

function categoryLabel(category) {
  return { beats: "Beats", merch: "Merch", digital: "Digital", eventos: "Eventos" }[category] || category;
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function streamLimitLabel(license) {
  if (!license) return "Por confirmar";
  if (license.unlimited_streams) return "Ilimitados";
  const limit = Number(license.stream_limit);
  if (!Number.isFinite(limit)) return "Por confirmar";
  return `${new Intl.NumberFormat("es-MX").format(limit)} streams`;
}

function priceWithinLicenseRange(price, license) {
  const value = Number(price);
  return Number.isFinite(value) && value >= Number(license.min_price) && value <= Number(license.max_price);
}
function formatPrice(amount, currency = "MXN") {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: currency || "MXN" }).format(Number(amount));
}

function errorState(message) {
  return `<div class="empty-state hr-empty-state beat-empty"><h2>No pudimos cargar Beat Store</h2><p>${escapeHtml(message)}</p></div>`;
}

function showNotice(message, isError = false) {
  const notice = document.getElementById("store-notice");
  if (!notice) return;
  elevateStoreNotice(notice);
  notice.className = `notice hr-toast ${isError ? "hr-toast--error" : "hr-toast--success"} visible hr-toast--visible`;
  notice.innerHTML = '<span class="hr-toast__dot" aria-hidden="true"></span><span class="hr-toast__message"></span>';
  notice.querySelector(".hr-toast__message").textContent = message;
  window.clearTimeout(showNotice.timeout);
  showNotice.timeout = window.setTimeout(() => {
    notice.classList.remove("visible", "hr-toast--visible");
  }, 2200);
}

function elevateStoreNotice(notice) {
  document.body.append(notice);
  Object.assign(notice.style, {
    position: "fixed",
    right: "max(16px, env(safe-area-inset-right))",
    bottom: "calc(var(--hr-beat-player-offset, 0px) + max(16px, env(safe-area-inset-bottom)))",
    zIndex: "2147483647",
    display: "grid",
    pointerEvents: "auto",
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
