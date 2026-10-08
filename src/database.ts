import { UT_NAMES } from './models';
import type { RecordsRepository, UtRecord } from './models';

const DATABASE_NAME = 'diario-uts-local';
const DATABASE_VERSION = 2;
const RECORD_STORE = 'records';
const UT_STORE = 'uts';

export class IndexedDbRecordsRepository implements RecordsRepository {
  private databasePromise: Promise<IDBDatabase> | null = null;

  async listRecords(): Promise<UtRecord[]> {
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const request = database.transaction(RECORD_STORE, 'readonly').objectStore(RECORD_STORE).getAll();
      request.onsuccess = () => resolve(request.result as UtRecord[]);
      request.onerror = () => reject(request.error);
    });
  }

  async saveRecord(record: UtRecord): Promise<void> {
    const database = await this.openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(RECORD_STORE, 'readwrite');
      transaction.objectStore(RECORD_STORE).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  async deleteRecord(id: string): Promise<void> {
    const database = await this.openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(RECORD_STORE, 'readwrite');
      transaction.objectStore(RECORD_STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  async listUTs(): Promise<string[]> {
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const request = database.transaction(UT_STORE, 'readonly').objectStore(UT_STORE).getAll();
      request.onsuccess = () => resolve((request.result as { name: string }[])
        .map((unit) => unit.name)
        .sort((first, second) => first.localeCompare(second, 'es', { numeric: true })));
      request.onerror = () => reject(request.error);
    });
  }

  async createUT(name: string): Promise<void> {
    const database = await this.openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(UT_STORE, 'readwrite');
      transaction.objectStore(UT_STORE).add({ name });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  async renameUT(currentName: string, newName: string): Promise<void> {
    if (currentName === newName) return;
    const database = await this.openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction([UT_STORE, RECORD_STORE], 'readwrite');
      const units = transaction.objectStore(UT_STORE);
      const existing = units.get(currentName);
      existing.onsuccess = () => {
        if (!existing.result) {
          transaction.abort();
          return;
        }
        units.delete(currentName);
        units.add({ name: newName });
        const records = transaction.objectStore(RECORD_STORE);
        const allRecords = records.getAll();
        allRecords.onsuccess = () => {
          (allRecords.result as UtRecord[])
            .filter((record) => record.utName === currentName)
            .forEach((record) => records.put({ ...record, utName: newName }));
        };
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error(`No existe la UT ${currentName}.`));
    });
  }

  async deleteUT(name: string): Promise<number> {
    const database = await this.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction([UT_STORE, RECORD_STORE], 'readwrite');
      const records = transaction.objectStore(RECORD_STORE);
      const allRecords = records.getAll();
      let deletedCount = 0;
      allRecords.onsuccess = () => {
        (allRecords.result as UtRecord[]).filter((record) => record.utName === name).forEach((record) => {
          records.delete(record.id);
          deletedCount += 1;
        });
        transaction.objectStore(UT_STORE).delete(name);
      };
      transaction.oncomplete = () => resolve(deletedCount);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          const database = request.result;
          if (!database.objectStoreNames.contains(RECORD_STORE)) {
            database.createObjectStore(RECORD_STORE, { keyPath: 'id' });
          }
          if (!database.objectStoreNames.contains(UT_STORE)) {
            const units = database.createObjectStore(UT_STORE, { keyPath: 'name' });
            UT_NAMES.forEach((name) => units.add({ name }));
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.databasePromise;
  }
}