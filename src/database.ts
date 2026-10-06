import type { RecordsRepository, UtRecord } from './models';

const DATABASE_NAME = 'diario-uts-local';
const DATABASE_VERSION = 1;
const RECORD_STORE = 'records';

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

  private openDatabase(): Promise<IDBDatabase> {
    if (!this.databasePromise) {
      this.databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(RECORD_STORE)) {
            request.result.createObjectStore(RECORD_STORE, { keyPath: 'id' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.databasePromise;
  }
}