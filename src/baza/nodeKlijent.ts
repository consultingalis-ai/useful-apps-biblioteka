// Samo za testove: SqlKlijent preko ugrađenog node:sqlite (isti SQLite kao u aplikaciji).
import { DatabaseSync } from "node:sqlite";
import type { SqlKlijent, Vrednost } from "./klijent";

export function napraviNodeKlijent(putanja = ":memory:"): SqlKlijent & { zatvori(): void } {
  const db = new DatabaseSync(putanja);
  return {
    async execute(sql: string, parametri: Vrednost[] = []) {
      const r = db.prepare(sql).run(...parametri);
      return { rowsAffected: Number(r.changes) };
    },
    async select<T>(sql: string, parametri: Vrednost[] = []) {
      return db.prepare(sql).all(...parametri) as T[];
    },
    zatvori() {
      db.close();
    },
  };
}
