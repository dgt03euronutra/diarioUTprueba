import { IndexedDbRecordsRepository } from './database';
import { ACTION_TYPES, localDateString, UT_NAMES } from './models';
import type { RecordsRepository, UtRecord } from './models';

type SortMode = 'recent' | 'action';
type DialogState = 'record-form' | 'record-detail' | 'record-confirm-update' | 'record-confirm-delete' | 'unit-manager' | 'unit-form' | 'unit-confirm-rename' | 'unit-confirm-delete' | null;

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

const unitId = (name: string): string => Array.from(name)
  .map((character) => character.codePointAt(0)!.toString(16))
  .join('-');

export function initDiary(container: HTMLElement, repository: RecordsRepository = new IndexedDbRecordsRepository()): void {
  let records: UtRecord[] = [];
  let units: string[] = [...UT_NAMES];
  let expanded = new Set<string>();
  let sortMode: SortMode = 'recent';
  let activeDialog: DialogState = null;
  let selectedRecordId: string | null = null;
  let editingRecordId: string | null = null;
  let pendingRecord: UtRecord | null = null;
  let editingUnitName: string | null = null;
  let pendingUnitName: string | null = null;
  let unitFormError: string | null = null;

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
    units.forEach((name) => {
      const recordList = container.querySelector<HTMLElement>(`#records-${unitId(name)}`);
      if (recordList) recordList.innerHTML = renderRecordRows(name);
    });
  };

  const render = (): void => {
    const counts = new Map(units.map((name) => [name, records.filter((record) => record.utName === name).length]));
    const sections = units.map((name, index) => {
      const isExpanded = expanded.has(name);
      const recordsId = `records-${unitId(name)}`;
      return `<section class="ut-section" style="--section-index:${index}">
        <div class="ut-section__heading">
          <button class="ut-toggle" type="button" data-action="toggle" data-ut="${escapeHtml(name)}" aria-expanded="${isExpanded}" aria-controls="${recordsId}" aria-label="${isExpanded ? 'Contraer' : 'Desplegar'} ${escapeHtml(name)}, ${counts.get(name)} ${counts.get(name) === 1 ? 'registro' : 'registros'}">
            <span class="ut-toggle__name">${escapeHtml(name)}</span>
            <span class="ut-toggle__count">${counts.get(name)} ${counts.get(name) === 1 ? 'registro' : 'registros'}</span>
          </button>
        </div>
        <div class="record-list" id="${recordsId}" data-ut="${escapeHtml(name)}" ${isExpanded ? '' : 'hidden'}>${renderRecordRows(name)}</div>
      </section>`;
    }).join('');

    let dialog = '';
    const recordBeingEdited = editingRecordId
      ? pendingRecord ?? records.find((record) => record.id === editingRecordId) ?? null
      : null;
    const recordInDetail = records.find((record) => record.id === selectedRecordId) ?? null;

    if (activeDialog === 'record-form') {
      dialog = `<dialog class="dialog" aria-labelledby="form-heading">
        <button class="dialog__close" type="button" data-action="close" aria-label="Cerrar">×</button>
        <p class="eyebrow">${recordBeingEdited ? 'EDITAR ENTRADA' : 'NUEVA ENTRADA'}</p>
        <h2 id="form-heading">${recordBeingEdited ? 'Corregir intervención' : 'Registrar intervención'}</h2>
        <form class="record-form">
          <label>Fecha<input name="date" type="date" value="${escapeHtml(recordBeingEdited?.date ?? localDateString())}" required></label>
          <div class="form-grid">
            <label>Nombre de UT<select name="utName" required><option value="" disabled ${recordBeingEdited ? '' : 'selected'}>Selecciona una UT</option>${units.map((name) => `<option value="${escapeHtml(name)}" ${recordBeingEdited?.utName === name ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('')}</select></label>
            <label>Tipo de acción<select name="actionType" required><option value="" disabled ${recordBeingEdited ? '' : 'selected'}>Selecciona un tipo</option>${ACTION_TYPES.map((type) => `<option value="${escapeHtml(type)}" ${recordBeingEdited?.actionType === type ? 'selected' : ''}>${escapeHtml(type)}</option>`).join('')}</select></label>
          </div>
          <label>Título<input name="title" type="text" maxlength="120" value="${escapeHtml(recordBeingEdited?.title ?? '')}" placeholder="Resumen de la intervención" required autocomplete="off"></label>
          <label>¿Qué ha ocurrido?<textarea name="whatHappened" rows="4" maxlength="5000" placeholder="Describe qué ha ocurrido..." required>${escapeHtml(recordBeingEdited?.whatHappened ?? recordBeingEdited?.content ?? '')}</textarea></label>
          <label>¿Cómo se ha solucionado?<textarea name="howResolved" rows="4" maxlength="5000" placeholder="Describe cómo se ha solucionado..." required>${escapeHtml(recordBeingEdited?.howResolved ?? '')}</textarea></label>
          <div class="dialog__actions"><button class="button button--quiet" type="button" data-action="close">Cancelar</button><button class="button button--primary" type="submit">${recordBeingEdited ? 'Guardar cambios' : 'Guardar registro'} <span aria-hidden="true">↗</span></button></div>
        </form>
      </dialog>`;
    } else if (activeDialog === 'record-detail' && recordInDetail) {
      const whatHappened = recordInDetail.whatHappened ?? recordInDetail.content ?? '';
      const howResolved = recordInDetail.howResolved ?? '';
      dialog = `<dialog class="dialog dialog--detail" aria-labelledby="detail-heading">
        <button class="dialog__close" type="button" data-action="close" aria-label="Cerrar">×</button>
        <p class="eyebrow">${escapeHtml(recordInDetail.utName)} <span>·</span> ${escapeHtml(formatDate(recordInDetail.date))}</p>
        <span class="action-tag action-tag--${ACTION_TYPES.indexOf(recordInDetail.actionType)}">${escapeHtml(recordInDetail.actionType)}</span>
        <h2 id="detail-heading">${escapeHtml(recordInDetail.title)}</h2>
        <div class="detail-content">
          <section class="detail-content__section"><h3>¿Qué ha ocurrido?</h3><p>${escapeHtml(whatHappened) || 'Sin información registrada.'}</p></section>
          <section class="detail-content__section"><h3>¿Cómo se ha solucionado?</h3><p>${escapeHtml(howResolved) || 'Sin información registrada.'}</p></section>
        </div>
        <div class="dialog__actions dialog__actions--spread"><button class="button button--danger" type="button" data-action="delete-record">Eliminar</button><span class="dialog__actions-group"><button class="button button--quiet" type="button" data-action="edit-record">Editar</button><button class="button button--primary" type="button" data-action="close">Cerrar</button></span></div>
      </dialog>`;
    } else if (activeDialog === 'unit-manager') {
      dialog = `<dialog class="dialog dialog--units" aria-labelledby="units-heading">
        <button class="dialog__close" type="button" data-action="close" aria-label="Cerrar">×</button>
        <p class="eyebrow">CONFIGURACIÓN</p><h2 id="units-heading">Gestionar UT</h2>
        <div class="unit-manager-list">${units.map((name) => `<div class="unit-manager-row">
          <div class="unit-manager-row__identity"><strong>${escapeHtml(name)}</strong><span>${counts.get(name)} ${counts.get(name) === 1 ? 'registro' : 'registros'}</span></div>
          <div class="unit-manager-row__actions"><button class="icon-button" type="button" data-action="edit-unit" data-ut="${escapeHtml(name)}" aria-label="Editar ${escapeHtml(name)}" title="Editar UT">✎</button><button class="icon-button icon-button--danger" type="button" data-action="delete-unit" data-ut="${escapeHtml(name)}" aria-label="Eliminar ${escapeHtml(name)}" title="Eliminar UT">×</button></div>
        </div>`).join('')}</div>
        <div class="dialog__actions"><button class="button button--quiet" type="button" data-action="close">Cerrar</button><button class="button button--primary" type="button" data-action="new-unit">Añadir UT <span aria-hidden="true">＋</span></button></div>
      </dialog>`;
    } else if (activeDialog === 'unit-form') {
      const isEditingUnit = editingUnitName !== null;
      dialog = `<dialog class="dialog" aria-labelledby="unit-form-heading">
        <button class="dialog__close" type="button" data-action="close" aria-label="Cerrar">×</button>
        <p class="eyebrow">UNIDADES DE TRABAJO</p><h2 id="unit-form-heading">${isEditingUnit ? 'Editar UT' : 'Añadir UT'}</h2>
        <form class="unit-form"><label>Nombre de UT<input name="unitName" type="text" maxlength="40" value="${escapeHtml(pendingUnitName ?? editingUnitName ?? '')}" placeholder="Ej. UT 6001" required></label>
          ${unitFormError ? `<p class="field-error" role="alert">${escapeHtml(unitFormError)}</p>` : ''}
          <div class="dialog__actions"><button class="button button--quiet" type="button" data-action="close">Cancelar</button><button class="button button--primary" type="submit">${isEditingUnit ? 'Guardar cambios' : 'Crear UT'}</button></div>
        </form>
      </dialog>`;
    } else if (activeDialog && activeDialog.startsWith('confirm-')) {
      const isDelete = activeDialog === 'record-confirm-delete' || activeDialog === 'unit-confirm-delete';
      const heading = activeDialog === 'record-confirm-update' ? '¿Guardar estos cambios?' : activeDialog === 'record-confirm-delete' ? '¿Eliminar este registro?' : activeDialog === 'unit-confirm-rename' ? '¿Guardar el nuevo nombre?' : '¿Eliminar esta UT?';
      const action = isDelete ? 'confirm-delete' : 'confirm-save';
      const subject = activeDialog === 'record-confirm-update' || activeDialog === 'record-confirm-delete'
        ? pendingRecord?.title ?? recordInDetail?.title ?? ''
        : activeDialog === 'unit-confirm-rename' ? pendingUnitName ?? '' : pendingUnitName ?? '';
      const description = activeDialog === 'unit-confirm-delete'
        ? `También se eliminarán ${records.filter((record) => record.utName === pendingUnitName).length} registros asociados.`
        : isDelete ? 'Esta acción no se puede deshacer.' : 'Se actualizará la información guardada.';
      const confirmationLabel = isDelete
        ? activeDialog === 'unit-confirm-delete' ? 'Eliminar UT y registros' : 'Eliminar registro'
        : activeDialog === 'unit-confirm-rename' ? 'Guardar nombre' : 'Guardar cambios';
      dialog = `<dialog class="dialog dialog--confirmation ${isDelete ? 'dialog--confirmation-danger' : ''}" aria-labelledby="confirmation-heading">
        <button class="dialog__close" type="button" data-action="close" aria-label="Cerrar">×</button>
        <div class="confirmation-mark" aria-hidden="true">${isDelete ? '!' : '✓'}</div>
        <p class="eyebrow">CONFIRMA LA ACCIÓN</p><h2 id="confirmation-heading">${heading}</h2>
        <p class="confirmation-copy">${description}</p><p class="confirmation-record">${escapeHtml(subject)}</p>
        <div class="dialog__actions"><button class="button button--quiet" type="button" data-action="cancel-confirmation">Volver</button><button class="button ${isDelete ? 'button--danger' : 'button--primary'}" type="button" data-action="${action}">${confirmationLabel}</button></div>
      </dialog>`;
    }

    container.innerHTML = `<div class="diary-shell">
      <header class="topbar">
        <a class="brand" href="#" aria-label="Diario UT, inicio"><span class="brand__mark" aria-hidden="true">D</span><span>diario<span class="brand__accent">UT</span></span></a>
        <span class="topbar__context">REGISTRO DE INTERVENCIONES</span>
        <button class="button button--primary create-button" type="button" data-action="new-record"><span aria-hidden="true">＋</span> Nuevo registro</button>
      </header>
      <main>
        <div class="list-heading"><span>UNIDADES DE TRABAJO</span><div class="list-heading__actions">
          <button class="button button--quiet button--manage-units" type="button" data-action="manage-units">Gestionar UT</button>
          <details class="sort-menu"><summary class="sort-menu__trigger"><span>Ordenar</span><strong class="sort-menu__value">${sortMode === 'recent' ? 'Recientes' : 'Tipo de acción'}</strong><span class="sort-menu__caret" aria-hidden="true">⌄</span></summary>
            <div class="sort-menu__options" aria-label="Ordenar todas las UT"><button class="sort-menu__option" type="button" data-action="sort" data-sort-mode="recent" aria-pressed="${sortMode === 'recent'}">Recientes</button><button class="sort-menu__option" type="button" data-action="sort" data-sort-mode="action" aria-pressed="${sortMode === 'action'}">Tipo de acción</button></div>
          </details>
        </div></div>
        <div class="ut-list">${sections}</div>
      </main>
      <footer class="app-footer"><span>DIARIO UT <span>·</span> DATOS LOCALES</span><div class="app-footer__tools"><span><i aria-hidden="true"></i> Guardado en este dispositivo</span><button class="icon-button footer-export" type="button" data-action="export" aria-label="Exportar todos los datos como JSON" title="Exportar datos en JSON"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 15v4h14v-4" /></svg></button></div></footer>
      ${dialog}
    </div>`;
    if (activeDialog) container.querySelector<HTMLDialogElement>('.dialog')?.showModal();
  };

  const refresh = async (): Promise<void> => {
    const [listedRecords, listedUnits] = await Promise.all([repository.listRecords(), repository.listUTs()]);
    records = listedRecords;
    units = listedUnits;
    render();
  };

  const exportJson = (): void => {
    const payload = JSON.stringify({ format: 'diario-ut', version: 1, exportedAt: new Date().toISOString(), units, records }, null, 2);
    const blobUrl = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `diario-ut-${localDateString()}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
  };

  const closeDialog = (): void => {
    if (activeDialog === 'record-confirm-update') activeDialog = 'record-form';
    else if (activeDialog === 'record-confirm-delete') activeDialog = 'record-detail';
    else if (activeDialog === 'unit-confirm-rename') activeDialog = 'unit-form';
    else if (activeDialog === 'unit-confirm-delete') activeDialog = 'unit-manager';
    else if (activeDialog === 'record-form') { activeDialog = editingRecordId ? 'record-detail' : null; editingRecordId = null; pendingRecord = null; }
    else if (activeDialog === 'unit-form') { activeDialog = 'unit-manager'; editingUnitName = null; pendingUnitName = null; unitFormError = null; }
    else { activeDialog = null; selectedRecordId = null; editingRecordId = null; pendingRecord = null; editingUnitName = null; pendingUnitName = null; unitFormError = null; }
    render();
  };

  const confirmAction = async (): Promise<void> => {
    if (activeDialog === 'record-confirm-update' && pendingRecord) {
      await repository.saveRecord(pendingRecord);
      selectedRecordId = pendingRecord.id;
      editingRecordId = null;
      pendingRecord = null;
      activeDialog = 'record-detail';
    } else if (activeDialog === 'record-confirm-delete' && selectedRecordId) {
      await repository.deleteRecord(selectedRecordId);
      selectedRecordId = null;
      activeDialog = null;
    } else if (activeDialog === 'unit-confirm-rename' && editingUnitName && pendingUnitName) {
      const oldName = editingUnitName;
      await repository.renameUT(oldName, pendingUnitName);
      if (expanded.delete(oldName)) expanded.add(pendingUnitName);
      editingUnitName = null;
      pendingUnitName = null;
      unitFormError = null;
      activeDialog = 'unit-manager';
    } else if (activeDialog === 'unit-confirm-delete' && pendingUnitName) {
      expanded.delete(pendingUnitName);
      await repository.deleteUT(pendingUnitName);
      pendingUnitName = null;
      activeDialog = 'unit-manager';
    }
    await refresh();
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
      container.querySelectorAll<HTMLButtonElement>('.sort-menu__option').forEach((option) => option.setAttribute('aria-pressed', String(option.dataset.sortMode === sortMode)));
      updateSortedLists();
      return;
    }
    if (action === 'export') { exportJson(); return; }
    if (action === 'new-record') { selectedRecordId = null; editingRecordId = null; pendingRecord = null; activeDialog = 'record-form'; }
    else if (action === 'manage-units') activeDialog = 'unit-manager';
    else if (action === 'new-unit') { editingUnitName = null; pendingUnitName = null; unitFormError = null; activeDialog = 'unit-form'; }
    else if (action === 'edit-unit' && target.dataset.ut) { editingUnitName = target.dataset.ut; pendingUnitName = null; unitFormError = null; activeDialog = 'unit-form'; }
    else if (action === 'delete-unit' && target.dataset.ut) { pendingUnitName = target.dataset.ut; activeDialog = 'unit-confirm-delete'; }
    else if (action === 'edit-record' && selectedRecordId) { editingRecordId = selectedRecordId; pendingRecord = null; activeDialog = 'record-form'; }
    else if (action === 'delete-record' && selectedRecordId) activeDialog = 'record-confirm-delete';
    else if (action === 'confirm' || action === 'confirm-save' || action === 'confirm-delete') { void confirmAction(); return; }
    else if (action === 'cancel-confirmation') closeDialog();
    else if (action === 'close') closeDialog();
    else if (action === 'toggle' && target.dataset.ut) {
      if (expanded.has(target.dataset.ut)) expanded.delete(target.dataset.ut);
      else expanded.add(target.dataset.ut);
    } else if (action === 'detail') {
      selectedRecordId = target.dataset.id ?? null;
      activeDialog = selectedRecordId ? 'record-detail' : null;
    }
    render();
  });

  container.addEventListener('cancel', (event) => {
    if (!(event.target instanceof HTMLDialogElement)) return;
    event.preventDefault();
    closeDialog();
  });

  container.addEventListener('submit', (event) => {
    if (!(event.target instanceof HTMLFormElement)) return;
    event.preventDefault();
    const formData = new FormData(event.target);
    if (event.target.matches('.record-form')) {
      const originalRecord = editingRecordId ? records.find((record) => record.id === editingRecordId) : null;
      const record: UtRecord = {
        id: originalRecord?.id ?? crypto.randomUUID(),
        date: String(formData.get('date')),
        utName: String(formData.get('utName')),
        actionType: String(formData.get('actionType')) as UtRecord['actionType'],
        title: String(formData.get('title')).trim(),
        whatHappened: String(formData.get('whatHappened')).trim(),
        howResolved: String(formData.get('howResolved')).trim(),
        createdAt: originalRecord?.createdAt ?? Date.now(),
      };
      if (editingRecordId) { pendingRecord = record; activeDialog = 'record-confirm-update'; render(); }
      else void repository.saveRecord(record).then(() => { activeDialog = null; return refresh(); });
    } else if (event.target.matches('.unit-form')) {
      const name = String(formData.get('unitName')).trim();
      if (units.some((unit) => unit.toLocaleLowerCase() === name.toLocaleLowerCase() && unit !== editingUnitName)) {
        unitFormError = 'Ya existe una UT con ese nombre.';
        render();
        return;
      }
      unitFormError = null;
      if (editingUnitName) {
        if (name === editingUnitName) { activeDialog = 'unit-manager'; editingUnitName = null; render(); }
        else { pendingUnitName = name; activeDialog = 'unit-confirm-rename'; render(); }
      } else {
        void repository.createUT(name).then(() => { activeDialog = 'unit-manager'; return refresh(); });
      }
    }
  });

  void refresh();
}