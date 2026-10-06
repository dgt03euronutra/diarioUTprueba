import { IndexedDbRecordsRepository } from './database';
import { ACTION_TYPES, localDateString, UT_NAMES } from './models';
import type { RecordsRepository, UtRecord } from './models';

type SortMode = 'recent' | 'action';

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatDate = (value: string): string => {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
    .format(new Date(year, month - 1, day));
};

export function initDiary(container: HTMLElement, repository: RecordsRepository = new IndexedDbRecordsRepository()): void {
  let records: UtRecord[] = [];
  let expanded = new Set<string>();
  let sortMode: SortMode = 'recent';
  let activeDialog: 'form' | UtRecord | null = null;

  const getSortedRecords = (utName: string): UtRecord[] => records
    .filter((record) => record.utName === utName)
    .sort((first, second) => sortMode === 'action'
      ? first.actionType.localeCompare(second.actionType, 'es') || second.date.localeCompare(first.date)
      : second.date.localeCompare(first.date) || second.createdAt - first.createdAt);

  const renderRecordRows = (utName: string): string => {
    const entries = getSortedRecords(utName);
    return entries.length ? entries.map((record) => `<button class="record-row" type="button" data-action="detail" data-id="${escapeHtml(record.id)}" aria-label="Ver ${escapeHtml(record.title)}">
      <time class="record-row__date" datetime="${escapeHtml(record.date)}">${escapeHtml(formatDate(record.date))}</time>
      <span class="action-tag action-tag--${ACTION_TYPES.indexOf(record.actionType)}">${escapeHtml(record.actionType)}</span>
      <span class="record-row__title">${escapeHtml(record.title)}</span>
      <span class="record-row__open" aria-hidden="true">↗</span>
    </button>`).join('') : '<p class="record-list__empty">Sin registros todavía</p>';
  };

  const updateSortedLists = (): void => {
    UT_NAMES.forEach((utName) => {
      const recordList = container.querySelector<HTMLElement>(`#records-${utName.replace(' ', '-')}`);
      if (recordList) recordList.innerHTML = renderRecordRows(utName);
    });
  };

  const render = (): void => {
    const counts = new Map(UT_NAMES.map((name) => [name, records.filter((record) => record.utName === name).length]));
    const sections = UT_NAMES.map((name, index) => {
      const isExpanded = expanded.has(name);
      return `<section class="ut-section" style="--section-index:${index}">
        <div class="ut-section__heading">
          <button class="ut-toggle" type="button" data-action="toggle" data-ut="${name}" aria-expanded="${isExpanded}" aria-controls="records-${name.replace(' ', '-')}">
            <span class="ut-toggle__name">${name}</span>
            <span class="ut-toggle__count">${counts.get(name)} ${counts.get(name) === 1 ? 'registro' : 'registros'}</span>
          </button>
        </div>
        <div class="record-list" id="records-${name.replace(' ', '-')}" ${isExpanded ? '' : 'hidden'}>
          ${renderRecordRows(name)}
        </div>
      </section>`;
    }).join('');

    let dialog = '';
    if (activeDialog === 'form') {
      dialog = `<dialog class="dialog" aria-labelledby="form-heading">
        <button class="dialog__close" type="button" data-action="close" aria-label="Cerrar">×</button>
        <p class="eyebrow">NUEVA ENTRADA</p><h2 id="form-heading">Registrar intervención</h2>
        <form class="record-form">
          <label>Fecha<input name="date" type="date" value="${localDateString()}" required></label>
          <div class="form-grid">
            <label>Nombre de UT<select name="utName" required><option value="" disabled selected>Selecciona una UT</option>${UT_NAMES.map((name) => `<option>${name}</option>`).join('')}</select></label>
            <label>Tipo de acción<select name="actionType" required><option value="" disabled selected>Selecciona un tipo</option>${ACTION_TYPES.map((type) => `<option>${type}</option>`).join('')}</select></label>
          </div>
          <label>Título<input name="title" type="text" maxlength="120" placeholder="Resumen de la intervención" required autocomplete="off"></label>
          <label>Contenido<textarea name="content" rows="6" maxlength="5000" placeholder="Describe el trabajo realizado..." required></textarea></label>
          <div class="dialog__actions"><button class="button button--quiet" type="button" data-action="close">Cancelar</button><button class="button button--primary" type="submit">Guardar registro <span aria-hidden="true">↗</span></button></div>
        </form>
      </dialog>`;
    } else if (activeDialog) {
      dialog = `<dialog class="dialog dialog--detail" aria-labelledby="detail-heading">
        <button class="dialog__close" type="button" data-action="close" aria-label="Cerrar">×</button>
        <p class="eyebrow">${escapeHtml(activeDialog.utName)} <span>·</span> ${escapeHtml(formatDate(activeDialog.date))}</p>
        <span class="action-tag action-tag--${ACTION_TYPES.indexOf(activeDialog.actionType)}">${escapeHtml(activeDialog.actionType)}</span>
        <h2 id="detail-heading">${escapeHtml(activeDialog.title)}</h2>
        <textarea class="detail-content" readonly aria-label="Contenido del registro">${escapeHtml(activeDialog.content)}</textarea>
        <div class="dialog__actions"><button class="button button--primary" type="button" data-action="close">Cerrar</button></div>
      </dialog>`;
    }

    container.innerHTML = `<div class="diary-shell">
      <header class="topbar">
        <a class="brand" href="#" aria-label="Diario UT, inicio"><span class="brand__mark" aria-hidden="true">D</span><span>diario<span class="brand__accent">UT</span></span></a>
        <span class="topbar__context">REGISTRO DE INTERVENCIONES</span>
        <button class="button button--primary create-button" type="button" data-action="new"><span aria-hidden="true">＋</span> Nuevo registro</button>
      </header>
      <main>
        <div class="list-heading">
          <span>UNIDADES DE TRABAJO</span>
          <details class="sort-menu">
            <summary class="sort-menu__trigger"><span>Ordenar</span><strong class="sort-menu__value">${sortMode === 'recent' ? 'Recientes' : 'Tipo de acción'}</strong><span class="sort-menu__caret" aria-hidden="true">⌄</span></summary>
            <div class="sort-menu__options" aria-label="Ordenar todas las UT">
              <button class="sort-menu__option" type="button" data-action="sort" data-sort-mode="recent" aria-pressed="${sortMode === 'recent'}">Recientes</button>
              <button class="sort-menu__option" type="button" data-action="sort" data-sort-mode="action" aria-pressed="${sortMode === 'action'}">Tipo de acción</button>
            </div>
          </details>
        </div>
        <div class="ut-list">${sections}</div>
      </main>
      <footer class="app-footer"><span>DIARIO UT <span>·</span> DATOS LOCALES</span><span><i aria-hidden="true"></i> Guardado en este dispositivo</span></footer>
      ${dialog}
    </div>`;
    if (activeDialog) container.querySelector<HTMLDialogElement>('.dialog')?.showModal();
  };

  const refresh = async (): Promise<void> => {
    records = await repository.listRecords();
    render();
  };

  container.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action]') : null;
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'sort') {
      sortMode = target.dataset.sortMode as SortMode;
      const sortMenu = container.querySelector<HTMLDetailsElement>('.sort-menu');
      if (sortMenu) sortMenu.open = false;
      const selectedValue = container.querySelector<HTMLElement>('.sort-menu__value');
      if (selectedValue) selectedValue.textContent = sortMode === 'recent' ? 'Recientes' : 'Tipo de acción';
      container.querySelectorAll<HTMLButtonElement>('.sort-menu__option').forEach((option) => {
        option.setAttribute('aria-pressed', String(option.dataset.sortMode === sortMode));
      });
      updateSortedLists();
      return;
    }
    if (action === 'new') activeDialog = 'form';
    else if (action === 'close') activeDialog = null;
    else if (action === 'toggle') {
      const utName = target.dataset.ut!;
      if (expanded.has(utName)) expanded.delete(utName);
      else expanded.add(utName);
    } else if (action === 'detail') {
      activeDialog = records.find((record) => record.id === target.dataset.id) ?? null;
    }
    render();
  });

  container.addEventListener('cancel', (event) => {
    if (!(event.target instanceof HTMLDialogElement)) return;
    event.preventDefault();
    activeDialog = null;
    render();
  });

  container.addEventListener('submit', (event) => {
    if (!(event.target instanceof HTMLFormElement) || !event.target.matches('.record-form')) return;
    event.preventDefault();
    const formData = new FormData(event.target);
    const record: UtRecord = {
      id: crypto.randomUUID(),
      date: String(formData.get('date')),
      utName: String(formData.get('utName')) as UtRecord['utName'],
      actionType: String(formData.get('actionType')) as UtRecord['actionType'],
      title: String(formData.get('title')).trim(),
      content: String(formData.get('content')).trim(),
      createdAt: Date.now(),
    };
    void repository.saveRecord(record).then(() => {
      activeDialog = null;
      return refresh();
    });
  });

  void refresh();
}