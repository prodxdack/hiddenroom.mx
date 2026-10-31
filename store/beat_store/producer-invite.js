import { createLegalService } from '../../assets/js/legal-service.js?v=20261030-legal-consent-v1';

const BEAT_STORE_INVITE_TYPE = "beat-store-invite";
const supabase = await window.HiddenRoomSupabase.getClient();
const legalService = createLegalService(supabase);
const lifecycle = new AbortController();

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

  const { data: profile } = await supabase
    .from("users")
    .select("user_id,username,roles")
    .eq("id", session.user.id)
    .maybeSingle();

  if (isAdmin(profile?.roles)) return;

  const notificationUserIds = [...new Set([session.user.id, profile?.user_id].filter(Boolean).map(String))];
  const { data: notification, error } = await supabase
    .from("notifications")
    .select("id")
    .in("user_id", notificationUserIds)
    .eq("type", BEAT_STORE_INVITE_TYPE)
    .eq("read", false)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !notification?.id) return;
  showInviteModal(notification.id, profile?.username);
}

function isAdmin(rawRoles) {
  return String(rawRoles || "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .includes("admin");
}

function showInviteModal(notificationId, rawUsername) {
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
      <div class="beat-store-invite-modal__copy">
        <p>Esperamos que nuestra plataforma te sea de gran ayuda para generar ingresos y dar a conocer tus beats. Si tienes quejas o sugerencias no dudes en contactarnos por WhatsApp o con tu PR.</p>
        <p class="beat-store-invite-modal__signature">— Equipo de Hidden Room</p>
      </div>
      <div class="beat-store-invite-modal__legal">
        <label class="beat-store-invite-modal__consent">
          <input type="checkbox" data-beat-store-invite-consent>
          <span>Al hacer uso de nuestra plataforma, confirmas que aceptas los <a href="/docs/" target="_blank" rel="noopener noreferrer">términos y condiciones</a> y la <a href="/docs/#politica-de-privacidad" target="_blank" rel="noopener noreferrer">política de privacidad</a>.</span>
        </label>
        <p class="beat-store-invite-modal__status" data-beat-store-invite-status role="status" aria-live="polite"></p>
        <button class="primary-button beat-store-invite-modal__button" type="button" data-beat-store-invite-accept aria-disabled="true" disabled>Aceptar</button>
      </div>
    </section>
  `;

  const username = String(rawUsername || "PRODUCTOR").trim().replace(/^@+/, "") || "PRODUCTOR";
  overlay.querySelector("[data-beat-store-invite-username]").textContent = `@${username}`;
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
      closeInviteModal();
      return;
    }
    const acceptButton = event.target.closest("[data-beat-store-invite-accept]");
    if (acceptButton && !acceptButton.disabled) void acceptInviteModal(notificationId, overlay);
  }, { signal: lifecycle.signal });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.getElementById("hr-beat-store-invite-modal")) {
      closeInviteModal();
    }
  }, { signal: lifecycle.signal });
  window.requestAnimationFrame(() => consent?.focus());
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

    for (const requirement of requirements.filter((item) => item.is_required && !item.has_accepted)) {
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
    closeInviteModal();
  } catch (error) {
    console.error("[HR] Beat Store invite acceptance:", error);
    if (status) status.textContent = error.message || "No se pudo registrar la aceptación.";
    if (button) button.disabled = false;
  }
}

function isLegalMigrationUnavailable(error) {
  return /legal_get_requirements|does not exist|not found/i.test(String(error?.message || error || ""));
}

function closeInviteModal() {
  document.getElementById("hr-beat-store-invite-modal")?.remove();
  document.body.classList.remove("hr-overlay-open");
}
