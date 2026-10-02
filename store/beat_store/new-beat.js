const supabase = await window.HiddenRoomSupabase.getClient();
const SUPABASE_URL = 'https://rpcunbkstadgngqrjafp.supabase.co';
const ANALYZE_BEAT_AUDIO_ENDPOINT = `${SUPABASE_URL}/functions/v1/analyze-beat-audio`;
const CLOUD_ORIGIN = 'https://cloud.hiddenroom.mx';
const form = document.getElementById('beat-form');
const errorElement = document.getElementById('form-error');
const statusElement = document.getElementById('form-status');
const reviewButton = document.getElementById('submit-review');
const state = { session: null, user: null, profile: null, product: null, licenses: [], assignments: [] };

init().catch((error) => showError(error.message || 'No se pudo cargar el formulario.'));

async function init() {
  const { data } = await supabase.auth.getSession(); state.session = data.session;
  if (!state.session) { sessionStorage.setItem('hr_return_after_login', location.href); window.location.replace('../../portal/'); return; }
  const [{ data: account, error: accountError }, { data: profile, error: profileError }] = await Promise.all([
    supabase.from('users').select('display_name, username, roles').eq('id', state.session.user.id).maybeSingle(),
    supabase.from('producer_profiles').select('id, display_name').eq('user_id', state.session.user.id).maybeSingle(),
  ]);
  if (accountError || profileError) throw new Error((accountError || profileError).message);
  const permissionResult = await supabase.rpc('has_beats_upload_permission');
  let hasBeatUploadPermission = permissionResult.data;
  if (permissionResult.error) {
    const { data: permissionRows, error: permissionLookupError } = await supabase
      .from('user_permissions').select('permission_key').eq('user_id', state.session.user.id);
    if (permissionLookupError) throw new Error(permissionResult.error.message);
    hasBeatUploadPermission = (permissionRows || [])
      .map((row) => String(row.permission_key || '').trim().toLowerCase())
      .includes('beats.upload');
  }
  const roles = String(account?.roles || '').split(',').map((role) => role.trim().toLowerCase());
  const canUpload = roles.includes('admin') || Boolean(hasBeatUploadPermission);
  if (!canUpload) throw new Error('Tu cuenta no tiene permiso para subir beats.');
  state.user = account;
  state.profile = profile;
  const [{ data: licenses, error: licenseError }] = await Promise.all([supabase.from('beat_licenses').select('id, name, min_price, max_price, description, format, is_active').eq('is_active', true).order('created_at')]);
  if (licenseError) throw new Error(licenseError.message); state.licenses = licenses || [];
  renderLicenses();
  const id = new URLSearchParams(location.search).get('id'); if (id) await loadProduct(id);
  form.addEventListener('submit', (event) => saveDraft(event, false)); reviewButton.addEventListener('click', () => saveDraft(null, true));
  form.addEventListener('click', handleAutodetectClick);
  form.elements.audio.addEventListener('change', () => { markAutodetectInputs(false); updateAutodetectButtons(); });
  form.elements.bpm.addEventListener('input', () => markAutodetectInput(form.elements.bpm, 'bpm', false));
  form.elements.key.addEventListener('input', () => markAutodetectInput(form.elements.key, 'key', false));
  updateAutodetectButtons();
  form.querySelector('[name=name]').addEventListener('input', () => { const slug = form.elements.slug; if (!new URLSearchParams(location.search).get('id') && !slug.dataset.touched) slug.value = slugify(form.elements.name.value); });
  form.elements.slug.addEventListener('input', (event) => { event.target.dataset.touched = 'true'; });
}

async function loadProduct(id) {
  const { data, error } = await supabase.from('store_products').select('id, name, slug, price, description, beat_genre, beat_bpm, beat_key, beat_bpm_autodetected, beat_key_autodetected, beat_preview_status, beat_original_path, beat_cover_path, publication_status, review_comment').eq('id', id).eq('producer_user_id', state.session.user.id).maybeSingle();
  if (error || !data) throw new Error(error?.message || 'Beat no encontrado o no pertenece a tu cuenta.');
  state.product = data; document.getElementById('form-title').textContent = 'Editar beat';
  if (data.publication_status !== 'draft') statusElement.textContent = 'Al guardar cambios, el beat volverá a borrador y deberá pasar revisión nuevamente.';
  for (const [name, value] of Object.entries({ name:data.name, slug:data.slug, price:data.price, description:data.description || '', genre:data.beat_genre || '', bpm:data.beat_bpm || '', key:data.beat_key || '' })) if (form.elements[name]) form.elements[name].value = value;
  form.elements.bpm.dataset.autodetected = data.beat_bpm_autodetected ? 'true' : 'false';
  form.elements.key.dataset.autodetected = data.beat_key_autodetected ? 'true' : 'false';
  syncAutodetectBadges();
  document.getElementById('audio-state').textContent = data.beat_original_path ? `Master guardado: ${data.beat_original_path}` : 'Sin master guardado.';
  document.getElementById('cover-state').textContent = data.beat_cover_path ? 'Portada guardada.' : 'Sin portada guardada.';
  const { data: assignments } = await supabase.from('beat_license_assignments').select('license_id, price, is_enabled').eq('beat_id', id); state.assignments = assignments || []; renderLicenses();
}

function renderLicenses() { document.getElementById('license-list').innerHTML = state.licenses.length ? state.licenses.map((license) => { const assignment = state.assignments.find((candidate) => candidate.license_id === license.id); return `<label class="producer-ready-license"><input type="checkbox" data-license="${escapeHtml(license.id)}" ${assignment?.is_enabled ? 'checked' : ''}><span><strong>${escapeHtml(license.name)}</strong><br><small>${escapeHtml(license.description)}${license.format ? ` · ${escapeHtml(license.format)}` : ''}</small></span><input type="number" data-price="${escapeHtml(license.id)}" min="${Number(license.min_price)}" max="${Number(license.max_price)}" step="0.01" value="${Number(assignment?.price ?? license.min_price)}" aria-label="Precio ${escapeHtml(license.name)}"></label>`; }).join('') : '<p>No hay licencias activas configuradas por admin.</p>'; }

async function saveDraft(event, sendReview) {
  event?.preventDefault(); clearError(); const values = Object.fromEntries(new FormData(form).entries()); values.genre = normalizeGenre(values.genre);
  const price = Number(values.price); if (!values.name?.trim() || !values.slug?.trim() || !Number.isFinite(price) || price < 0) return showError('Título, slug y precio son obligatorios.');
  const audioFile = form.elements.audio.files?.[0] || null; if (audioFile && !isAudioFile(audioFile)) return showError('El master debe ser un archivo WAV sin comprimir (.wav).');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug.trim().toLowerCase())) return showError('El slug sólo puede usar minúsculas, números y guiones.');
  const button = event ? form.querySelector('button[type=submit]') : reviewButton; button.disabled = true; statusElement.textContent = 'Guardando borrador...';
  try {
    const producerName = state.profile?.display_name || state.user?.display_name || state.user?.username || null;
    const producer = producerName ? `@${String(producerName).replace(/^@+/, '')}` : null;
    const payload = { category:'beats', name:values.name.trim(), slug:values.slug.trim().toLowerCase(), description:values.description?.trim() || null, price, currency:'MXN', is_digital:true, is_active:false, publication_status:'draft', producer_user_id:state.session.user.id, producer_profile_id:state.profile?.id || null, producer, beat_genre:values.genre?.trim() || null, beat_bpm:values.bpm ? Number(values.bpm) : null, beat_key:values.key?.trim() || null, beat_bpm_autodetected: form.elements.bpm.dataset.autodetected === 'true', beat_key_autodetected: form.elements.key.dataset.autodetected === 'true', beat_preview_status: state.product?.beat_preview_status || 'pending' };
    const query = state.product ? supabase.from('store_products').update(payload).eq('id', state.product.id).eq('producer_user_id', state.session.user.id).select('id').single() : supabase.from('store_products').insert(payload).select('id').single();
    const { data, error } = await query; if (error) throw new Error(error.message); const id = state.product?.id || data.id; state.product = { ...(state.product || {}), id };
    await uploadFiles(id, values.slug.trim().toLowerCase()); await saveAssignments(id);
    if (sendReview) { const { error: reviewError } = await supabase.rpc('submit_beat_for_review', { p_beat_id:id }); if (reviewError) throw new Error(reviewError.message); statusElement.textContent = 'Beat enviado a revisión. El admin validará archivos, licencias y metadata.'; reviewButton.disabled = true; }
    else { statusElement.textContent = 'Borrador guardado. Puedes volver a abrirlo sin perder metadata.'; reviewButton.disabled = false; }
  } catch (error) { showError(error.message || 'No se pudo guardar el borrador.'); button.disabled = false; }
}

async function handleAutodetectClick(event) {
  const button = event.target.closest('[data-autodetect]');
  if (!button) return;
  const target = button.dataset.autodetect;
  if (target !== 'bpm' && target !== 'key') return;

  const file = form.elements.audio.files?.[0] || null;
  const existingAudioPath = state.product?.beat_original_path || '';
  if (!file && !existingAudioPath) return showError('Selecciona primero el master de audio.');
  if (file && !isAudioFile(file)) return showError('Selecciona un archivo de audio válido para autodetectar.');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return showError('Sesión requerida para autodetectar audio.');

  button.disabled = true;
  button.textContent = 'Detectando...';
  clearError();
  statusElement.textContent = `Autodetectando ${target === 'bpm' ? 'BPM' : 'tonalidad'}...`;
  try {
    const headers = { Authorization: `Bearer ${session.access_token}`, 'x-analyze-target': target };
    if (state.product?.id) headers['x-beat-product-id'] = state.product.id;
    let body = file;
    if (file) {
      headers['Content-Type'] = file.type || 'application/octet-stream';
      headers['x-file-name'] = encodeURIComponent(file.name);
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ audio_path: existingAudioPath });
    }
    const response = await fetch(ANALYZE_BEAT_AUDIO_ENDPOINT, { method: 'POST', headers, body });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No se pudo autodetectar el audio.');
    if (target === 'bpm' && Number.isFinite(Number(result.bpm))) markAutodetectInput(form.elements.bpm, 'bpm', true, String(Math.round(Number(result.bpm))));
    if (target === 'key' && result.key) markAutodetectInput(form.elements.key, 'key', true, String(result.key));
    statusElement.textContent = target === 'bpm' ? `BPM detectado: ${Math.round(Number(result.bpm))}.` : `Tonalidad detectada: ${result.key}.`;
  } catch (error) {
    showError(error.message || 'No se pudo autodetectar el audio.');
  } finally {
    button.textContent = 'Autodetectar';
    updateAutodetectButtons();
  }
}

function isAudioFile(file) { const type = String(file?.type || '').toLowerCase(); return /\.wav$/i.test(String(file?.name || '')) && (!type || ['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave', 'application/octet-stream'].includes(type)); }
function markAutodetectInputs(value) { markAutodetectInput(form.elements.bpm, 'bpm', value); markAutodetectInput(form.elements.key, 'key', value); }
function markAutodetectInput(input, target, autodetected, value) { if (value !== undefined) input.value = value; input.dataset.autodetected = autodetected ? 'true' : 'false'; syncAutodetectBadges(); }
function syncAutodetectBadges() { ['bpm', 'key'].forEach((target) => { const input = form.elements[target]; const badge = document.querySelector(`[data-ad-badge="${target}"]`); if (badge) badge.hidden = input.dataset.autodetected !== 'true' || !input.value; }); }
function updateAutodetectButtons() { const available = Boolean(form.elements.audio.files?.[0] || state.product?.beat_original_path); form.querySelectorAll('[data-autodetect]').forEach((button) => { if (!button.classList.contains('is-loading')) button.disabled = !available; }); }

async function uploadFiles(productId, slug) {
  const cover = form.elements.cover.files?.[0]; if (cover) { const result = await uploadCloud('/api/beat-store/cover', cover, { 'x-beat-product-id':productId }); if (!result.success) throw new Error(result.error || 'No se pudo guardar la portada.'); }
  const audio = form.elements.audio.files?.[0]; if (audio) { if (!isAudioFile(audio)) throw new Error('El master debe ser un archivo WAV sin comprimir (.wav).'); const result = await uploadCloud('/api/beat-store/upload-audio', audio, { 'x-beat-product-id':productId, 'x-beat-slug':slug, 'x-file-name':encodeURIComponent(audio.name) }); if (!result.success) throw new Error(result.error || 'No se pudo procesar el WAV.'); }
  const stems = form.elements.stems.files?.[0]; if (stems) { if (!/\.zip$/i.test(stems.name)) throw new Error('Los stems deben subirse como un archivo ZIP.'); const result = await uploadCloud('/api/beat-store/upload-stems', stems, { 'x-beat-product-id':productId, 'x-file-name':encodeURIComponent(stems.name) }); if (!result.success) throw new Error(result.error || 'No se pudieron guardar los stems.'); }
}
async function uploadCloud(path, file, extraHeaders) { const token = state.session.access_token; const response = await fetch(`${CLOUD_ORIGIN}${path}`, { method:'POST', headers:{ Authorization:`Bearer ${token}`, ...extraHeaders }, body:file }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || 'La subida falló.'); return result; }
async function saveAssignments(beatId) { for (const license of state.licenses) { const check = form.querySelector(`[data-license="${CSS.escape(license.id)}"]`); const price = Number(form.querySelector(`[data-price="${CSS.escape(license.id)}"]`)?.value); const existing = state.assignments.find((candidate) => candidate.license_id === license.id); if (check?.checked) { if (!Number.isFinite(price) || price < Number(license.min_price) || price > Number(license.max_price)) throw new Error(`${license.name}: precio fuera de rango.`); const { error } = await supabase.from('beat_license_assignments').upsert({ beat_id:beatId, license_id:license.id, price, is_enabled:true }, { onConflict:'beat_id,license_id' }); if (error) throw new Error(error.message); } else if (existing) { const { error } = await supabase.from('beat_license_assignments').delete().eq('id', existing.id); if (error) throw new Error(error.message); } } }
function normalizeGenre(value) { return String(value ?? '').trim().toLocaleLowerCase('es-MX').replace(/(^|[\s\/&'’-])(\p{L})/gu, (_, separator, letter) => separator + letter.toLocaleUpperCase('es-MX')); }
function slugify(value) { return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 140); }
function showError(message) { errorElement.textContent = message; statusElement.textContent = ''; }
function clearError() { errorElement.textContent = ''; }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char])); }
