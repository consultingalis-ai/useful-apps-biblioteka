// Mali „ugovor” za rad sa SQLite bazom. U aplikaciji ga ispunjava Tauri SQL plugin,
// a u testovima ugrađeni node:sqlite. Tako se ista logika testira bez Windows-a.

export type Vrednost = string | number | null;

export interface SqlKlijent {
  execute(sql: string, parametri?: Vrednost[]): Promise<{ rowsAffected: number }>;
  select<T>(sql: string, parametri?: Vrednost[]): Promise<T[]>;
}
