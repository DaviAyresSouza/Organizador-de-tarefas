'use strict';

(() => {
  const KEY = 'meu_work_os_v2_dados';
  const LEGACY = 'meu_work_os_dados_v1';
  const SETTINGS = 'meu_work_os_v2_preferences';
  const CLOUD_CONFIG = 'meu_work_os_v2_cloud';
  const RECOVERY = 'meu_work_os_v3_recuperacao';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uid = () => crypto.randomUUID?.() || 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  const stamp = () => new Date().toISOString();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const icon = name => `<svg class="ico" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
  const searchText = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR');
  const dateKey = date => [date.getFullYear(), date.getMonth() + 1, date.getDate()].map((part, index) => String(part).padStart(index ? 2 : 4, '0')).join('-');
  const today = () => dateKey(new Date());
  const fmtDate = key => key.split('-').reverse().join('/');
  const fmtBytes = bytes => bytes < 1048576 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
  const statuses = { pendente: 'Não iniciado', andamento: 'Em andamento', feito: 'Concluído', travado: 'Bloqueado' };
  const priorities = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
  const viewTitles = { board: 'Quadro de tarefas', table: 'Lista de tarefas', calendar: 'Calendário' };
  const colorPalette = ['#4973c8', '#8c63be', '#38876d', '#ab6338', '#717e9f'];
  const newGroup = (title, index) => ({ id: uid(), titulo: title, cor: colorPalette[index % colorPalette.length], tarefas: [] });
  const defaultData = () => ({ grupos: ['Para fazer', 'Em produção', 'Concluídos'].map(newGroup) });
  const groupDot = (group, index) => {
    const color = /^#[a-f\d]{6}$/i.test(group.cor) && group.cor.toLowerCase() !== '#ffffff' ? group.cor : colorPalette[index % colorPalette.length];
    return `<span class="dot" style="--group-color:${color}"></span>`;
  };
  const safeUrl = raw => {
    try {
      const url = new URL(raw);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch {
      return '';
    }
  };
  function normalizeDate(value) {
    const key = String(value ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return '';
    const parsed = new Date(key + 'T00:00:00Z');
    return !Number.isNaN(+parsed) && parsed.toISOString().slice(0, 10) === key ? key : '';
  }

  function normalizeTask(task) {
    return {
      id: String(task.id ?? uid()),
      nome: String(task.nome ?? 'Sem título').trim() || 'Sem título',
      status: Object.hasOwn(statuses, task.status) ? task.status : 'pendente',
      prioridade: Object.hasOwn(priorities, task.prioridade) ? task.prioridade : 'media',
      prazo: normalizeDate(task.prazo),
      notas: String(task.notas ?? ''),
      descricao: String(task.descricao ?? ''),
      checklist: Array.isArray(task.checklist) ? task.checklist.filter(Boolean).map(step => ({
        id: String(step.id ?? uid()), texto: String(step.texto ?? ''), feito: Boolean(step.feito)
      })) : [],
      anexos: Array.isArray(task.anexos) ? task.anexos.filter(Boolean).map(file => ({
        id: String(file.id ?? uid()), nome: String(file.nome ?? 'Anexo'), tipo: String(file.tipo ?? 'link'),
        localizacao: ['local', 'cloud', 'url'].includes(file.localizacao) ? file.localizacao : 'url',
        url: safeUrl(file.url), caminho: String(file.caminho ?? ''), tamanho: Math.max(0, Number(file.tamanho) || 0),
        criadoEm: String(file.criadoEm ?? stamp())
      })) : [],
      capa: String(task.capa ?? ''),
      criadoEm: String(task.criadoEm ?? stamp()),
      atualizadoEm: String(task.atualizadoEm ?? stamp())
    };
  }

  function normalizeData(raw) {
    const groups = Array.isArray(raw) ? raw : raw?.grupos;
    if (!Array.isArray(groups)) throw new Error('O JSON precisa conter uma lista de grupos.');
    const groupIds = new Set();
    const taskIds = new Set();
    return {
      grupos: groups.map(group => {
        if (!group || typeof group !== 'object' || Array.isArray(group) || (group.tarefas != null && !Array.isArray(group.tarefas))) {
          throw new Error('Há um grupo inválido no arquivo.');
        }
        const id = String(group.id ?? uid());
        if (groupIds.has(id)) throw new Error('O arquivo contém grupos com o mesmo identificador.');
        groupIds.add(id);
        const tarefas = (group.tarefas || []).map(task => {
          if (!task || typeof task !== 'object' || Array.isArray(task)) throw new Error('Há uma tarefa inválida no arquivo.');
          const normalized = normalizeTask(task);
          if (taskIds.has(normalized.id)) throw new Error('O arquivo contém tarefas com o mesmo identificador.');
          taskIds.add(normalized.id);
          return normalized;
        });
        return { id, titulo: String(group.titulo ?? 'Grupo sem nome'), cor: String(group.cor ?? ''), tarefas };
      })
    };
  }

  function readState(keys = null) {
    if (!keys) {
      keys = [KEY, LEGACY];
      try { if (localStorage.getItem('meu_work_os_v2_legacy_imported')) keys = [KEY]; } catch {}
    }
    for (const key of keys) {
      try {
        const value = localStorage.getItem(key);
        if (value) return normalizeData(JSON.parse(value));
      } catch {
        setTimeout(() => toast('Um arquivo local estava inválido. Verifique seu backup.', true));
      }
    }
    return null;
  }

  const initial = readState();
  let hasSavedWorkspace = Boolean(initial);
  let state = initial || defaultData();
  let preferences = {};
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS));
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) preferences = saved;
  } catch {}
  let view = Object.hasOwn(viewTitles, preferences.view) ? preferences.view : 'board';
  let month = new Date();
  let modalTask = null;
  let modalGroup = null;
  let modalBaseline = '';
  let focusReturn = null;
  let mediaBusy = false;
  let dragging = null;
  let todayOnly = false;
  const filters = { query: '', status: '', priority: '' };
  let localSaved = true;

  const getGroup = id => state.grupos.find(group => group.id === id);
  function findTask(id) {
    for (const group of state.grupos) {
      const index = group.tarefas.findIndex(task => task.id === id);
      if (index >= 0) return { group, task: group.tarefas[index], index };
    }
    return null;
  }
  const allTasks = () => state.grupos.flatMap(group => group.tarefas);
  const overdue = task => task.prazo && task.prazo < today() && task.status !== 'feito';
  function filtered(task) {
    const { query, status, priority } = filters;
    return (!query || searchText([task.nome, task.notas, task.descricao].join(' ')).includes(query)) &&
      (!status || task.status === status) && (!priority || task.prioridade === priority) &&
      (!todayOnly || view === 'calendar' || task.prazo === today());
  }

  function toast(message, error = false) {
    const element = document.createElement('div');
    element.className = error ? 'toast error' : 'toast';
    element.textContent = message;
    const stack = $('#toasts');
    if (stack.children.length >= 2) stack.firstElementChild.remove();
    stack.append(element);
    setTimeout(() => element.remove(), 4800);
  }

  function persist() {
    hasSavedWorkspace = true;
    try {
      localStorage.setItem(cacheKey(), JSON.stringify(state));
      localSaved = true;
    } catch {
      localSaved = false;
      toast('O navegador não conseguiu gravar a cópia local. Exporte um backup.', true);
    }
  }

  function mutate(change) {
    change();
    persist();
    queueSync();
    render();
  }

  function savePreferences() {
    try {
      localStorage.setItem(SETTINGS, JSON.stringify(preferences));
    } catch {
      toast('O navegador não conseguiu salvar as preferências.', true);
    }
  }

  function closeSidebar() {
    $('#sidebar').classList.remove('open');
    $('#sidebar-shade').classList.remove('open');
    $('[data-action="mobile-menu"]').setAttribute('aria-expanded', 'false');
  }

  function setView(next) {
    view = next;
    preferences.view = next;
    savePreferences();
    closeSidebar();
    render();
  }

  function render() {
    const tasks = allTasks();
    $('#workspace-label').textContent = preferences.workspaceName || 'Artes e Conteúdos';
    $('#view-title').textContent = viewTitles[view];
    const count = plural(tasks.length, 'tarefa', 'tarefas');
    const late = tasks.filter(overdue).length;
    const completed = tasks.filter(task => task.status === 'feito').length;
    $('#summary').textContent = tasks.length
      ? `${count} · ${plural(completed, 'concluída', 'concluídas')}${late ? ` · ${plural(late, 'atrasada', 'atrasadas')}` : ''}`
      : 'Nenhuma tarefa cadastrada';
    $('#side-groups').innerHTML = state.grupos.map((group, index) =>
      `<button class="group-jump" data-action="jump-group" data-id="${esc(group.id)}" title="${esc(group.titulo)}">${groupDot(group, index)}<span class="truncate">${esc(group.titulo)}</span><span class="side-count">${group.tarefas.length}</span></button>`
    ).join('');
    $$('[data-switch]').forEach(button => {
      const active = button.dataset.switch === view;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    $('#today-button').classList.toggle('active', todayOnly && view !== 'calendar');
    $('#today-button').setAttribute('aria-pressed', todayOnly && view !== 'calendar' ? 'true' : 'false');
    renderView();
    renderCloudStatus();
  }

  function renderView() {
    if (view === 'calendar') renderCalendar();
    else if (!state.grupos.length) $('#view').innerHTML = `<div class="empty"><h3>Nenhum grupo criado</h3><button class="btn primary" data-action="add-group">${icon('plus')} Criar grupo</button></div>`;
    else if (view === 'board') renderBoard();
    else renderTable();
  }

  function taskCover(task) {
    const file = task.anexos.find(item => item.id === task.capa) || task.anexos.find(item => item.tipo.startsWith('image/'));
    if (!file) return '';
    if (file.tipo.startsWith('video/')) return '<div class="cover-fallback">Vídeo anexado</div>';
    const url = attachmentUrl(file);
    return url && file.tipo.startsWith('image/') ? `<img class="card-cover" src="${esc(url)}" alt="" loading="lazy" draggable="false">` : '';
  }

  function cardHtml(task, group) {
    const done = task.checklist.filter(step => step.feito).length;
    const statusClass = { pendente: '', andamento: 'progress', feito: 'done', travado: 'blocked' };
    return `<article class="kanban-card" draggable="true" role="button" tabindex="0" data-task-id="${esc(task.id)}" data-group-id="${esc(group.id)}" aria-label="Abrir tarefa ${esc(task.nome)}">
      ${taskCover(task)}<div class="card-body">
        <div class="card-top"><span class="tag ${statusClass[task.status]}">${statuses[task.status]}</span>${task.prioridade === 'alta' ? '<span class="tag high">Prioridade alta</span>' : ''}</div>
        <div class="card-title">${esc(task.nome)}</div>
        ${task.descricao ? `<div class="card-descr">${esc(task.descricao)}</div>` : ''}
        <div class="card-bottom">${task.prazo ? `<span class="${overdue(task) ? 'tag overdue' : ''}" title="${overdue(task) ? 'Prazo vencido' : 'Prazo'}">${icon('calendar')} ${fmtDate(task.prazo)}</span>` : ''}${task.anexos.length ? `<span title="Anexos">${icon('clip')} ${task.anexos.length}</span>` : ''}${task.checklist.length ? `<span title="Etapas concluídas">${done}/${task.checklist.length} etapas</span>` : ''}</div>
      </div></article>`;
  }

  function addTaskButton(groupId) {
    return `<button class="add-card" data-action="add-task" data-group="${esc(groupId)}">${icon('plus')} Adicionar tarefa</button>`;
  }

  function groupHeading(group, index) {
    return `${groupDot(group, index)}<h3 title="${esc(group.titulo)}">${esc(group.titulo)}</h3><span class="count">${group.tarefas.filter(filtered).length}</span>`;
  }

  function groupEdit(group) {
    return `<button class="icon-btn" data-action="edit-group" data-id="${esc(group.id)}" aria-label="Editar grupo ${esc(group.titulo)}" title="Editar grupo">${icon('more')}</button>`;
  }

  function renderBoard() {
    const root = $('#view');
    const left = $('.board-scroll')?.scrollLeft || 0;
    const positions = new Map($$('.column-cards').map(item => [item.parentElement.dataset.dropGroup, item.scrollTop]));
    root.innerHTML = `<div class="board-scroll"><div class="board">${state.grupos.map((group, index) =>
      `<section class="column" data-drop-group="${esc(group.id)}" id="group-${esc(group.id)}">
        <header class="column-head">${groupHeading(group, index)}${groupEdit(group)}</header>
        <div class="column-cards">${group.tarefas.filter(filtered).map(task => cardHtml(task, group)).join('') || `<div class="column-empty">${group.tarefas.length ? 'Nenhuma tarefa nesta seleção' : 'Sem tarefas'}</div>`}</div>
        <footer class="column-foot">${addTaskButton(group.id)}</footer>
      </section>`
    ).join('')}<button class="add-column" data-action="add-group">${icon('plus')} Novo grupo</button></div></div>`;
    $('.board-scroll').scrollLeft = left;
    $$('.column-cards').forEach(item => { item.scrollTop = positions.get(item.parentElement.dataset.dropGroup) || 0; });
    for (const card of $$('.kanban-card')) {
      const task = findTask(card.dataset.taskId)?.task;
      const file = task?.anexos.find(item => item.id === task.capa) || task?.anexos.find(item => item.tipo.startsWith('image/'));
      if (!file || !['local', 'cloud'].includes(file.localizacao) || !file.tipo.startsWith('image/') || attachmentUrl(file)) continue;
      getAttachmentUrl(file).then(url => {
        if (url && card.isConnected) card.insertAdjacentHTML('afterbegin', taskCover(task));
      }).catch(() => {});
    }
  }

  const options = (values, selected) => Object.entries(values).map(([key, label]) =>
    `<option value="${esc(key)}"${key === selected ? ' selected' : ''}>${esc(label)}</option>`).join('');

  function renderTable() {
    $('#view').innerHTML = state.grupos.map((group, index) => `<section class="group-panel" id="group-${esc(group.id)}">
      <header class="group-panel-head"><div class="group-title-row">${groupHeading(group, index)}</div>${groupEdit(group)}</header>
      <div class="table-scroll"><table class="data-table"><thead><tr><th>Tarefa</th><th>Status</th><th>Prioridade</th><th>Prazo</th><th>Anexos</th></tr></thead>
      <tbody>${group.tarefas.filter(filtered).map(task => `<tr>
        <td><button class="table-name" data-action="open-task" data-id="${esc(task.id)}">${esc(task.nome)}</button></td>
        <td><select data-task-change="status" data-id="${esc(task.id)}" aria-label="Status de ${esc(task.nome)}">${options(statuses, task.status)}</select></td>
        <td><select data-task-change="prioridade" data-id="${esc(task.id)}" aria-label="Prioridade de ${esc(task.nome)}">${options(priorities, task.prioridade)}</select></td>
        <td><input type="date" data-task-change="prazo" data-id="${esc(task.id)}" value="${esc(task.prazo)}" aria-label="Prazo de ${esc(task.nome)}"></td>
        <td class="muted">${task.anexos.length || '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nenhuma tarefa nesta seleção</td></tr>'}</tbody></table></div>
      <footer class="table-footer">${addTaskButton(group.id)}</footer></section>`).join('');
  }

  function renderCalendar() {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const tasks = allTasks().filter(task => task.prazo && filtered(task));
    const days = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(first.getFullYear(), first.getMonth(), 1 - offset + index);
      const key = dateKey(date);
      const events = tasks.filter(task => task.prazo === key);
      return `<div class="cal-day ${date.getMonth() !== month.getMonth() ? 'other' : ''} ${key === today() ? 'today' : ''}">
        <button class="cal-num" data-action="add-task" data-date="${key}" aria-label="Criar tarefa em ${fmtDate(key)}">${date.getDate()}</button>
        ${events.slice(0, 3).map(task => `<button class="cal-event" data-action="open-task" data-id="${esc(task.id)}" title="${esc(task.nome)}">${esc(task.nome)}</button>`).join('')}
        ${events.length > 3 ? `<button class="cal-more" data-action="day-tasks" data-date="${key}">+${events.length - 3} tarefas</button>` : ''}
      </div>`;
    });
    $('#view').innerHTML = `<section class="calendar-shell">
      <header class="calendar-head"><h3>${new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(month)}</h3>
        <div class="cal-tools"><button class="btn sm icon-only" aria-label="Mês anterior" data-action="calendar-prev">‹</button><button class="btn sm icon-only" aria-label="Próximo mês" data-action="calendar-next">›</button></div>
      </header><div class="calendar-scroll"><div class="calendar-weekdays">${['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => `<div>${day}</div>`).join('')}</div>
      <div class="calendar-grid">${days.join('')}</div></div></section>`;
    if (month.getMonth() === new Date().getMonth() && month.getFullYear() === new Date().getFullYear() && matchMedia('(max-width: 760px)').matches) {
      const scroll = $('.calendar-scroll');
      const current = $('.cal-day.today');
      if (current) scroll.scrollLeft = current.offsetLeft - scroll.offsetLeft - scroll.clientWidth / 2 + current.clientWidth / 2;
    }
  }

  function dialog(title, body, actions = '', wide = false) {
    if (!$('#overlay')) focusReturn = document.activeElement;
    $('#dialog-root').innerHTML = `<div class="overlay" id="overlay"><section class="modal${wide ? ' wide' : ''}" aria-labelledby="dialog-title" role="dialog" aria-modal="true" tabindex="-1">
      <header class="modal-head"><h2 id="dialog-title">${esc(title)}</h2><button class="btn ghost icon-only" data-action="close-dialog" aria-label="Fechar">×</button></header>
      ${body}${actions ? `<footer class="modal-actions">${actions}</footer>` : ''}
    </section></div>`;
    $('#app').inert = true;
    ($('#overlay input:not([type=file]):not([type=checkbox])') || $('.modal')).focus();
  }

  function readDraft() {
    if (!modalTask) return;
    for (const [key, id] of [
      ['nome', 'task-name'], ['descricao', 'task-description'], ['notas', 'task-notes'],
      ['status', 'task-status'], ['prioridade', 'task-priority'], ['prazo', 'task-due'], ['_group', 'task-group']
    ]) {
      const field = $('#' + id);
      if (field) modalTask[key] = field.value;
    }
  }

  function draftChanged() {
    return Boolean(modalTask && (JSON.stringify(modalTask) !== modalBaseline ||
      $('#check-input')?.value.trim() || $('#url-input')?.value.trim()));
  }

  function closeDialog({ force = false } = {}) {
    if (mediaBusy) {
      toast('Aguarde a gravação dos anexos.');
      return false;
    }
    if (!force) {
      readDraft();
      const changedTask = draftChanged();
      const groupName = $('#group-name');
      if ((changedTask || (groupName && groupName.value !== modalBaseline)) && !confirm('Descartar as alterações deste editor?')) return false;
    }
    modalTask = null;
    modalGroup = null;
    modalBaseline = '';
    $('#dialog-root').replaceChildren();
    $('#app').inert = false;
    if (focusReturn?.isConnected) focusReturn.focus();
    else $('.create-button')?.focus();
    focusReturn = null;
    return true;
  }

  const closeButton = '<button class="btn" data-action="close-dialog">Cancelar</button>';

  function showGroupDialog(id = '', createTaskDue = null) {
    const group = getGroup(id);
    modalGroup = { id, createTaskDue };
    modalBaseline = group?.titulo || '';
    dialog(group ? 'Editar grupo' : 'Novo grupo', `<div class="modal-body"><div class="field">
      <label for="group-name">Nome do grupo</label><input id="group-name" maxlength="90" value="${esc(modalBaseline)}" placeholder="Ex.: Em revisão">
    </div></div>`, `${group ? '<button class="btn danger" data-action="delete-group">Excluir grupo</button><span style="flex:1"></span>' : ''}${closeButton}
      <button class="btn primary" data-action="save-group">Salvar grupo</button>`);
  }

  function saveGroup() {
    const name = $('#group-name')?.value.trim();
    if (!name) {
      toast('Informe o nome do grupo.', true);
      $('#group-name')?.focus();
      return;
    }
    const followUp = modalGroup.createTaskDue;
    const group = getGroup(modalGroup.id);
    const created = group || newGroup(name, state.grupos.length);
    mutate(() => {
      if (group) group.titulo = name;
      else state.grupos.push(created);
    });
    closeDialog({ force: true });
    if (followUp !== null) showTaskDialog('', created.id, followUp);
  }

  function deleteGroup() {
    const group = getGroup(modalGroup?.id);
    if (!group || !confirm(`Excluir o grupo “${group.titulo}” e ${plural(group.tarefas.length, 'sua tarefa', 'suas tarefas')}?`)) return;
    mutate(() => { state.grupos = state.grupos.filter(item => item.id !== group.id); });
    closeDialog({ force: true });
    toast('Grupo excluído.');
  }

  function showTaskDialog(id = '', groupId = '', due = '') {
    const found = id ? findTask(id) : null;
    if (id && !found) return;
    if (!state.grupos.length) {
      toast('Crie um grupo para a tarefa.');
      showGroupDialog('', due);
      return;
    }
    modalGroup = null;
    modalTask = found ? normalizeTask(found.task) : { ...normalizeTask({ prazo: due }), nome: '' };
    modalTask._group = found?.group.id || groupId || state.grupos[0].id;
    modalTask._existing = Boolean(found);
    modalBaseline = JSON.stringify(modalTask);
    const task = modalTask;

    dialog(found ? 'Detalhes da tarefa' : 'Nova tarefa', `<div class="modal-body details-layout">
      <div>
        <div class="field"><label for="task-name">Título da tarefa</label><input id="task-name" maxlength="240" required value="${esc(task.nome)}"></div>
        <div class="field"><label for="task-description">Descrição</label><textarea id="task-description" rows="4">${esc(task.descricao)}</textarea></div>
        <div class="field"><label for="task-notes">Notas</label><textarea id="task-notes" rows="2">${esc(task.notas)}</textarea></div>
        <div class="section-title">Checklist <span class="muted" id="check-progress"></span></div>
        <div id="checklist-items"></div>
        <div class="check-add"><input id="check-input" maxlength="200" placeholder="Nova etapa" aria-label="Nova etapa"><button class="btn sm" data-action="check-add" aria-label="Adicionar etapa">${icon('plus')}</button></div>
        <div class="separator"></div>
        <div class="section-title">Anexos</div>
        <div id="attachments" class="attachment-list"></div>
        <label class="dropzone">${icon('clip')} Escolher imagem ou vídeo<input aria-label="Escolher imagens ou vídeos" id="media-input" class="file-input" type="file" accept="image/*,video/*" multiple></label>
        <p class="help">Imagens e vídeos são enviados ao Storage ao sincronizar com sua conta.</p>
        <div class="check-add"><input type="url" id="url-input" placeholder="https://..." aria-label="Link do anexo"><button class="btn sm" data-action="add-url">Adicionar link</button></div>
      </div>
      <aside>
        <div class="field"><label for="task-group">Grupo</label><select id="task-group">${state.grupos.map(group =>
          `<option value="${esc(group.id)}"${task._group === group.id ? ' selected' : ''}>${esc(group.titulo)}</option>`).join('')}</select></div>
        <div class="field"><label for="task-status">Status</label><select id="task-status">${options(statuses, task.status)}</select></div>
        <div class="field"><label for="task-priority">Prioridade</label><select id="task-priority">${options(priorities, task.prioridade)}</select></div>
        <div class="field"><label for="task-due">Prazo</label><input id="task-due" type="date" value="${esc(task.prazo)}"></div>
        ${found ? '<button class="btn danger" data-action="delete-task">Excluir tarefa</button>' : ''}
      </aside>
    </div>`, `${closeButton}<button class="btn primary" data-action="save-task">${found ? 'Salvar alterações' : 'Criar tarefa'}</button>`, true);
    renderChecklist();
    renderAttachments();
  }

  function saveTask() {
    if (!modalTask || mediaBusy) return;
    readDraft();
    const task = modalTask;
    if (!task.nome.trim()) {
      toast('Informe o título da tarefa.', true);
      $('#task-name').focus();
      return;
    }
    const group = getGroup(task._group);
    if (!group) {
      toast('Selecione um grupo.', true);
      return;
    }
    if ($('#check-input').value.trim()) addChecklist();
    if ($('#url-input').value.trim() && !addUrl()) return;
    const found = findTask(task.id);
    const record = normalizeTask({ ...task, atualizadoEm: stamp() });
    mutate(() => {
      if (found?.group === group) group.tarefas[found.index] = record;
      else {
        if (found) found.group.tarefas.splice(found.index, 1);
        group.tarefas.push(record);
      }
    });
    closeDialog({ force: true });
    toast(found ? 'Tarefa atualizada.' : 'Tarefa criada.');
  }

  function deleteTask() {
    if (mediaBusy) return;
    const found = findTask(modalTask?.id);
    if (!found || !confirm('Excluir esta tarefa?')) return;
    mutate(() => { found.group.tarefas.splice(found.index, 1); });
    closeDialog({ force: true });
    toast('Tarefa excluída.');
  }

  function renderChecklist() {
    $('#check-progress').textContent = modalTask.checklist.length ? `(${modalTask.checklist.filter(step => step.feito).length}/${modalTask.checklist.length})` : '';
    $('#checklist-items').innerHTML = modalTask.checklist.map(step => `<div class="check-row${step.feito ? ' checked' : ''}">
      <input type="checkbox" data-step="${esc(step.id)}" aria-label="${esc(step.texto)}"${step.feito ? ' checked' : ''}>
      <span class="check-label">${esc(step.texto)}</span><button class="btn ghost sm" data-action="check-remove" data-id="${esc(step.id)}" aria-label="Remover etapa ${esc(step.texto)}">×</button></div>`).join('');
  }

  function addChecklist() {
    const input = $('#check-input');
    const text = input.value.trim();
    if (!text) return;
    modalTask.checklist.push({ id: uid(), texto: text, feito: false });
    input.value = '';
    renderChecklist();
  }

  const objectUrls = new Map();
  let dbPromise;
  function openMediaDB() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open('MeuWorkOS_V2_Arquivos', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('files');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }).catch(error => {
        dbPromise = null;
        throw error;
      });
    }
    return dbPromise;
  }

  async function mediaRecord(mode, action) {
    const database = await openMediaDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction('files', mode);
      const request = action(transaction.objectStore('files'));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error || new Error('A gravação local foi interrompida.'));
    });
  }

  const signedUrls = new Map();
  function attachmentUrl(file) {
    if (file.localizacao === 'url') return safeUrl(file.url);
    if (file.localizacao === 'local') return objectUrls.get(file.id) || '';
    const cached = signedUrls.get(file.caminho);
    return cached && cached.expiresAt > Date.now() ? cached.url : '';
  }
  async function getAttachmentUrl(file) {
    const cached = attachmentUrl(file);
    if (cached) return cached;
    if (file.localizacao === 'cloud') {
      const active = session;
      if (!active) return '';
      const url = safeUrl(await active.storage.fileUrl(active.user.id, file.caminho));
      if (session !== active || !url) return '';
      signedUrls.set(file.caminho, { url, expiresAt: Date.now() + 240000 });
      return url;
    }
    if (file.localizacao !== 'local') return '';
    const blob = await mediaRecord('readonly', store => store.get(file.id));
    if (!blob) return '';
    if (!objectUrls.has(file.id)) objectUrls.set(file.id, URL.createObjectURL(blob));
    return objectUrls.get(file.id);
  }

  let attachmentRender = 0;
  async function renderAttachments() {
    const root = $('#attachments');
    if (!root || !modalTask) return;
    const renderId = ++attachmentRender;
    const rows = await Promise.all(modalTask.anexos.map(async file => {
      const url = await getAttachmentUrl(file).catch(() => '');
      const image = url && file.tipo.startsWith('image/');
      const label = file.localizacao === 'cloud' ? (url ? 'Supabase Storage' : 'Arquivo indisponível na conta atual') :
        (file.localizacao === 'local' ? (url ? 'Neste navegador' : 'Arquivo indisponível neste navegador') : 'Link externo');
      return `<div class="attachment">
        ${image ? `<img class="attachment-preview" src="${esc(url)}" alt="">` : `<span class="attachment-preview">${icon('clip')}</span>`}
        <div class="attachment-meta"><strong title="${esc(file.nome)}">${esc(file.nome)}</strong><small>${label}${file.tamanho ? ' · ' + fmtBytes(file.tamanho) : ''}</small></div>
        <div class="attachment-actions">
          ${url ? `<button class="btn ghost sm" data-action="view-attachment" data-id="${esc(file.id)}" aria-label="Abrir ${esc(file.nome)}">↗</button>` : ''}
          <button class="btn ghost sm" data-action="remove-attachment" data-id="${esc(file.id)}" aria-label="Remover ${esc(file.nome)}">×</button>
        </div></div>`;
    }));
    if (root.isConnected && renderId === attachmentRender) root.innerHTML = rows.join('') || '<div class="tip">Nenhum anexo</div>';
  }

  async function uploadMedia(input) {
    if (!modalTask || mediaBusy) return;
    const task = modalTask;
    const files = [...input.files];
    input.value = '';
    if (!files.length) return;
    mediaBusy = true;
    input.disabled = true;
    input.closest('.dropzone').classList.add('loading');
    $('[data-action="save-task"]').disabled = true;
    try {
      for (const file of files) {
        if (!/^(image|video)\//.test(file.type) || file.size > 40 * 1024 * 1024) {
          toast(`“${file.name}” precisa ser imagem ou vídeo de até 40 MB.`, true);
          continue;
        }
        const id = uid();
        try {
          await mediaRecord('readwrite', store => store.put(file, id));
          task.anexos.push({ id, nome: file.name, tipo: file.type, localizacao: 'local', url: '', caminho: '', tamanho: file.size, criadoEm: stamp() });
        } catch {
          toast(`O navegador não conseguiu gravar “${file.name}”.`, true);
        }
      }
    } finally {
      mediaBusy = false;
      input.disabled = false;
      input.closest('.dropzone').classList.remove('loading');
      $('[data-action="save-task"]').disabled = false;
      renderAttachments();
    }
  }

  function addUrl() {
    const input = $('#url-input');
    const url = safeUrl(input.value.trim());
    if (!url) {
      toast('Informe um link HTTP ou HTTPS válido.', true);
      input.focus();
      return false;
    }
    const parsed = new URL(url);
    let name = parsed.pathname.split('/').filter(Boolean).at(-1) || parsed.hostname;
    try { name = decodeURIComponent(name); } catch {}
    const type = /\.(png|jpe?g|gif|webp|avif)$/i.test(parsed.pathname) ? 'image/url' :
      (/\.(mp4|webm|mov)$/i.test(parsed.pathname) ? 'video/url' : 'link');
    modalTask.anexos.push({ id: uid(), nome: name.slice(0, 160), tipo: type, localizacao: 'url', url, caminho: '', tamanho: 0, criadoEm: stamp() });
    input.value = '';
    renderAttachments();
    return true;
  }

  function closePreview() {
    const preview = $('#media-preview');
    if (!preview) return;
    const trigger = preview.returnFocus;
    preview.remove();
    $('#overlay').inert = false;
    trigger?.focus();
  }

  async function viewAttachment(id, trigger) {
    const file = modalTask?.anexos.find(item => item.id === id);
    if (!file) return;
    if (file.tipo === 'link' && attachmentUrl(file)) {
      window.open(attachmentUrl(file), '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      const url = await getAttachmentUrl(file);
      if (!trigger.isConnected || $('#media-preview')) return;
      if (!url) throw new Error('Arquivo indisponível neste navegador.');
      const overlay = document.createElement('div');
      overlay.className = 'overlay';
      overlay.id = 'media-preview';
      overlay.style.zIndex = '65';
      overlay.returnFocus = trigger;
      overlay.innerHTML = `<div class="media-panel" role="dialog" aria-modal="true" aria-label="${esc(file.nome)}">
        <button class="btn" data-action="close-preview">Fechar</button>
        ${file.tipo.startsWith('video/') ? `<video class="media-large" src="${esc(url)}" controls playsinline></video>` : `<img class="media-large" src="${esc(url)}" alt="${esc(file.nome)}">`}
      </div>`;
      $('#overlay').inert = true;
      document.body.append(overlay);
      $('button', overlay).focus();
    } catch (error) {
      toast(error.message, true);
    }
  }

  function downloadBackup(data = state, suffix = '') {
    const payload = { formato: 'Meu Work OS', versao: 3, exportadoEm: stamp(), grupos: data.grupos };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `meu-work-os${suffix}-${today()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('Backup JSON exportado.');
  }

  function getRecovery() {
    const keys = session ? [recoveryKey()] : [RECOVERY, 'meu_work_os_v2_backup_antes_da_nuvem', 'meu_work_os_v2_backup_pre_importacao'];
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value) return normalizeData(JSON.parse(value));
    }
    return null;
  }

  async function importBackup(input) {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    try {
      const data = normalizeData(JSON.parse(await file.text()));
      if (!confirm('Substituir as tarefas atuais pelas tarefas deste backup?')) return;
      if (hasSavedWorkspace) rememberVersion(state);
      mutate(() => { state = data; });
      toast('Backup importado. Os arquivos de mídia usam o armazenamento de origem.');
    } catch (error) {
      toast(`Falha na importação. ${error.message}`, true);
    }
  }

  let connection = null;
  let session = null;
  let syncTimer;
  let syncBusy = false;
  let syncError = '';
  let conflict = false;
  let candidate = null;
  let cloudConfig = null;
  const snapshot = () => JSON.stringify(state);
  const cacheKey = () => session?.cacheKey || KEY;
  const recoveryKey = () => session ? session.cacheKey + ':recovery' : RECOVERY;

  function renderCloudStatus() {
    let label = 'Modo local';
    let kind = 'local';
    if (syncBusy) {
      label = 'Sincronizando';
      kind = 'pending';
    } else if (conflict || syncError) {
      label = conflict ? 'Revisar versões' : 'Falha na sincronização';
      kind = 'error';
    } else if (session) {
      const dirty = session.snapshot !== snapshot();
      label = dirty ? 'Envio pendente' : 'Supabase conectado';
      kind = dirty ? 'pending' : 'online';
    }
    $('#cloud-text').textContent = label;
    $('#cloud-pill').dataset.kind = kind;
  }

  function queueSync() {
    clearTimeout(syncTimer);
    if (!session?.initialized || syncBusy || conflict || syncError) return;
    syncTimer = setTimeout(pushChanges, 1300);
  }

  function syncMessage(error) {
    if (error.code === 'PGRST205' || error.code === '42501') return 'Verifique se o script supabase_setup.sql foi aplicado e se a conta tem acesso ao quadro.';
    if (error.code === 'invalid_credentials') return 'Confira o e-mail e a senha.';
    if (error.code === 'email_not_confirmed') return 'Confirme seu e-mail antes de entrar.';
    const message = error.message || '';
    if (error instanceof TypeError || /failed to fetch|networkerror|timeout/i.test(message)) return 'Conexão com o Supabase indisponível. As alterações permanecem neste navegador.';
    return message || 'A sincronização não foi concluída.';
  }

  async function uploadPendingFiles(target, data) {
    const uploaded = new Map();
    for (const group of data.grupos) {
      for (const task of group.tarefas) {
        for (const file of task.anexos) {
          if (file.localizacao !== 'local') continue;
          const blob = await mediaRecord('readonly', store => store.get(file.id));
          if (!blob) continue;
          if (target !== session) return uploaded;
          file.caminho = await target.storage.putFile(target.user.id, file, blob);
          file.localizacao = 'cloud';
          uploaded.set(file.id, file.caminho);
        }
      }
    }
    return uploaded;
  }

  function applyUploadedFiles(uploaded) {
    const update = task => {
      for (const file of task.anexos) {
        if (file.localizacao !== 'local' || !uploaded.has(file.id)) continue;
        file.caminho = uploaded.get(file.id);
        file.localizacao = 'cloud';
      }
    };
    allTasks().forEach(update);
    if (modalTask) {
      const baseline = JSON.parse(modalBaseline);
      update(baseline);
      update(modalTask);
      modalBaseline = JSON.stringify(baseline);
      renderAttachments();
    }
    if (uploaded.size) persist();
  }

  async function pushChanges() {
    if (!session?.initialized || syncBusy || conflict) return false;
    const current = session;
    const pending = snapshot();
    if (current.snapshot === pending && current.version !== null) return true;
    syncError = '';
    syncBusy = true;
    renderCloudStatus();
    try {
      const data = JSON.parse(pending);
      const uploaded = await uploadPendingFiles(current, data);
      if (current !== session) return false;
      current.version = await current.storage.save(current.user.id, data, current.version);
      if (current !== session) return false;
      current.snapshot = JSON.stringify(data);
      if (uploaded.size) applyUploadedFiles(uploaded);
      return true;
    } catch (error) {
      if (current !== session) return false;
      if (error instanceof WorkOSConflict) conflict = true;
      else syncError = syncMessage(error);
      toast(conflict ? 'Outra versão foi encontrada no Supabase. Abra a sincronização para revisar.' : syncError, true);
      return false;
    } finally {
      syncBusy = false;
      renderCloudStatus();
      if (current === session && !conflict && !syncError && current.snapshot !== snapshot()) queueSync();
    }
  }

  function showSyncDialog() {
    candidate = null;
    const connected = session ? `<p class="alert">Conta <strong>${esc(session.user.email || 'Supabase')}</strong></p>` : '';
    const config = `<div class="field"><label for="sb-url">URL do projeto Supabase</label><input id="sb-url" type="url" autocomplete="off" placeholder="https://seu-projeto.supabase.co" value="${esc(cloudConfig?.url)}"></div>
      <div class="field"><label for="sb-key">Chave pública do projeto</label><input id="sb-key" autocomplete="off" placeholder="sb_publishable_..." value="${esc(cloudConfig?.key)}">
      <p class="help">Use a chave publishable ou anon do projeto.</p></div>`;
    const login = `<div class="field"><label for="auth-email">E-mail</label><input id="auth-email" type="email" autocomplete="username"></div>
      <div class="field"><label for="auth-password">Senha</label><input id="auth-password" type="password" autocomplete="current-password"></div>
      <details><summary>Configuração do projeto</summary>${config}<button class="btn sm" data-action="save-supabase">Salvar configuração</button></details>`;
    const actions = session ? `<button class="btn" data-action="disconnect">Sair da conta</button><button class="btn primary" data-action="sync-now">${conflict ? 'Revisar versões' : 'Sincronizar agora'}</button>` :
      (cloudConfig ? `${closeButton}<button class="btn" data-action="signup">Criar conta</button><button class="btn primary" data-action="connect">Entrar</button>` :
        `${closeButton}<button class="btn primary" data-action="save-supabase">Salvar configuração</button>`);
    let recovery = '';
    try {
      if (getRecovery()) recovery = '<button class="btn sm" data-action="recovery">Exportar versão anterior</button>';
    } catch {}
    dialog('Sincronização com Supabase', `<div class="modal-body">${connected}
      ${syncError ? `<p class="alert warning">${esc(syncError)}</p>` : ''}
      ${conflict ? '<p class="alert warning">As versões deste navegador e do Supabase precisam de revisão.</p>' : ''}
      ${session ? '<p class="tip">Tarefas e mídias sincronizam com sua conta. Uma cópia das tarefas fica neste navegador.</p>' : (cloudConfig ? login : config)}
      ${recovery}<p id="sync-feedback" class="help" role="status"></p></div>`, actions);
  }

  function rememberVersion(data) {
    try {
      localStorage.setItem(recoveryKey(), JSON.stringify(data));
    } catch {
      downloadBackup(data, '-recuperacao');
    }
  }

  function takeRemote(data) {
    if (snapshot() !== JSON.stringify(data) && hasSavedWorkspace) rememberVersion(state);
    state = data;
    persist();
  }

  function showSyncChoice(target, remote) {
    candidate = { target, remote };
    dialog('Revisar versões', `<div class="modal-body">
      <p class="alert warning">Escolha qual quadro usar. Você pode baixar a versão substituída na janela de sincronização.</p>
      <p><strong>Neste navegador</strong> · ${plural(allTasks().length, 'tarefa', 'tarefas')}</p>
      <p><strong>No Supabase</strong> · ${plural(remote.data?.grupos.reduce((total, group) => total + group.tarefas.length, 0) || 0, 'tarefa', 'tarefas')}</p>
    </div>`, `${closeButton}<button class="btn" data-action="choose-local">Enviar versão local</button>${remote.data ? '<button class="btn primary" data-action="choose-remote">Usar versão do Supabase</button>' : ''}`);
  }

  async function refreshSync({ automatic = false } = {}) {
    if (syncBusy || !session) return;
    const target = session;
    clearTimeout(syncTimer);
    const feedback = $('#sync-feedback');
    if (feedback) feedback.textContent = 'Consultando o Supabase…';
    syncBusy = true;
    let readyToPush = false;
    renderCloudStatus();
    try {
      const remote = await target.storage.load(target.user.id);
      if (target !== session) return;
      if (remote.data !== null) remote.data = normalizeData(remote.data);
      const remoteSnapshot = remote.data ? JSON.stringify(remote.data) : null;
      const local = snapshot();
      const matches = remoteSnapshot === local;
      const remoteMoved = target.version !== remote.version;
      const localChanged = target.snapshot !== local;
      const mustChoose = !matches && (
        (!target.initialized && Boolean(remote.data) && hasSavedWorkspace) ||
        (target.initialized && remoteMoved && (localChanged || !remote.data)) ||
        (remote.data && remoteMoved && Boolean(modalTask || modalGroup))
      );
      if (mustChoose) {
        conflict = true;
        syncError = '';
        if (!$('#overlay') || feedback?.isConnected) showSyncChoice(target, remote);
        return;
      }
      conflict = false;
      syncError = '';
      if (remote.data && !matches && (!target.initialized || remoteMoved)) takeRemote(remote.data);
      else if (matches) persist();
      target.version = remote.version;
      target.snapshot = remoteSnapshot;
      target.initialized = true;
      readyToPush = target.snapshot !== snapshot();
      if (feedback?.isConnected) closeDialog({ force: true });
      render();
    } catch (error) {
      if (target !== session) return;
      syncError = syncMessage(error);
      if (feedback?.isConnected) feedback.textContent = syncError;
      else if (!automatic) toast(syncError, true);
    } finally {
      syncBusy = false;
      renderCloudStatus();
    }
    if (target !== session || syncError) return;
    if ((!readyToPush || await pushChanges()) && !automatic) toast('Tarefas sincronizadas com o Supabase.');
  }

  async function chooseSync(useRemote) {
    if (!candidate || syncBusy || candidate.target !== session) return;
    const { target, remote } = candidate;
    if (!useRemote && remote.data && !confirm('Substituir a versão atual do Supabase pelas tarefas deste navegador?')) return;
    target.version = remote.version;
    target.snapshot = remote.data ? JSON.stringify(remote.data) : null;
    target.initialized = true;
    candidate = null;
    conflict = false;
    syncError = '';
    if (useRemote && remote.data) takeRemote(remote.data);
    else {
      if (remote.data) rememberVersion(remote.data);
      persist();
    }
    closeDialog({ force: true });
    render();
    if (useRemote || await pushChanges()) toast('Tarefas sincronizadas com o Supabase.');
  }

  function activateAccount(storage, user) {
    const accountKey = `${KEY}:supabase:${cloudConfig.url}:${user.id}`;
    const cached = readState([accountKey]);
    if (cached) {
      state = cached;
      hasSavedWorkspace = true;
      localSaved = true;
    }
    session = { storage, user, cacheKey: accountKey, version: null, snapshot: null, initialized: false };
    render();
  }

  function resetAccount() {
    clearTimeout(syncTimer);
    session = null;
    candidate = null;
    conflict = false;
    syncError = '';
    signedUrls.clear();
    const offline = readState();
    state = offline || defaultData();
    hasSavedWorkspace = Boolean(offline);
    localSaved = true;
    render();
  }

  function openConnection() {
    const storage = new SupabaseStorage(cloudConfig);
    connection = storage;
    storage.client.auth.onAuthStateChange(event => {
      if (event !== 'SIGNED_OUT') return;
      setTimeout(() => leaveExternalSession(storage), 0);
    });
    return storage;
  }

  function leaveExternalSession(storage) {
    if (session?.storage !== storage) return;
    if (mediaBusy) {
      setTimeout(() => leaveExternalSession(storage), 100);
      return;
    }
    closePreview();
    closeDialog({ force: true });
    resetAccount();
  }

  async function restoreSession() {
    if (!cloudConfig || syncBusy) return;
    syncBusy = true;
    renderCloudStatus();
    const locked = !$('#overlay');
    if (locked) $('#app').inert = true;
    try {
      const storage = openConnection();
      const { data, error } = await storage.client.auth.getSession();
      if (error) throw error;
      if (data.session?.user && connection === storage) activateAccount(storage, data.session.user);
    } catch (error) {
      syncError = syncMessage(error);
    } finally {
      syncBusy = false;
      if (locked) $('#app').inert = false;
      renderCloudStatus();
    }
    if (session) refreshSync({ automatic: true });
  }

  function saveSupabaseConfig() {
    if (syncBusy) return;
    try {
      const config = SupabaseStorage.configuration($('#sb-url').value.trim(), $('#sb-key').value.trim());
      localStorage.setItem(CLOUD_CONFIG, JSON.stringify(config));
      cloudConfig = config;
      connection = null;
      syncError = '';
      showSyncDialog();
      restoreSession();
    } catch (error) {
      $('#sync-feedback').textContent = error.message || 'Confira a configuração do projeto.';
    }
  }

  async function loginSupabase(signup = false) {
    if (!cloudConfig || syncBusy || session) return;
    const email = $('#auth-email').value.trim();
    const passwordInput = $('#auth-password');
    const password = passwordInput.value;
    const feedback = $('#sync-feedback');
    if (!email || !password) {
      feedback.textContent = 'Informe seu e-mail e sua senha.';
      return;
    }
    syncBusy = true;
    renderCloudStatus();
    try {
      const storage = connection || openConnection();
      const credentials = { email, password };
      const { data, error } = signup ? await storage.client.auth.signUp(credentials) :
        await storage.client.auth.signInWithPassword(credentials);
      if (error) throw error;
      connection = storage;
      passwordInput.value = '';
      if (!data.session?.user) {
        if (feedback.isConnected) feedback.textContent = 'Confira seu e-mail para confirmar a conta e depois entre no app.';
        return;
      }
      activateAccount(storage, data.session.user);
    } catch (error) {
      if (feedback.isConnected) feedback.textContent = syncMessage(error);
    } finally {
      syncBusy = false;
      renderCloudStatus();
    }
    if (session) refreshSync();
  }

  async function disconnectSync() {
    if (syncBusy || !session) return;
    const current = session;
    if (!localSaved) {
      toast('Exporte um backup das tarefas antes de sair da conta.', true);
      return;
    }
    syncBusy = true;
    renderCloudStatus();
    try {
      const { error } = await current.storage.client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      closeDialog({ force: true });
      if (session === current) resetAccount();
      toast('Sessão encerrada. Sua cópia sincronizada fica disponível ao entrar novamente.');
    } catch (error) {
      toast(syncMessage(error), true);
    } finally {
      syncBusy = false;
      renderCloudStatus();
    }
  }

  function closeWorkspaceMenu() {
    $('#workspace-menu').classList.add('hidden');
    $('#workspace-toggle').setAttribute('aria-expanded', 'false');
  }

  function showDay(key) {
    const tasks = allTasks().filter(task => task.prazo === key && filtered(task));
    dialog(`Tarefas de ${fmtDate(key)}`, `<div class="modal-body">${tasks.map(task =>
      `<button class="cal-event" data-action="open-task" data-id="${esc(task.id)}">${esc(task.nome)}</button>`).join('')}</div>`,
      `<button class="btn primary" data-action="add-task" data-date="${key}">${icon('plus')} Nova tarefa</button>`);
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('#workspace-picker')) closeWorkspaceMenu();
    if (event.target.id === 'overlay') { candidate = null; closeDialog(); }
    if (event.target.id === 'media-preview') closePreview();
    const button = event.target.closest('[data-action],[data-switch]');
    if (!button) {
      const card = event.target.closest('.kanban-card');
      if (card && !dragging) showTaskDialog(card.dataset.taskId);
      return;
    }
    if (button.dataset.switch) {
      setView(button.dataset.switch);
      return;
    }
    const { action, id, group, date } = button.dataset;
    switch (action) {
      case 'mobile-menu': {
        const open = $('#sidebar').classList.toggle('open');
        $('#sidebar-shade').classList.toggle('open', open);
        button.setAttribute('aria-expanded', String(open));
        if (open) $('.side-nav button').focus();
        break;
      }
      case 'workspace-menu': {
        const menu = $('#workspace-menu');
        const open = menu.classList.toggle('hidden') === false;
        button.setAttribute('aria-expanded', String(open));
        if (open) {
          $('#workspace-name').value = preferences.workspaceName || 'Artes e Conteúdos';
          $('#workspace-name').focus();
        }
        break;
      }
      case 'save-workspace': {
        const name = $('#workspace-name').value.trim();
        if (!name) {
          toast('Informe o nome do espaço de trabalho.', true);
          return;
        }
        preferences.workspaceName = name;
        savePreferences();
        $('#workspace-label').textContent = name;
        closeWorkspaceMenu();
        $('#workspace-toggle').focus();
        break;
      }
      case 'toolbar-today':
        if (view === 'calendar') month = new Date();
        else todayOnly = !todayOnly;
        render();
        break;
      case 'add-group': closeSidebar(); showGroupDialog(); break;
      case 'edit-group': showGroupDialog(id); break;
      case 'save-group': saveGroup(); break;
      case 'delete-group': deleteGroup(); break;
      case 'add-task': showTaskDialog('', group, date); break;
      case 'open-task': showTaskDialog(id); break;
      case 'save-task': saveTask(); break;
      case 'delete-task': deleteTask(); break;
      case 'close-dialog': candidate = null; closeDialog(); break;
      case 'check-add': addChecklist(); $('#check-input').focus(); break;
      case 'check-remove':
        modalTask.checklist = modalTask.checklist.filter(step => step.id !== id);
        renderChecklist();
        $('#check-input').focus();
        break;
      case 'remove-attachment':
        modalTask.anexos = modalTask.anexos.filter(file => file.id !== id);
        if (modalTask.capa === id) modalTask.capa = '';
        renderAttachments();
        $('#media-input').focus();
        break;
      case 'view-attachment': viewAttachment(id, button); break;
      case 'close-preview': closePreview(); break;
      case 'add-url': if (addUrl()) $('#url-input').focus(); break;
      case 'backup': closeSidebar(); downloadBackup(); break;
      case 'import': closeSidebar(); $('#import-input').click(); break;
      case 'recovery':
        try { const previous = getRecovery(); if (previous) downloadBackup(previous, '-recuperacao'); }
        catch { toast('A versão anterior está indisponível.', true); }
        break;
      case 'cloud': showSyncDialog(); break;
      case 'connect': loginSupabase(); break;
      case 'signup': loginSupabase(true); break;
      case 'save-supabase': saveSupabaseConfig(); break;
      case 'disconnect': disconnectSync(); break;
      case 'sync-now': refreshSync(); break;
      case 'choose-remote': chooseSync(true); break;
      case 'choose-local': chooseSync(false); break;
      case 'calendar-prev':
      case 'calendar-next':
        month = new Date(month.getFullYear(), month.getMonth() + (action === 'calendar-prev' ? -1 : 1), 1);
        renderCalendar();
        $(`[data-action="${action}"]`).focus();
        break;
      case 'day-tasks': showDay(date); break;
      case 'jump-group':
        if (view === 'calendar') setView('board');
        closeSidebar();
        document.getElementById('group-' + id)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        break;
    }
  });

  document.addEventListener('change', event => {
    const input = event.target;
    if (input.id === 'import-input') importBackup(input);
    else if (input.id === 'media-input') uploadMedia(input);
    else if (input.dataset.step && modalTask) {
      const step = modalTask.checklist.find(item => item.id === input.dataset.step);
      if (step) step.feito = input.checked;
      renderChecklist();
      $$('[data-step]').find(item => item.dataset.step === input.dataset.step)?.focus();
    } else if (input.dataset.taskChange) {
      const found = findTask(input.dataset.id);
      if (!found) return;
      const { taskChange, id } = input.dataset;
      const value = taskChange === 'prazo' ? normalizeDate(input.value) : input.value;
      mutate(() => {
        found.task[taskChange] = value;
        found.task.atualizadoEm = stamp();
      });
      $$('[data-task-change]').find(field => field.dataset.id === id && field.dataset.taskChange === taskChange)?.focus();
    }
  });

  document.addEventListener('keydown', event => {
    const activeOverlay = $('#media-preview') || $('#overlay');
    if (event.key === 'Escape') {
      if ($('#media-preview')) closePreview();
      else if ($('#overlay')) { candidate = null; closeDialog(); }
      else {
        closeWorkspaceMenu();
        if ($('#sidebar').classList.contains('open')) {
          closeSidebar();
          $('[data-action="mobile-menu"]').focus();
        }
      }
      return;
    }
    if (event.key === 'Tab' && activeOverlay) {
      const focusable = $$('button:not(:disabled), input:not(:disabled), select, textarea, video[controls], a[href]', activeOverlay);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || !focusable.includes(document.activeElement))) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    const id = event.target.id;
    if (event.key === 'Enter' && id === 'check-input') addChecklist();
    else if (event.key === 'Enter' && id === 'group-name') saveGroup();
    else if (event.key === 'Enter' && id === 'url-input') addUrl();
    else if (event.key === 'Enter' && id === 'workspace-name') $('[data-action="save-workspace"]').click();
    else if (event.key === 'Enter' && id === 'auth-password') $('[data-action="connect"]').click();
    else if (['Enter', ' '].includes(event.key) && event.target.matches('.kanban-card')) {
      event.preventDefault();
      showTaskDialog(event.target.dataset.taskId);
    }
  });

  $('#search').addEventListener('input', event => {
    filters.query = searchText(event.target.value.trim());
    renderView();
  });
  $('#status-filter').addEventListener('change', event => {
    filters.status = event.target.value;
    renderView();
  });
  $('#priority-filter').addEventListener('change', event => {
    filters.priority = event.target.value;
    renderView();
  });
  $('#sidebar-shade').addEventListener('click', () => {
    closeSidebar();
    $('[data-action="mobile-menu"]').focus();
  });

  function finishDrag() {
    dragging = null;
    $$('.dragging,.drag-over,.over').forEach(element => element.classList.remove('dragging', 'drag-over', 'over'));
  }

  document.addEventListener('dragstart', event => {
    const card = event.target.closest('.kanban-card');
    if (!card) return;
    dragging = card.dataset.taskId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', dragging);
    card.classList.add('dragging');
  });

  document.addEventListener('dragover', event => {
    const column = event.target.closest('[data-drop-group]');
    if (!column || !dragging) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    $$('.drag-over,.over').forEach(element => element.classList.remove('drag-over', 'over'));
    column.classList.add('drag-over');
    event.target.closest('.kanban-card')?.classList.add('over');
  });

  document.addEventListener('drop', event => {
    const column = event.target.closest('[data-drop-group]');
    if (!column || !dragging) return;
    event.preventDefault();
    const found = findTask(dragging);
    const destination = getGroup(column.dataset.dropGroup);
    const target = event.target.closest('.kanban-card')?.dataset.taskId;
    if (found && destination && target !== dragging) {
      mutate(() => {
        found.group.tarefas.splice(found.index, 1);
        const index = destination.tarefas.findIndex(task => task.id === target);
        if (index === -1) destination.tarefas.push(found.task);
        else destination.tarefas.splice(index, 0, found.task);
        found.task.atualizadoEm = stamp();
      });
    }
    finishDrag();
  });
  document.addEventListener('dragend', finishDrag);

  window.addEventListener('beforeunload', event => {
    readDraft();
    if (!localSaved || draftChanged() || mediaBusy) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  try {
    const saved = JSON.parse(localStorage.getItem(CLOUD_CONFIG));
    if (saved) cloudConfig = SupabaseStorage.configuration(saved.url, saved.key);
  } catch {}
  render();
  restoreSession();
})();
