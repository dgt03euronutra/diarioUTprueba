export const UT_NAMES = ['UT 5001', 'UT 5101', 'UT 5201', 'UT 5401', 'UT 5501', 'UT 5901'] as const;
export const ACTION_TYPES = ['Eléctrico', 'Mecánico', 'Programación', 'Mantenimiento'] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export interface UtRecord {
  id: string;
  date: string;
  utName: (typeof UT_NAMES)[number];
  actionType: ActionType;
  title: string;
  whatHappened: string;
  howResolved: string;
  content?: string;
  createdAt: number;
}

export interface RecordsRepository {
  listRecords(): Promise<UtRecord[]>;
  saveRecord(record: UtRecord): Promise<void>;
  deleteRecord(id: string): Promise<void>;
}

export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}