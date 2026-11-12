/* Hidden Room CRM MVP: admin-only commercial workspace. */

const STAGES = [
  ['prospect', 'Prospecto'],
  ['contacted', 'Contactado'],
  ['interested', 'Interesado'],
  ['quoted', 'Cotizado'],
  ['reserved', 'Reservado'],
  ['won', 'Ganado'],
  ['lost', 'Perdido'],
  ['paused', 'Pausado'],
];
const OPEN_STAGES = new Set(['prospect', 'contacted', 'interested', 'quoted', 'reserved']);
const KINDS = [['acquisition', 'Adquisición'], ['reactivation', 'Reactivación'], ['upsell', 'Upselling'], ['renewal', 'Renovación']];
const SOURCES = [['instagram', 'Instagram'], ['tiktok', 'TikTok'], ['google', 'Google'], ['referral', 'Recomendación'], ['event', 'Evento'], ['whatsapp', 'WhatsApp'], ['website', 'Sitio web'], ['other', 'Otro'], ['unknown', 'Desconocido']];
const CHANNELS = [['whatsapp', 'WhatsApp'], ['instagram', 'Instagram'], ['phone', 'Llamada'], ['email', 'Correo'], ['website', 'Sitio web'], ['internal', 'Interno'], ['other', 'Otro']];
const DIRECTIONS = [['inbound', 'Recibido'], ['outbound', 'Enviado'], ['internal', 'Nota interna']];
const ACTIVITY_TYPES = [['message', 'Mensaje'], ['call', 'Llamada'], ['quote', 'Cotización'], ['reservation', 'Reservación'], ['note', 'Nota interna']];

const escape = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const attr = escape;
const text = (value, fallback = '—') => {
  const result = String(value ?? '').trim();
  return escape(result || fallback);
};
const optionList = (items, selected = '', empty = '') => `${empty ? `<option value="">${escape(empty)}</option>` : ''}${items.map(([value, label]) => `<option value="${attr(value)}"${String(value) === String(selected) ? ' selected' : ''}>${escape(label)}</option>`).join('')}`;
const labelOf = (items, value) => items.find(([key]) => String(key) === String(value))?.[1] || value || '—';
const stageLabel = (value) => labelOf(STAGES, value);
const formatDate = (value, withTime = false) => {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-MX', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(date);
};
const formatMoney = (value) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(Number(value || 0));
const digits = (value) => String(value || '').replace(/\D/g, '');
const normalized = (value) => String(value || '').trim().toLowerCase();
const todayIso = () => new Date().toISOString().slice(0, 10);

function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function createCrmController({ supabase, getUser, showToast, navigate }) {
  const cache = {
    loaded: false,
    tab: 'sales',
    search: '',
    stageFilter: '',
    sourceFilter: '',
    editingOpportunityId: '',
    leads: [],
    opportunities: [],
    activities: [],
    users: [],
    transactions: [],
  };

  const userMap = () => {
    const map = new Map();
    cache.users.forEach((user) => {
      const key = String(user.user_id || '').trim();
      if (key && !map.has(key)) map.set(key, user);
    });
    return map;
  };
  const leadById = (id) => cache.leads.find((lead) => String(lead.id) === String(id));
  const opportunityById = (id) => cache.opportunities.find((item) => String(item.id) === String(id));
  const leadName = (lead) => lead?.display_name || userMap().get(String(lead?.user_id || ''))?.display_name || lead?.user_id || 'Prospecto sin nombre';
  const leadContact = (lead) => lead?.whatsapp || userMap().get(String(lead?.user_id || ''))?.whatsapp || '';
  const currentUserName = () => getUser?.()?.display_name || getUser?.()?.username || getUser?.()?.user_id || 'Administrador';

  async function load() {
    if (cache.loaded) return;
    const [leadsResult, opportunitiesResult, activitiesResult, usersResult, hrTransactionsResult, transactionsResult] = await Promise.all([
      supabase.from('sales_leads').select('*').order('updated_at', { ascending: false }).limit(2000),
      supabase.from('sales_opportunities').select('*').order('updated_at', { ascending: false }).limit(2000),
      supabase.from('sales_activities').select('*').order('occurred_at', { ascending: false }).limit(3000),
      supabase.from('users').select('id,user_id,display_name,email,whatsapp,username,ig_username').order('display_name', { ascending: true }).limit(2000),
      supabase.from('hr_transactions').select('id,user_id,username,amount,type,movement_date,created_at,concept,via,service').order('movement_date', { ascending: false }).limit(5000),
      supabase.from('transactions').select('id,user_id,username,amount,type,date,created_at,concept,via,service').order('date', { ascending: false }).limit(5000),
    ]);
    const firstError = [leadsResult, opportunitiesResult, activitiesResult, usersResult].find((result) => result.error)?.error;
    if (firstError) throw firstError;
    cache.leads = leadsResult.data || [];
    cache.opportunities = opportunitiesResult.data || [];
    cache.activities = activitiesResult.data || [];
    cache.users = usersResult.data || [];
    const hrRows = hrTransactionsResult.error ? [] : (hrTransactionsResult.data || []);
    const legacyRows = transactionsResult.error ? [] : (transactionsResult.data || []);
    cache.transactions = hrRows.length ? hrRows.map((row) => ({ ...row, transaction_date: row.movement_date || row.created_at })) : legacyRows.map((row) => ({ ...row, transaction_date: row.date || row.created_at }));
    cache.loaded = true;
  }

  function incomeRows() {
    return cache.transactions.filter((row) => normalized(row.type) === 'ingreso' && Number(row.amount || 0) > 0);
  }

  function metrics() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthIncome = incomeRows().filter((row) => new Date(row.transaction_date || row.created_at) >= monthStart).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const open = cache.opportunities.filter((item) => OPEN_STAGES.has(item.stage));
    const estimated = open.reduce((sum, item) => sum + Number(item.estimated_amount || 0), 0);
    const nearClose = open.filter((item) => ['quoted', 'reserved'].includes(item.stage) || (item.next_followup_at && new Date(item.next_followup_at) <= new Date(now.getTime() + 7 * 86400000)));
    const overdue = open.filter((item) => item.next_followup_at && new Date(item.next_followup_at) < now);
    const dueSoon = open.filter((item) => item.next_followup_at && new Date(item.next_followup_at) >= now && new Date(item.next_followup_at) <= new Date(now.getTime() + 7 * 86400000));
    const won = cache.opportunities.filter((item) => item.stage === 'won').length;
    const closed = won + cache.opportunities.filter((item) => item.stage === 'lost').length;
    const newClients = cache.leads.filter((lead) => lead.first_purchase_at && new Date(lead.first_purchase_at) >= monthStart).length;
    const inactive = cache.leads.filter((lead) => lead.first_purchase_at && new Date(lead.first_purchase_at) < new Date(now.getTime() - 90 * 86400000) && !open.some((item) => item.lead_id === lead.id)).length;
    return { monthIncome, estimated, nearClose, overdue, dueSoon, won, closed, conversion: closed ? won / closed : null, newClients, inactive, open };
  }

  function customerRows() {
    const txByUser = new Map();
    incomeRows().forEach((row) => {
      const key = String(row.user_id || '').trim();
      if (!key) return;
      const bucket = txByUser.get(key) || { total: 0, count: 0, last: null };
      bucket.total += Number(row.amount || 0);
      bucket.count += 1;
      if (!bucket.last || new Date(row.transaction_date) > new Date(bucket.last)) bucket.last = row.transaction_date;
      txByUser.set(key, bucket);
    });
    const openByLead = new Map();
    cache.leads.forEach((lead) => openByLead.set(lead.id, cache.opportunities.filter((item) => item.lead_id === lead.id && OPEN_STAGES.has(item.stage)).length));
    const now = Date.now();
    return cache.leads.map((lead) => {
      const user = userMap().get(String(lead.user_id || ''));
      const stats = txByUser.get(String(lead.user_id || '')) || { total: 0, count: 0, last: lead.first_purchase_at };
      const inactive = stats.last && now - new Date(stats.last).getTime() > 90 * 86400000 && !openByLead.get(lead.id);
      const status = stats.count === 0 ? 'Prospecto' : inactive ? 'Inactivo' : stats.count > 1 ? 'Recurrente' : 'Activo';
      return { lead, user, ...stats, status, open: openByLead.get(lead.id) || 0 };
    });
  }

  function metricCard(title, value, note, variant = '') {
    return `<article class="hr-crm-metric ${variant ? `hr-crm-metric--${variant}` : ''}"><span>${escape(title)}</span><strong>${escape(value)}</strong><small>${escape(note)}</small></article>`;
  }

  function tabs() {
    return `<nav class="hr-crm-tabs" aria-label="Secciones CRM">${[['sales', 'Ventas'], ['pipeline', 'Pipeline'], ['clients', 'Clientes'], ['reports', 'Reportes']].map(([key, label]) => `<button type="button" class="${cache.tab === key ? 'is-active' : ''}" data-crm-action="tab" data-crm-tab="${key}">${label}</button>`).join('')}</nav>`;
  }

  function leadOptions(selected = '') {
    return cache.leads.slice().sort((a, b) => leadName(a).localeCompare(leadName(b), 'es')).map((lead) => `<option value="${attr(lead.id)}"${String(selected) === String(lead.id) ? ' selected' : ''}>${text(leadName(lead))}${lead.user_id ? ` · ${text(lead.user_id)}` : ''}</option>`).join('');
  }

  function userOptions() {
    const seen = new Set();
    return cache.users.slice().sort((a, b) => String(a.display_name || a.user_id || '').localeCompare(String(b.display_name || b.user_id || ''), 'es')).filter((user) => {
      const key = String(user.user_id || user.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((user) => `<option value="${attr(user.user_id || '')}">${text(user.display_name || user.username || user.email || user.user_id)}${user.user_id ? ` · ${text(user.user_id)}` : ''}</option>`).join('');
  }

  function forms() {
    const editing = opportunityById(cache.editingOpportunityId);
    return `<div class="hr-crm-form-grid">
      <section class="hr-crm-panel"><div class="hr-crm-panel__head"><div><span class="db-section__eyebrow">CRM</span><h2>${editing ? 'Editar oportunidad' : 'Nueva oportunidad'}</h2></div>${editing ? '<button type="button" class="db-btn-secondary" data-crm-action="cancel-edit">Cancelar</button>' : ''}</div>
        <form class="db-form" data-crm-form="opportunity-save">
          <input type="hidden" name="id" value="${attr(editing?.id || '')}" />
          <label class="db-field"><span>Cliente / prospecto</span><select name="lead_id" required><option value="">Selecciona un prospecto</option>${leadOptions(editing?.lead_id || '')}</select></label>
          <div class="db-form__row"><label class="db-field"><span>Servicio</span><input name="service" value="${attr(editing?.service || '')}" placeholder="Grabación, producción..." /></label><label class="db-field"><span>Importe estimado</span><input name="estimated_amount" type="number" min="0" step="0.01" value="${attr(editing?.estimated_amount || '')}" /></label></div>
          <div class="db-form__row"><label class="db-field"><span>Etapa</span><select name="stage">${optionList(STAGES, editing?.stage || 'prospect')}</select></label><label class="db-field"><span>Tipo</span><select name="kind">${optionList(KINDS, editing?.kind || 'acquisition')}</select></label></div>
          <div class="db-form__row"><label class="db-field"><span>Canal de adquisición</span><select name="source">${optionList(SOURCES, editing?.source || 'unknown')}</select></label><label class="db-field"><span>Próximo seguimiento</span><input name="next_followup_at" type="datetime-local" value="${attr(editing?.next_followup_at ? String(editing.next_followup_at).slice(0, 16) : '')}" /></label></div>
          <label class="db-field"><span>Responsable / nota</span><textarea name="notes" rows="3" placeholder="Siguiente paso, contexto, objeciones...">${escape(editing?.notes || '')}</textarea></label>
          <button class="btn-primary" type="submit">${editing ? 'Guardar oportunidad' : 'Crear oportunidad'}</button>
        </form>
      </section>
      <section class="hr-crm-panel"><div class="hr-crm-panel__head"><div><span class="db-section__eyebrow">CRM</span><h2>Nuevo prospecto</h2></div></div>
        <form class="db-form" data-crm-form="lead-save">
          <label class="db-field"><span>Usuario existente (opcional)</span><select name="user_id"><option value="">Sin vincular todavía</option>${userOptions()}</select></label>
          <div class="db-form__row"><label class="db-field"><span>Nombre</span><input name="display_name" required placeholder="Nombre comercial" /></label><label class="db-field"><span>WhatsApp</span><input name="whatsapp" inputmode="tel" placeholder="521..." /></label></div>
          <div class="db-form__row"><label class="db-field"><span>Instagram</span><input name="instagram" placeholder="@usuario" /></label><label class="db-field"><span>Canal de adquisición</span><select name="source">${optionList(SOURCES, 'unknown')}</select></label></div>
          <label class="db-field"><span>Notas</span><textarea name="notes" rows="3"></textarea></label>
          <button class="db-btn-secondary" type="submit">Guardar prospecto</button>
        </form>
      </section>
    </div>`;
  }

  function activityForm(opportunity = null) {
    const lead = opportunity ? leadById(opportunity.lead_id) : cache.leads[0];
    if (!lead) return '';
    return `<section class="hr-crm-panel"><div class="hr-crm-panel__head"><div><span class="db-section__eyebrow">Seguimiento</span><h2>Registrar actividad</h2></div></div><form class="db-form" data-crm-form="activity-save"><input type="hidden" name="lead_id" value="${attr(lead.id)}" /><input type="hidden" name="opportunity_id" value="${attr(opportunity?.id || '')}" /><div class="db-form__row"><label class="db-field"><span>Canal de contacto</span><select name="channel">${optionList(CHANNELS, 'whatsapp')}</select></label><label class="db-field"><span>Dirección</span><select name="direction">${optionList(DIRECTIONS, 'outbound')}</select></label></div><div class="db-form__row"><label class="db-field"><span>Tipo</span><select name="activity_type">${optionList(ACTIVITY_TYPES, 'message')}</select></label><label class="db-field"><span>Próximo seguimiento</span><input name="next_followup_at" type="datetime-local" /></label></div><label class="db-field"><span>Resumen</span><textarea name="summary" rows="3" required placeholder="Qué ocurrió y qué sigue..."></textarea></label><input type="hidden" name="responsible" value="${attr(currentUserName())}" /><button class="db-btn-secondary" type="submit">Guardar actividad</button></form></section>`;
  }

  function renderSales() {
    const m = metrics();
    const actions = [...m.overdue.map((item) => ({ item, reason: 'Seguimiento vencido', urgent: true })), ...m.dueSoon.map((item) => ({ item, reason: 'Seguimiento esta semana', urgent: false }))].slice(0, 8);
    return `<div class="hr-crm-dashboard"><div class="hr-crm-metrics">${metricCard('Ingresos confirmados', formatMoney(m.monthIncome), 'Este mes · transacciones INGRESO reales', 'income')}${metricCard('Pipeline abierto', formatMoney(m.estimated), 'Potencial, no ingreso confirmado', 'potential')}${metricCard('Próximos a cerrar', String(m.nearClose.length), 'Cotizados, reservados o con seguimiento cercano')}${metricCard('Seguimientos vencidos', String(m.overdue.length), 'Requieren contacto hoy', m.overdue.length ? 'danger' : '')}${metricCard('Clientes nuevos', String(m.newClients), 'Primera compra este mes')}${metricCard('Clientes inactivos', String(m.inactive), 'Sin compra reciente ni oportunidad abierta')}</div><div class="hr-crm-dashboard-grid"><section class="hr-crm-panel"><div class="hr-crm-panel__head"><div><span class="db-section__eyebrow">Acciones prioritarias</span><h2>A quién contactar y por qué</h2></div><button type="button" class="db-btn-secondary" data-crm-action="tab" data-crm-tab="pipeline">Ver pipeline</button></div>${actions.length ? `<div class="hr-crm-actions">${actions.map(({ item, reason, urgent }) => { const lead = leadById(item.lead_id); return `<article class="hr-crm-action ${urgent ? 'is-urgent' : ''}"><div><strong>${text(leadName(lead))}</strong><span>${text(reason)} · ${text(item.service || 'Servicio por definir')}</span></div><div class="hr-crm-action__buttons">${leadContact(lead) ? `<a class="db-btn-secondary" target="_blank" rel="noopener" href="https://wa.me/${attr(digits(leadContact(lead)))}">WhatsApp</a>` : ''}<button type="button" class="db-btn-secondary" data-crm-action="edit-opportunity" data-crm-id="${attr(item.id)}">Abrir</button></div></article>`; }).join('')}</div>` : '<p class="db-empty">No hay seguimientos pendientes. El pipeline está al día.</p>'}</section><section class="hr-crm-panel"><div class="hr-crm-panel__head"><div><span class="db-section__eyebrow">Conversión</span><h2>Salud comercial</h2></div></div><div class="hr-crm-health"><strong>${m.conversion === null ? 'Sin datos suficientes' : `${Math.round(m.conversion * 100)}%`}</strong><span>Conversión de oportunidades cerradas</span><small>${m.closed ? `${m.won} ganadas de ${m.closed} cerradas` : 'Se calculará cuando existan oportunidades ganadas y perdidas.'}</small></div><div class="hr-crm-note">Los ingresos confirmados salen de transacciones con tipo INGRESO. Las oportunidades se muestran aparte como estimaciones.</div></section></div></div>`;
  }

  function renderPipeline() {
    const stages = STAGES.filter(([key]) => ['lost', 'paused'].includes(key) || OPEN_STAGES.has(key));
    return `<div class="hr-crm-pipeline"><div class="hr-crm-pipeline__toolbar"><label class="db-field"><span>Canal de adquisición</span><select data-crm-filter="source"><option value="">Todos</option>${optionList(SOURCES, cache.sourceFilter)}</select></label><label class="db-field"><span>Etapa</span><select data-crm-filter="stage"><option value="">Todas</option>${optionList(STAGES, cache.stageFilter)}</select></label><button type="button" class="db-btn-secondary" data-crm-action="reload">Actualizar</button></div><div class="hr-crm-board">${stages.map(([stage, title]) => { const rows = cache.opportunities.filter((item) => item.stage === stage && (!cache.stageFilter || item.stage === cache.stageFilter) && (!cache.sourceFilter || item.source === cache.sourceFilter)); return `<section class="hr-crm-column" data-crm-stage="${stage}"><header><strong>${title}</strong><span>${rows.length}</span></header><div class="hr-crm-column__body">${rows.length ? rows.map((item) => { const lead = leadById(item.lead_id); return `<article class="hr-crm-opportunity" draggable="true" data-crm-opportunity-id="${attr(item.id)}"><div class="hr-crm-opportunity__title"><strong>${text(leadName(lead))}</strong><button type="button" data-crm-action="edit-opportunity" data-crm-id="${attr(item.id)}" aria-label="Editar oportunidad">Editar</button></div><span>${text(item.service || 'Servicio por definir')}</span><b>${item.estimated_amount ? escape(formatMoney(item.estimated_amount)) : 'Importe por definir'}</b><small>${text(labelOf(KINDS, item.kind))}${item.next_followup_at ? ` · ${text(formatDate(item.next_followup_at, true))}` : ''}</small><select data-crm-stage-select data-crm-id="${attr(item.id)}" aria-label="Cambiar etapa">${optionList(STAGES, item.stage)}</select>${leadContact(lead) ? `<a class="hr-crm-whatsapp" target="_blank" rel="noopener" href="https://wa.me/${attr(digits(leadContact(lead)))}">Abrir WhatsApp</a>` : ''}</article>`; }).join('') : '<p class="hr-crm-column__empty">Sin oportunidades</p>'}</div></section>`; }).join('')}</div></div>`;
  }

  function renderClients() {
    const rows = customerRows().filter((row) => {
      const haystack = normalized([leadName(row.lead), row.lead.user_id, row.user?.email, row.user?.whatsapp, row.lead.whatsapp].join(' '));
      return !cache.search || haystack.includes(normalized(cache.search));
    });
    return `<div class="hr-crm-clients"><form class="hr-crm-client-search" data-crm-form="client-search"><input name="search" value="${attr(cache.search)}" placeholder="Buscar cliente, user_id, teléfono o correo" /><button class="db-btn-secondary" type="submit">Buscar</button></form><div class="hr-crm-table-wrap"><table class="hr-crm-table"><thead><tr><th>Cliente</th><th>Estado calculado</th><th>Compras</th><th>Total gastado</th><th>Última compra</th><th>Oportunidades</th><th></th></tr></thead><tbody>${rows.length ? rows.map((row) => `<tr><td><strong>${text(leadName(row.lead))}</strong><small>${text(row.lead.user_id || row.user?.email || 'Sin user_id')}</small></td><td><span class="hr-crm-badge">${text(row.status)}</span></td><td>${row.count}</td><td>${escape(formatMoney(row.total))}</td><td>${text(formatDate(row.last))}</td><td>${row.open}</td><td><div class="hr-crm-row-actions">${leadContact(row.lead) ? `<a class="db-btn-secondary" target="_blank" rel="noopener" href="https://wa.me/${attr(digits(leadContact(row.lead)))}">WhatsApp</a>` : ''}<button type="button" class="db-btn-secondary" data-crm-action="reactivate" data-crm-lead-id="${attr(row.lead.id)}">Reactivar</button></div></td></tr>`).join('') : '<tr><td colspan="7"><p class="db-empty">No hay clientes que coincidan.</p></td></tr>'}</tbody></table></div></div>`;
  }

  function renderReports() {
    const sourceMap = new Map();
    cache.leads.forEach((lead) => { const key = lead.source || 'unknown'; const bucket = sourceMap.get(key) || { leads: 0, won: 0, income: 0 }; bucket.leads += 1; sourceMap.set(key, bucket); });
    cache.opportunities.filter((item) => item.stage === 'won').forEach((item) => { const lead = leadById(item.lead_id); const key = item.source || lead?.source || 'unknown'; const bucket = sourceMap.get(key) || { leads: 0, won: 0, income: 0 }; bucket.won += 1; sourceMap.set(key, bucket); });
    const stages = STAGES.map(([key, label]) => [label, cache.opportunities.filter((item) => item.stage === key).length]);
    return `<div class="hr-crm-reports"><div class="hr-crm-report-grid"><section class="hr-crm-panel"><div class="hr-crm-panel__head"><div><span class="db-section__eyebrow">Adquisición</span><h2>Canales</h2></div></div><p class="hr-crm-note">El canal de adquisición es independiente del canal usado en el contacto.</p><div class="hr-crm-report-list">${[...sourceMap.entries()].map(([key, value]) => `<div><span>${text(labelOf(SOURCES, key))}</span><b>${value.leads} prospectos · ${value.won} ganadas</b></div>`).join('') || '<p class="db-empty">Aún no hay datos.</p>'}</div></section><section class="hr-crm-panel"><div class="hr-crm-panel__head"><div><span class="db-section__eyebrow">Pipeline</span><h2>Oportunidades por etapa</h2></div></div><div class="hr-crm-report-list">${stages.map(([label, count]) => `<div><span>${escape(label)}</span><b>${count}</b></div>`).join('')}</div></section></div></div>`;
  }

  async function render() {
    await load();
    const content = cache.tab === 'pipeline' ? renderPipeline() : cache.tab === 'clients' ? renderClients() : cache.tab === 'reports' ? renderReports() : renderSales();
    return `<section class="db-section hr-portal-section hr-crm-section" aria-labelledby="title-crm"><div class="db-section__header"><div><span class="db-section__eyebrow">Ventas / CRM</span><h1 class="db-section__title" id="title-crm">CRM Comercial</h1><p class="db-section__summary">Seguimiento de oportunidades, clientes anteriores y acciones de venta.</p></div><button type="button" class="btn-primary" data-crm-action="tab" data-crm-tab="pipeline">Abrir pipeline</button></div>${tabs()}${content}${forms()}${activityForm(opportunityById(cache.editingOpportunityId))}</section>`;
  }

  async function refresh() {
    cache.loaded = false;
    try { await navigate('crm'); } catch (error) { showToast(error.message || 'No se pudo actualizar el CRM.', 'error'); }
  }

  async function saveLead(form) {
    const values = formValues(form);
    const userId = String(values.user_id || '').trim() || null;
    const whatsapp = String(values.whatsapp || '').trim() || null;
    let existing = null;
    if (userId) existing = cache.leads.find((lead) => String(lead.user_id) === userId);
    if (!existing && whatsapp) existing = cache.leads.find((lead) => normalized(lead.whatsapp) === normalized(whatsapp));
    const payload = { user_id: userId, display_name: String(values.display_name || '').trim(), whatsapp, instagram: String(values.instagram || '').trim() || null, source: String(values.source || 'unknown'), notes: String(values.notes || '').trim() || null };
    if (!payload.display_name) throw new Error('El nombre del prospecto es obligatorio.');
    const result = existing ? await supabase.from('sales_leads').update(payload).eq('id', existing.id) : await supabase.from('sales_leads').insert({ ...payload, first_seen_at: new Date().toISOString() });
    if (result.error) throw result.error;
    showToast(existing ? 'Prospecto actualizado sin duplicarlo.' : 'Prospecto guardado.', 'success');
    await refresh();
  }

  async function saveOpportunity(form) {
    const values = formValues(form);
    const id = String(values.id || '').trim();
    const payload = { lead_id: values.lead_id, service: String(values.service || '').trim() || null, estimated_amount: values.estimated_amount === '' ? null : Number(values.estimated_amount), stage: values.stage, kind: values.kind, source: String(values.source || '').trim() || null, next_followup_at: values.next_followup_at ? new Date(values.next_followup_at).toISOString() : null, notes: String(values.notes || '').trim() || null, closed_at: ['won', 'lost'].includes(values.stage) ? new Date().toISOString() : null };
    if (!payload.lead_id) throw new Error('Selecciona un prospecto.');
    const result = id ? await supabase.from('sales_opportunities').update(payload).eq('id', id) : await supabase.from('sales_opportunities').insert(payload);
    if (result.error) throw result.error;
    showToast(id ? 'Oportunidad actualizada.' : 'Oportunidad creada.', 'success');
    cache.editingOpportunityId = '';
    await refresh();
  }

  async function saveActivity(form) {
    const values = formValues(form);
    const payload = { lead_id: values.lead_id, opportunity_id: values.opportunity_id || null, channel: values.channel, direction: values.direction, activity_type: values.activity_type, summary: String(values.summary || '').trim(), responsible: values.responsible || currentUserName(), next_action: String(values.summary || '').trim() || null, next_followup_at: values.next_followup_at ? new Date(values.next_followup_at).toISOString() : null };
    if (!payload.lead_id || !payload.summary) throw new Error('El resumen y el cliente son obligatorios.');
    const result = await supabase.from('sales_activities').insert(payload);
    if (result.error) throw result.error;
    if (payload.opportunity_id && payload.next_followup_at) await supabase.from('sales_opportunities').update({ next_followup_at: payload.next_followup_at }).eq('id', payload.opportunity_id);
    showToast('Actividad guardada.', 'success');
    await refresh();
  }

  async function changeStage(id, stage) {
    const result = await supabase.from('sales_opportunities').update({ stage, closed_at: ['won', 'lost'].includes(stage) ? new Date().toISOString() : null }).eq('id', id);
    if (result.error) throw result.error;
    showToast(`Oportunidad movida a ${stageLabel(stage)}.`, 'success');
    await refresh();
  }

  async function reactivate(leadId) {
    const lead = leadById(leadId);
    if (!lead) return;
    const existing = cache.opportunities.find((item) => item.lead_id === leadId && OPEN_STAGES.has(item.stage) && item.kind === 'reactivation');
    if (existing) { cache.editingOpportunityId = existing.id; cache.tab = 'pipeline'; await navigate('crm'); return; }
    const result = await supabase.from('sales_opportunities').insert({ lead_id: leadId, kind: 'reactivation', stage: 'prospect', service: 'Reactivación', source: lead.source || 'unknown', notes: 'Oportunidad de reactivación creada desde Clientes.' });
    if (result.error) throw result.error;
    showToast('Oportunidad de reactivación creada.', 'success');
    await refresh();
  }

  function handleClick(event) {
    const button = event.target.closest('[data-crm-action]');
    if (!button) return false;
    const action = button.dataset.crmAction;
    event.preventDefault();
    if (action === 'tab') { cache.tab = button.dataset.crmTab || 'sales'; navigate('crm'); }
    if (action === 'reload') refresh();
    if (action === 'cancel-edit') { cache.editingOpportunityId = ''; navigate('crm'); }
    if (action === 'edit-opportunity') { cache.editingOpportunityId = button.dataset.crmId || ''; cache.tab = 'pipeline'; navigate('crm'); }
    if (action === 'reactivate') reactivate(button.dataset.crmLeadId).catch((error) => showToast(error.message || 'No se pudo reactivar.', 'error'));
    return true;
  }

  function handleChange(event) {
    const stageSelect = event.target.closest('[data-crm-stage-select]');
    if (stageSelect) { changeStage(stageSelect.dataset.crmId, stageSelect.value).catch((error) => showToast(error.message || 'No se pudo cambiar la etapa.', 'error')); return true; }
    const filter = event.target.closest('[data-crm-filter]');
    if (filter) { if (filter.dataset.crmFilter === 'stage') cache.stageFilter = filter.value; if (filter.dataset.crmFilter === 'source') cache.sourceFilter = filter.value; navigate('crm'); return true; }
    return false;
  }

  function handleInput(event) {
    if (event.target.closest('.hr-crm-client-search input')) return true;
    return false;
  }

  function handleSubmit(form) {
    const kind = form.dataset.crmForm;
    if (!kind) return false;
    if (kind === 'client-search') { cache.search = String(formValues(form).search || '').trim(); navigate('crm'); return true; }
    if (kind === 'lead-save') saveLead(form).catch((error) => showToast(error.message || 'No se pudo guardar el prospecto.', 'error'));
    if (kind === 'opportunity-save') saveOpportunity(form).catch((error) => showToast(error.message || 'No se pudo guardar la oportunidad.', 'error'));
    if (kind === 'activity-save') saveActivity(form).catch((error) => showToast(error.message || 'No se pudo guardar la actividad.', 'error'));
    return true;
  }

  return { render, handleClick, handleChange, handleInput, handleSubmit };
}

export { createCrmController };
