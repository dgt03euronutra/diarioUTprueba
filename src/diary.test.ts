import { beforeEach, describe, expect, it } from 'vitest';
import { initDiary } from './diary';
import type { RecordsRepository, UtRecord } from './models';

class MemoryRepository implements RecordsRepository {
  records: UtRecord[] = [];

  async listRecords(): Promise<UtRecord[]> {
    return structuredClone(this.records);
  }

  async saveRecord(record: UtRecord): Promise<void> {
    this.records.push(structuredClone(record));
  }
}

describe('diario de intervenciones', () => {
  let repository: MemoryRepository;
  let container: HTMLElement;

  const waitForUi = async (): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, 0));

  beforeEach(async () => {
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function () {
        this.open = true;
      };
    }
    repository = new MemoryRepository();
    document.body.innerHTML = '<div id="app"></div>';
    container = document.querySelector('#app')!;
  });

  it('muestra todas las UT y permite guardar un registro obligatorio', async () => {
    initDiary(container, repository);
    await waitForUi();
    expect(container.querySelectorAll('.ut-section')).toHaveLength(6);
    expect(container.querySelectorAll('.record-list:not([hidden])')).toHaveLength(0);
    expect(container.querySelector('.ut-toggle__chevron')).toBeNull();
    container.querySelector('[data-action="new"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const form = container.querySelector<HTMLFormElement>('.record-form')!;
    expect(form.querySelector<HTMLInputElement>('[name="date"]')!.value).not.toBe('');
    form.querySelector<HTMLSelectElement>('[name="utName"]')!.value = 'UT 5001';
    form.querySelector<HTMLSelectElement>('[name="actionType"]')!.value = 'Eléctrico';
    form.querySelector<HTMLInputElement>('[name="title"]')!.value = 'Revisión de cuadro';
    form.querySelector<HTMLTextAreaElement>('[name="content"]')!.value = 'Se revisaron conexiones.';
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await waitForUi();

    expect(repository.records).toHaveLength(1);
    expect(repository.records[0].utName).toBe('UT 5001');
    expect(container.querySelector('.record-row__title')?.textContent).toBe('Revisión de cuadro');
  });

  it('muestra el contenido en un diálogo y conserva los textos como texto plano', async () => {
    repository.records.push({
      id: 'entry-1', date: '2026-10-05', utName: 'UT 5001', actionType: 'Programación',
      title: '<img src=x onerror=alert(1)>', content: '<script>alert(1)</script>\nDetalle', createdAt: 1,
    });
    initDiary(container, repository);
    await waitForUi();
    container.querySelector('[data-action="detail"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(container.querySelector('.record-row img')).toBeNull();
    expect(container.querySelector('.detail-content')?.textContent).toBe('<script>alert(1)</script>\nDetalle');
    expect(container.querySelector<HTMLDialogElement>('.dialog')?.open).toBe(true);
    container.querySelector('[data-action="close"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(container.querySelector('.dialog')).toBeNull();
  });

  it('pliega unidades y aplica el orden por tipo de acción a todas las UT', async () => {
    repository.records = [
      { id: 'a', date: '2026-10-04', utName: 'UT 5001', actionType: 'Mecánico', title: 'A', content: 'A', createdAt: 1 },
      { id: 'b', date: '2026-10-05', utName: 'UT 5001', actionType: 'Eléctrico', title: 'B', content: 'B', createdAt: 2 },
      { id: 'c', date: '2026-10-04', utName: 'UT 5101', actionType: 'Mantenimiento', title: 'C', content: 'C', createdAt: 3 },
      { id: 'd', date: '2026-10-05', utName: 'UT 5101', actionType: 'Programación', title: 'D', content: 'D', createdAt: 4 },
    ];
    initDiary(container, repository);
    await waitForUi();
    expect(container.querySelectorAll('.list-heading [data-action="sort"]')).toHaveLength(2);
    expect(container.querySelector('.ut-section [data-action="sort"]')).toBeNull();
    expect(container.querySelector('#records-UT-5001')?.hasAttribute('hidden')).toBe(true);
    container.querySelector('[data-action="toggle"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(container.querySelector('#records-UT-5001')?.hasAttribute('hidden')).toBe(false);
    container.querySelector('[data-action="toggle"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(container.querySelector('#records-UT-5001')?.hasAttribute('hidden')).toBe(true);
    const sortMenu = container.querySelector<HTMLDetailsElement>('.sort-menu')!;
    sortMenu.querySelector('summary')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(sortMenu.open).toBe(true);
    expect(sortMenu.querySelector('.sort-menu__value')?.textContent).toBe('Recientes');
    container.querySelector<HTMLButtonElement>('[data-sort-mode="action"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(sortMenu.open).toBe(false);
    expect(sortMenu.querySelector('.sort-menu__value')?.textContent).toBe('Tipo de acción');
    expect(container.querySelector('#records-UT-5001 .record-row__title')?.textContent).toBe('B');
    expect(container.querySelector('#records-UT-5101 .record-row__title')?.textContent).toBe('C');
  });
});