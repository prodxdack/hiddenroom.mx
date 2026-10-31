const LEGAL_STORAGE_BUCKET = 'legal-documents';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]));
}

function normalizeRequirementList(requirements) {
  return Array.isArray(requirements) ? requirements.filter((item) => item?.document_id && item?.version_id) : [];
}

export async function sha256Hex(value) {
  const bytes = typeof value === 'string'
    ? new TextEncoder().encode(value)
    : new Uint8Array(await value.arrayBuffer());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function slugifyLegalFileName(value) {
  return String(value || 'documento')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'documento';
}

export function createLegalService(supabase) {
  if (!supabase) throw new Error('Supabase client is required for legal service.');

  const service = {
    async getRequirements({ module, action = null, accountType = null } = {}) {
      const { data, error } = await supabase.rpc('legal_get_requirements', {
        p_module_key: String(module || '').trim(),
        p_action_key: action ? String(action).trim() : null,
        p_account_type: accountType ? String(accountType).trim() : null,
      });
      if (error) throw error;
      return normalizeRequirementList(data).map((requirement) => ({
        ...requirement,
        requested_action_key: action ? String(action).trim().toLowerCase() : '',
      }));
    },

    async getDocument(documentId) {
      const { data, error } = await supabase
        .from('legal_documents')
        .select('id, document_key, name, description, document_type, status, created_at, updated_at')
        .eq('id', documentId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async getCurrentVersion(documentId) {
      const { data, error } = await supabase
        .from('legal_document_versions')
        .select('id, document_id, version_label, content, storage_path, mime_type, content_sha256, status, published_at, effective_from, requires_reacceptance')
        .eq('document_id', documentId)
        .eq('status', 'published')
        .lte('effective_from', new Date().toISOString())
        .order('effective_from', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async hasAccepted({ module, action = null, accountType = null } = {}) {
      const requirements = await service.getRequirements({ module, action, accountType });
      return requirements.every((requirement) => !requirement.is_required || requirement.has_accepted);
    },

    async accept({ documentId, versionId, module, action = null, method = 'checkbox', accountType = null } = {}) {
      const { data, error } = await supabase.rpc('legal_accept_document', {
        p_document_id: documentId,
        p_version_id: versionId,
        p_module_key: String(module || '').trim(),
        p_action_key: action ? String(action).trim() : null,
        p_method: method,
        p_user_agent: typeof navigator === 'undefined' ? null : navigator.userAgent,
        p_account_type: accountType ? String(accountType).trim() : null,
      });
      if (error) throw error;
      return data;
    },

    async getAcceptanceHistory(documentId) {
      const { data, error } = await supabase
        .from('legal_acceptances')
        .select('id, auth_user_id, document_id, version_id, module_key, action_key, method, content_sha256, accepted_at, user_agent')
        .eq('document_id', documentId)
        .order('accepted_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async createSignedUrl(storagePath, expiresIn = 3600) {
      if (!storagePath) return null;
      const { data, error } = await supabase.storage
        .from(LEGAL_STORAGE_BUCKET)
        .createSignedUrl(storagePath, expiresIn);
      if (error) throw error;
      return data?.signedUrl || null;
    },

    async uploadPdf(file, { documentKey, versionLabel } = {}) {
      if (!file || (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name || ''))) throw new Error('Selecciona un archivo PDF.');
      const safeDocumentKey = slugifyLegalFileName(documentKey);
      const safeVersion = slugifyLegalFileName(versionLabel || 'version');
      const safeName = slugifyLegalFileName(file.name.replace(/\.pdf$/i, ''));
      const unique = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const storagePath = `documents/${safeDocumentKey}/${safeVersion}-${unique}-${safeName}.pdf`;
      const { error } = await supabase.storage
        .from(LEGAL_STORAGE_BUCKET)
        .upload(storagePath, file, { contentType: 'application/pdf', cacheControl: '31536000', upsert: false });
      if (error) throw error;
      return { storagePath, contentSha256: await sha256Hex(file), mimeType: 'application/pdf' };
    },

    async adminCreateDocument(payload) {
      const { data, error } = await supabase.rpc('legal_admin_create_document', {
        p_document_key: payload.documentKey,
        p_name: payload.name,
        p_description: payload.description || null,
        p_document_type: payload.documentType || 'terms',
      });
      if (error) throw error;
      return data;
    },

    async adminUpdateDocument(payload) {
      const { data, error } = await supabase.rpc('legal_admin_update_document', {
        p_document_id: payload.documentId,
        p_document_key: payload.documentKey,
        p_name: payload.name,
        p_description: payload.description || null,
        p_document_type: payload.documentType || 'terms',
      });
      if (error) throw error;
      return data;
    },

    async adminCreateVersion(payload) {
      const { data, error } = await supabase.rpc('legal_admin_create_version', {
        p_document_id: payload.documentId,
        p_version_label: payload.versionLabel,
        p_content: payload.content || null,
        p_storage_path: payload.storagePath || null,
        p_mime_type: payload.mimeType || null,
        p_content_sha256: payload.contentSha256,
        p_effective_from: payload.effectiveFrom || new Date().toISOString(),
        p_requires_reacceptance: payload.requiresReacceptance !== false,
      });
      if (error) throw error;
      return data;
    },

    async adminPublishVersion(versionId) {
      const { data, error } = await supabase.rpc('legal_admin_publish_version', { p_version_id: versionId });
      if (error) throw error;
      return data;
    },

    async adminCreateRule(payload) {
      const { data, error } = await supabase.rpc('legal_admin_create_rule', {
        p_document_id: payload.documentId,
        p_module_key: payload.moduleKey,
        p_action_key: payload.actionKey || '*',
        p_role_key: payload.roleKey || '*',
        p_account_type: payload.accountType || null,
        p_is_required: payload.isRequired !== false,
      });
      if (error) throw error;
      return data;
    },

    async adminPendingUsers(documentId) {
      const { data, error } = await supabase.rpc('legal_admin_pending_users', { p_document_id: documentId });
      if (error) throw error;
      return data || [];
    },
  };

  return service;
}

export function renderLegalAcceptance(requirement, { inputId = '' } = {}) {
  if (!requirement) return '';
  const id = inputId || `legal-acceptance-${String(requirement.document_id).replace(/[^a-z0-9_-]/gi, '-')}`;
  const version = requirement.version_label ? ` · v${escapeHtml(requirement.version_label)}` : '';
  const required = requirement.is_required ? '<span class="hr-legal-acceptance__required">Obligatorio</span>' : '<span>Informativo</span>';
  return `
    <label class="hr-legal-acceptance" data-legal-acceptance="${escapeHtml(requirement.document_id)}">
      <input id="${escapeHtml(id)}" type="checkbox" data-legal-acceptance-input="${escapeHtml(requirement.document_id)}" />
      <span>
        Acepto <strong>${escapeHtml(requirement.name)}</strong>${version}.
        <small>${required}</small>
      </span>
    </label>
  `;
}

export async function openLegalAcceptanceGate({ service, requirements, title = 'Aceptación requerida', eyebrow = 'Hidden Room · Documento legal' } = {}) {
  const pending = normalizeRequirementList(requirements).filter((requirement) => requirement.is_required && !requirement.has_accepted);
  if (!pending.length) return true;

  const overlay = document.createElement('div');
  overlay.className = 'hr-legal-gate';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'hr-legal-gate-title');
  overlay.innerHTML = `
    <div class="hr-legal-gate__backdrop" data-legal-gate-close></div>
    <section class="hr-legal-gate__dialog hr-panel">
      <p class="hr-legal-gate__eyebrow">${escapeHtml(eyebrow)}</p>
      <h2 id="hr-legal-gate-title">${escapeHtml(title)}</h2>
      <p class="hr-legal-gate__intro">Antes de continuar, revisa y acepta los documentos aplicables.</p>
      <div class="hr-legal-gate__documents">
        ${pending.map((requirement, index) => `
          <article class="hr-legal-gate__document">
            <div class="hr-legal-gate__document-header">
              <div>
                <span class="section-label">${escapeHtml(requirement.document_type || 'Documento')}</span>
                <h3>${escapeHtml(requirement.name)}</h3>
                <p>${escapeHtml(requirement.description || `Versión ${requirement.version_label || 'vigente'}.`)}</p>
              </div>
              ${requirement.storage_path ? `<button type="button" class="secondary-button" data-legal-gate-file="${escapeHtml(requirement.storage_path)}">Ver PDF</button>` : ''}
            </div>
            ${requirement.content ? `<details class="hr-legal-gate__content"><summary>Consultar contenido completo</summary><div>${escapeHtml(requirement.content).replace(/\n/g, '<br>')}</div></details>` : ''}
            ${renderLegalAcceptance(requirement, { inputId: `hr-legal-gate-accept-${index}` })}
          </article>
        `).join('')}
      </div>
      <p class="hr-legal-gate__error" data-legal-gate-error role="alert"></p>
      <div class="hr-legal-gate__actions">
        <button type="button" class="secondary-button" data-legal-gate-close>Cancelar</button>
        <button type="button" class="primary-button" data-legal-gate-submit disabled>Aceptar y continuar</button>
      </div>
    </section>
  `;

  document.body.appendChild(overlay);
  document.body.classList.add('hr-overlay-open');
  const submit = overlay.querySelector('[data-legal-gate-submit]');
  const error = overlay.querySelector('[data-legal-gate-error]');
  const inputs = [...overlay.querySelectorAll('[data-legal-acceptance-input]')];
  const syncSubmit = () => { submit.disabled = inputs.some((input) => !input.checked); };
  inputs.forEach((input) => input.addEventListener('change', syncSubmit));
  overlay.querySelectorAll('[data-legal-gate-file]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        const url = await service.createSignedUrl(button.dataset.legalGateFile);
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
      } catch (fileError) {
        error.textContent = fileError.message || 'No se pudo abrir el documento.';
      }
    });
  });

  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      overlay.remove();
      document.body.classList.remove('hr-overlay-open');
      resolve(value);
    };
    overlay.addEventListener('click', async (event) => {
      if (event.target.closest('[data-legal-gate-close]')) {
        finish(false);
        return;
      }
      if (!event.target.closest('[data-legal-gate-submit]') || submit.disabled) return;
      submit.disabled = true;
      error.textContent = '';
      try {
        for (const requirement of pending) {
          await service.accept({
            documentId: requirement.document_id,
            versionId: requirement.version_id,
            module: requirement.module_key,
            action: requirement.requested_action_key || (requirement.action_key === '*' ? null : requirement.action_key),
            accountType: requirement.account_type || null,
            method: 'checkbox',
          });
        }
        finish(true);
      } catch (acceptError) {
        error.textContent = acceptError.message || 'No se pudo registrar la aceptación.';
        submit.disabled = false;
      }
    });
    document.addEventListener('keydown', function handleKeydown(event) {
      if (event.key !== 'Escape' || settled) return;
      document.removeEventListener('keydown', handleKeydown);
      finish(false);
    });
    window.requestAnimationFrame(() => inputs[0]?.focus());
  });
}

export const LegalAcceptance = renderLegalAcceptance;
export const LegalAcceptanceGate = openLegalAcceptanceGate;

if (typeof window !== 'undefined') {
  window.HiddenRoomLegal = {
    createLegalService,
    LegalAcceptance,
    LegalAcceptanceGate,
    openLegalAcceptanceGate,
    renderLegalAcceptance,
    sha256Hex,
  };
}
