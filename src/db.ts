import * as SQLite from 'expo-sqlite';

/** Common homeschool subjects — chips on the entry form; free text also allowed. */
export const SUBJECT_OPTIONS = [
  'Math',
  'Reading',
  'Writing',
  'Science',
  'History',
  'Art',
  'Music',
  'PE',
  'Language',
  'Field trip',
  'Other',
] as const;

/** Subjects most states treat as "core" (used for the core-hours line on reports). */
export const CORE_SUBJECTS = new Set(['Math', 'Reading', 'Writing', 'Science', 'History', 'Language']);

export interface Student {
  id: number;
  name: string;
  grade: string;
  createdAt: number;
}

export interface Entry {
  id: number;
  studentId: number;
  studentName: string;
  /** Calendar date of the lesson, YYYY-MM-DD (local). */
  date: string;
  /** Minutes of instruction. */
  durationMin: number;
  subject: string;
  notes: string;
  /** Filename of a work-sample photo inside the app photos directory, or ''. */
  photo: string;
  createdAt: number;
  updatedAt: number;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('hearth.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS students (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          grade TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          date TEXT NOT NULL,
          duration_min INTEGER NOT NULL,
          subject TEXT NOT NULL DEFAULT '',
          notes TEXT NOT NULL DEFAULT '',
          photo TEXT NOT NULL DEFAULT '',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date);
        CREATE INDEX IF NOT EXISTS idx_entries_student ON entries(student_id);
      `);
      return db;
    })();
  }
  return dbPromise;
}

// ---------- students ----------

export async function getStudents(): Promise<Student[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM students ORDER BY id ASC');
  return rows.map((r) => ({ id: r.id, name: r.name, grade: r.grade ?? '', createdAt: r.created_at }));
}

export async function addStudent(name: string, grade = ''): Promise<Student | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const db = await getDb();
  const res = await db.runAsync(
    'INSERT INTO students (name, grade, created_at) VALUES (?, ?, ?)',
    [trimmed, grade.trim(), Date.now()]
  );
  // Verify-or-throw: the row must be readable before we report success.
  const row = await db.getFirstAsync<any>('SELECT * FROM students WHERE id = ?', [res.lastInsertRowId]);
  if (!row) throw new Error('The student could not be saved.');
  return { id: row.id, name: row.name, grade: row.grade ?? '', createdAt: row.created_at };
}

export async function updateStudent(id: number, name: string, grade: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE students SET name = ?, grade = ? WHERE id = ?', [name.trim(), grade.trim(), id]);
}

/** Deletes the student and their entries; returns photo filenames to remove from disk. */
export async function deleteStudent(id: number): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    "SELECT photo FROM entries WHERE student_id = ? AND photo <> ''",
    [id]
  );
  await db.runAsync('DELETE FROM students WHERE id = ?', [id]);
  return rows.map((r) => r.photo as string);
}

// ---------- entries ----------

const ENTRY_SELECT = `
  SELECT e.*, s.name AS student_name
  FROM entries e JOIN students s ON s.id = e.student_id
`;

function rowToEntry(row: any): Entry {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name ?? '',
    date: row.date,
    durationMin: row.duration_min ?? 0,
    subject: row.subject ?? '',
    notes: row.notes ?? '',
    photo: row.photo ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface EntryInput {
  studentId: number;
  date: string;
  durationMin: number;
  subject: string;
  notes: string;
  photo: string;
}

function clean(input: EntryInput): EntryInput {
  return {
    ...input,
    durationMin: Math.max(0, Math.round(input.durationMin)),
    subject: input.subject.trim(),
    notes: input.notes.trim(),
    photo: input.photo ?? '',
  };
}

export async function insertEntry(input: EntryInput): Promise<number> {
  const db = await getDb();
  const now = Date.now();
  const i = clean(input);
  const res = await db.runAsync(
    `INSERT INTO entries
       (student_id, date, duration_min, subject, notes, photo, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [i.studentId, i.date, i.durationMin, i.subject, i.notes, i.photo, now, now]
  );
  const check = await db.getFirstAsync<any>('SELECT id FROM entries WHERE id = ?', [res.lastInsertRowId]);
  if (!check) throw new Error('The entry could not be saved.');
  return res.lastInsertRowId;
}

export async function updateEntry(id: number, input: EntryInput): Promise<void> {
  const db = await getDb();
  const i = clean(input);
  await db.runAsync(
    `UPDATE entries SET
       student_id = ?, date = ?, duration_min = ?, subject = ?, notes = ?, photo = ?, updated_at = ?
     WHERE id = ?`,
    [i.studentId, i.date, i.durationMin, i.subject, i.notes, i.photo, Date.now(), id]
  );
}

/** Returns the entry's photo filename (if any) so the caller can delete the file. */
export async function deleteEntry(id: number): Promise<string> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT photo FROM entries WHERE id = ?', [id]);
  await db.runAsync('DELETE FROM entries WHERE id = ?', [id]);
  return row?.photo ?? '';
}

export async function getEntry(id: number): Promise<Entry | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>(`${ENTRY_SELECT} WHERE e.id = ?`, [id]);
  return row ? rowToEntry(row) : null;
}

export interface EntryFilter {
  /** Restrict to one student; undefined = all students. */
  studentId?: number;
  /** Inclusive YYYY-MM-DD range (the school year). */
  from?: string;
  to?: string;
}

function whereFor(f: EntryFilter | undefined): { sql: string; params: any[] } {
  const where: string[] = [];
  const params: any[] = [];
  if (f?.studentId !== undefined) {
    where.push('e.student_id = ?');
    params.push(f.studentId);
  }
  if (f?.from) {
    where.push('e.date >= ?');
    params.push(f.from);
  }
  if (f?.to) {
    where.push('e.date <= ?');
    params.push(f.to);
  }
  return { sql: where.length ? ' WHERE ' + where.join(' AND ') : '', params };
}

/** Entries newest first (by lesson date, then recency). */
export async function getEntries(filter?: EntryFilter): Promise<Entry[]> {
  const db = await getDb();
  const w = whereFor(filter);
  const rows = await db.getAllAsync<any>(
    `${ENTRY_SELECT}${w.sql} ORDER BY e.date DESC, e.id DESC LIMIT 5000`,
    w.params
  );
  return rows.map(rowToEntry);
}

export async function countEntries(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT COUNT(*) AS n FROM entries');
  return row?.n ?? 0;
}

/** Custom subjects the family has typed before (autofill chips). */
export async function getRecentSubjects(limit = 6): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT subject, MAX(id) AS last_id FROM entries
     WHERE subject <> ''
     GROUP BY subject
     ORDER BY last_id DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map((r) => r.subject as string);
}

export interface Stats {
  entryCount: number;
  totalMin: number;
  coreMin: number;
  /** Distinct calendar days with at least one entry = attendance days. */
  dayCount: number;
  photoCount: number;
  firstDate: string | null;
  lastDate: string | null;
}

export async function getStats(filter?: EntryFilter): Promise<Stats> {
  const db = await getDb();
  const w = whereFor(filter);
  const row = await db.getFirstAsync<any>(
    `SELECT
       COUNT(*) AS n,
       COALESCE(SUM(e.duration_min), 0) AS total_min,
       COUNT(DISTINCT e.date) AS days,
       SUM(CASE WHEN e.photo <> '' THEN 1 ELSE 0 END) AS photos,
       MIN(e.date) AS first_date,
       MAX(e.date) AS last_date
     FROM entries e${w.sql}`,
    w.params
  );
  const subjectRows = await db.getAllAsync<any>(
    `SELECT e.subject AS subject, COALESCE(SUM(e.duration_min), 0) AS m FROM entries e${w.sql} GROUP BY e.subject`,
    w.params
  );
  let coreMin = 0;
  for (const r of subjectRows) if (CORE_SUBJECTS.has(r.subject)) coreMin += r.m ?? 0;
  return {
    entryCount: row?.n ?? 0,
    totalMin: row?.total_min ?? 0,
    coreMin,
    dayCount: row?.days ?? 0,
    photoCount: row?.photos ?? 0,
    firstDate: row?.first_date ?? null,
    lastDate: row?.last_date ?? null,
  };
}

export interface SubjectTotal {
  subject: string;
  totalMin: number;
  entryCount: number;
}

export async function getSubjectTotals(filter?: EntryFilter): Promise<SubjectTotal[]> {
  const db = await getDb();
  const w = whereFor(filter);
  const rows = await db.getAllAsync<any>(
    `SELECT e.subject AS subject, COALESCE(SUM(e.duration_min), 0) AS m, COUNT(*) AS n
     FROM entries e${w.sql} GROUP BY e.subject ORDER BY m DESC`,
    w.params
  );
  return rows.map((r) => ({ subject: r.subject || 'Unlabeled', totalMin: r.m ?? 0, entryCount: r.n ?? 0 }));
}

/** Days with entries, each with its total minutes — the attendance calendar. */
export interface DayTotal {
  date: string;
  totalMin: number;
  subjects: string;
}

export async function getDayTotals(filter?: EntryFilter): Promise<DayTotal[]> {
  const db = await getDb();
  const w = whereFor(filter);
  const rows = await db.getAllAsync<any>(
    `SELECT e.date AS date, COALESCE(SUM(e.duration_min), 0) AS m,
            GROUP_CONCAT(DISTINCT e.subject) AS subjects
     FROM entries e${w.sql} GROUP BY e.date ORDER BY e.date ASC`,
    w.params
  );
  return rows.map((r) => ({ date: r.date, totalMin: r.m ?? 0, subjects: (r.subjects ?? '').split(',').filter(Boolean).join(', ') }));
}

/** Deletes everything; returns photo filenames to remove from disk. */
export async function deleteAllData(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>("SELECT photo FROM entries WHERE photo <> ''");
  await db.execAsync('DELETE FROM entries; DELETE FROM students;');
  return rows.map((r) => r.photo as string);
}

/** CSV export (RFC-4180), oldest first. */
export async function exportCsv(filter?: EntryFilter): Promise<string> {
  const entries = await getEntries(filter);
  const q = (s: string) => '"' + s.replace(/"/g, '""') + '"';
  const lines = ['date,student,subject,hours,notes,has_photo'];
  for (const e of [...entries].reverse()) {
    lines.push(
      [
        e.date,
        q(e.studentName),
        q(e.subject),
        (e.durationMin / 60).toFixed(2),
        q(e.notes),
        e.photo ? 'yes' : 'no',
      ].join(',')
    );
  }
  return lines.join('\r\n');
}

/** "3h 45m" style formatting used across the app. */
export function fmtHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Decimal hours for forms and report columns ("2.5"). */
export function fmtDecimalHours(min: number): string {
  const h = min / 60;
  return Number.isInteger(h) ? String(h) : h.toFixed(h * 10 === Math.round(h * 10) ? 1 : 2);
}
