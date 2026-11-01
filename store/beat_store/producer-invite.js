import { createLegalService } from '../../assets/js/legal-service.js?v=20261031-global-legal-gate-v7';

const BEAT_STORE_INVITE_TYPE = "beat-store-invite";
const BEAT_UPLOAD_PERMISSION_KEY = "beats.upload";
const BEAT_UPLOAD_PLAN_LABELS = {
  socio_embajador: "Socio Embajador",
  pago: "Pago",
};
const supabase = await window.HiddenRoomSupabase.getClient();
const legalService = createLegalService(supabase);
const lifecycle = new AbortController();
const inviteQueue = { notifications: [], index: 0, username: '', access: null };
let activeInviteFinish = null;
let activeInviteQueueIndex = null;

window.HiddenRoomApp?.register(() => {
  lifecycle.abort();
  closeInviteModal();
});

initProducerInvite().catch((error) => {
  console.error("[HR] No se pudo cargar la invitación de Beat Store:", error);
});

async function initProducerInvite() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  if (document.body.classList.contains("db-body")) {
    await waitForPortalOnboardingReady();
  }

  const { data: profile } = await supabase
    .from("users")
    .select("user_id,display_name,username,email,whatsapp,ig_username,roles")
    .eq("id", session.user.id)
    .maybeSingle();

  if (isAdmin(profile?.roles)) return;

  await window.HiddenRoomGlobalLegal?.ensure?.(supabase);
  if (!document.body.classList.contains("db-body")) {
    await window.HiddenRoomProfilePrompts?.schedule?.(profile, session.user, supabase);
  }

  const notificationUserIds = [...new Set([session.user.id, profile?.user_id].filter(Boolean).map(String))];
  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("id,created_at")
    .in("user_id", notificationUserIds)
    .eq("type", BEAT_STORE_INVITE_TYPE)
    .eq("read", false)
    .order("created_at", { ascending: true })
    .limit(20);

  if (error || !notifications?.length) return;
  inviteQueue.notifications = notifications;
  inviteQueue.username = profile?.username || '';
  inviteQueue.access = await resolveBeatUploadAccess(session.user.id);
  showNextInviteModal();
}

async function resolveBeatUploadAccess(userId) {
  const { data, error } = await supabase
    .from("user_permissions")
    .select("permission_key")
    .eq("user_id", userId)
    .like("permission_key", `${BEAT_UPLOAD_PERMISSION_KEY}.%`);
  if (error) {
    console.info("[HR] No fue posible resolver el plan de Beat Store:", error.message);
    return { plan: "Plan pendiente", limit: "Límite pendiente" };
  }

  const keys = (data || []).map((row) => String(row.permission_key || "").trim().toLowerCase());
  const planKey = keys.find((key) => key.startsWith(`${BEAT_UPLOAD_PERMISSION_KEY}.plan.`));
  const limitKey = keys.find((key) => key.startsWith(`${BEAT_UPLOAD_PERMISSION_KEY}.limit.`));
  const planValue = planKey?.slice(`${BEAT_UPLOAD_PERMISSION_KEY}.plan.`.length) || "";
  const limitValue = limitKey?.slice(`${BEAT_UPLOAD_PERMISSION_KEY}.limit.`.length) || "";
  return {
    plan: BEAT_UPLOAD_PLAN_LABELS[planValue] || "Plan pendiente",
    limit: /^\d+$/.test(limitValue) ? `${new Intl.NumberFormat("es-MX").format(Number(limitValue))} subidas` : "Límite pendiente",
  };
}

function waitForPortalOnboardingReady() {
  if (!document.body.classList.contains("db-body") || document.body.dataset.hrPortalOnboardingReady === "true") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    window.addEventListener("hiddenroom:portal-onboarding-ready", resolve, { once: true });
  });
}

function isAdmin(rawRoles) {
  return String(rawRoles || "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .includes("admin");
}

function showNextInviteModal() {
  const notification = inviteQueue.notifications[inviteQueue.index];
  if (!notification?.id) return;
  const queueIndex = inviteQueue.index;
  if (activeInviteQueueIndex === queueIndex) return;
  activeInviteQueueIndex = queueIndex;
  const show = () => showInviteModal(notification.id, inviteQueue.username, inviteQueue.access);
  const queued = window.HiddenRoomModalQueue?.enqueue
    ? window.HiddenRoomModalQueue.enqueue(show)
    : Promise.resolve().then(show);
  queued.finally(() => {
    if (activeInviteQueueIndex === queueIndex) activeInviteQueueIndex = null;
    if (inviteQueue.index > queueIndex) window.setTimeout(showNextInviteModal, 0);
  });
}

function showInviteModal(notificationId, rawUsername, access) {
  closeInviteModal();

  const overlay = document.createElement("div");
  overlay.id = "hr-beat-store-invite-modal";
  overlay.className = "beat-store-invite-modal";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "beat-store-invite-title");
  overlay.innerHTML = `
    <div class="beat-store-invite-modal__backdrop" data-beat-store-invite-close></div>
    <section class="beat-store-invite-modal__dialog hr-panel">
      <p class="beat-store-invite-modal__eyebrow">Beat Store · Hidden Room</p>
      <h2 id="beat-store-invite-title"><span>¡BIENVENIDO A</span><span>BEAT STORE,</span><span data-beat-store-invite-username></span></h2>
      <div class="beat-store-invite-modal__plan" aria-label="Plan de productor">
        <span class="beat-store-invite-modal__plan-label">PLAN DE PRODUCTOR</span>
        <strong data-beat-store-invite-plan></strong>
        <span data-beat-store-invite-limit></span>
      </div>
      <div class="beat-store-invite-modal__copy">
        <p>Esperamos que nuestra plataforma te sea de gran ayuda para generar ingresos y dar a conocer tus beats. Si tienes quejas o sugerencias no dudes en contactarnos por WhatsApp o con tu PR.</p>
        <p class="beat-store-invite-modal__signature">— Equipo de Hidden Room</p>
      </div>
      <div class="beat-store-invite-modal__legal">
        <label class="beat-store-invite-modal__consent">
          <input type="checkbox" data-beat-store-invite-consent>
          <span>Al usar Beat Store, confirmas que aceptas los <a href="/docs/#terminos-beat-store" target="_blank" rel="noopener noreferrer">términos y condiciones de Beat Store</a>.</span>
        </label>
        <p class="beat-store-invite-modal__status" data-beat-store-invite-status role="status" aria-live="polite"></p>
        <button class="primary-button beat-store-invite-modal__button" type="button" data-beat-store-invite-accept aria-disabled="true" disabled>Aceptar</button>
      </div>
    </section>
  `;

  const username = String(rawUsername || "PRODUCTOR").trim().replace(/^@+/, "") || "PRODUCTOR";
  overlay.querySelector("[data-beat-store-invite-username]").textContent = `@${username}`;
  overlay.querySelector("[data-beat-store-invite-plan]").textContent = access?.plan || "Plan pendiente";
  overlay.querySelector("[data-beat-store-invite-limit]").textContent = access?.limit || "Límite pendiente";
  document.body.appendChild(overlay);
  document.body.classList.add("hr-overlay-open");

  const consent = overlay.querySelector("[data-beat-store-invite-consent]");
  const button = overlay.querySelector("[data-beat-store-invite-accept]");
  consent.addEventListener("change", () => {
    button.disabled = !consent.checked;
    button.setAttribute("aria-disabled", String(button.disabled));
  }, { signal: lifecycle.signal });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay || event.target.closest("[data-beat-store-invite-close]")) {
      closeInviteModal(false);
      return;
    }
    const acceptButton = event.target.closest("[data-beat-store-invite-accept]");
    if (acceptButton && !acceptButton.disabled) void acceptInviteModal(notificationId, overlay);
  }, { signal: lifecycle.signal });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.getElementById("hr-beat-store-invite-modal")) {
      closeInviteModal(false);
    }
  }, { signal: lifecycle.signal });
  window.requestAnimationFrame(() => consent?.focus());

  return new Promise((resolve) => {
    activeInviteFinish = resolve;
  });
}

async function acceptInviteModal(notificationId, overlay) {
  const button = overlay?.querySelector("[data-beat-store-invite-accept]");
  const status = overlay?.querySelector("[data-beat-store-invite-status]");
  if (button) button.disabled = true;
  if (status) status.textContent = "Guardando aceptación…";

  try {
    let requirements = [];
    try {
      requirements = await legalService.getRequirements({ module: "beatstore", action: "publish_beat" });
    } catch (error) {
      if (!isLegalMigrationUnavailable(error)) throw error;
      console.warn("[HR] legal acceptance is not installed yet:", error);
    }

    for (const requirement of requirements.filter((item) =>
      item.document_key === "beatstore-producer-terms"
      && item.is_required
      && !item.has_accepted,
    )) {
      await legalService.accept({
        documentId: requirement.document_id,
        versionId: requirement.version_id,
        module: requirement.module_key,
        action: requirement.requested_action_key || (requirement.action_key === "*" ? null : requirement.action_key),
        accountType: requirement.account_type || null,
        method: "checkbox",
      });
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user && notificationId) {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);
      if (error) throw error;
    }
    inviteQueue.index += 1;
    closeInviteModal(true);
  } catch (error) {
    console.error("[HR] Beat Store invite acceptance:", error);
    if (status) status.textContent = error.message || "No se pudo registrar la aceptación.";
    if (button) button.disabled = false;
  }
}

function isLegalMigrationUnavailable(error) {
  return /legal_get_requirements|does not exist|not found/i.test(String(error?.message || error || ""));
}

function closeInviteModal(result = false) {
  const finish = activeInviteFinish;
  activeInviteFinish = null;
  document.getElementById("hr-beat-store-invite-modal")?.remove();
  document.body.classList.remove("hr-overlay-open");
  finish?.(result);
}
