/**
 * Homeschool records, generated fully on-device with expo-print.
 *
 * 1. Attendance & hours log — the document a district, evaluator, or umbrella
 *    school asks for: one row per school day with hours and subjects, totals
 *    against the state (or custom) target, a subject breakdown, and a parent
 *    certification block with a signature line.
 * 2. Portfolio — every entry with notes and the work-sample photo, for states
 *    that require a portfolio of work (PA, FL, MD, …) or for evaluators.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getDayTotals,
  getEntries,
  getStats,
  getStudents,
  getSubjectTotals,
  fmtDecimalHours,
  fmtHours,
  EntryFilter,
  Student,
} from './db';
import { photoThumbBase64Diag } from './photos';
import { DEFAULT_SETTINGS, SETTINGS_KEY, Settings, resolveTarget, schoolYearFor, todayIso, SchoolYear } from './state';
import { getState } from './states';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // fall through to defaults
  }
  return { ...DEFAULT_SETTINGS };
}

const CSS = `
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #2a211a; margin: 32px; }
  h1 { font-size: 21px; margin: 0 0 2px; }
  h2 { font-size: 14px; margin: 22px 0 6px; border-bottom: 2px solid #b5532a; padding-bottom: 3px; }
  .sub { color: #6b5b4e; font-size: 12px; margin-bottom: 4px; }
  .who { margin: 14px 0 0; font-size: 13px; line-height: 1.5; }
  .who b { font-size: 14px; }
  .summary { display: flex; gap: 10px; margin: 14px 0 6px; }
  .box { flex: 1; background: #fbf3ec; border: 1px solid #ead9cb; border-radius: 10px; padding: 10px 12px; }
  .box .v { font-size: 18px; font-weight: 700; }
  .box .l { font-size: 11px; color: #6b5b4e; margin-top: 1px; }
  .bar { height: 9px; background: #f0e6dc; border-radius: 5px; margin: 8px 0 2px; overflow: hidden; }
  .bar i { display: block; height: 100%; background: #b5532a; border-radius: 5px; }
  .pct { font-size: 11px; color: #6b5b4e; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b5b4e; border-bottom: 2px solid #b5532a; padding: 5px 6px; }
  td { border-bottom: 1px solid #ece2d8; padding: 6px; font-size: 11.5px; vertical-align: top; }
  td.num { white-space: nowrap; text-align: right; }
  .totals td { border-top: 2px solid #b5532a; border-bottom: none; font-weight: 700; font-size: 12px; }
  .cert { margin-top: 26px; border: 1px solid #e0d2c4; border-radius: 10px; padding: 14px 16px; font-size: 12px; line-height: 1.5; page-break-inside: avoid; }
  .sig { display: flex; gap: 28px; margin-top: 26px; }
  .sig div { flex: 1; border-top: 1px solid #2a211a; padding-top: 4px; font-size: 11px; color: #6b5b4e; }
  .footer { margin-top: 24px; color: #6b5b4e; font-size: 10px; text-align: center; }
  .entry { border-bottom: 1px solid #ece2d8; padding: 10px 0; display: flex; gap: 12px; page-break-inside: avoid; }
  .entry .meta { font-size: 11px; color: #6b5b4e; }
  .entry .title { font-weight: 600; font-size: 13px; }
  .entry .notes { font-size: 12px; margin-top: 3px; white-space: pre-wrap; }
  .entry img { width: 150px; height: 150px; object-fit: cover; border-radius: 8px; }
  .noimg { width: 150px; height: 150px; border-radius: 8px; background: #f0e6dc; color: #6b5b4e; font-size: 9px; display: flex; align-items: center; justify-content: center; text-align: center; }
`;

interface Scope {
  settings: Settings;
  student: Student | null;
  students: Student[];
  year: SchoolYear;
  filter: EntryFilter;
  today: string;
}

async function scope(studentId: number | null): Promise<Scope> {
  const settings = await loadSettings();
  const students = await getStudents();
  const student = studentId ? students.find((s) => s.id === studentId) ?? null : null;
  const year = schoolYearFor(todayIso(), settings.yearStartMonth);
  const filter: EntryFilter = { from: year.from, to: year.to };
  if (student) filter.studentId = student.id;
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return { settings, student, students, year, filter, today };
}

function header(title: string, sc: Scope): string {
  const st = getState(sc.settings.stateCode);
  const names = sc.student ? sc.student.name : sc.students.map((s) => s.name).join(', ');
  const grade = sc.student?.grade ? ` · Grade ${esc(sc.student.grade)}` : '';
  return `
  <h1>${title}</h1>
  <div class="sub">School year ${sc.year.label} · Generated ${sc.today} · Hearth for iPhone · All records kept on-device</div>
  <div class="who">
    Student${sc.student ? '' : 's'}: <b>${names ? esc(names) : '____________________'}</b>${grade}<br/>
    Parent / teacher: ${sc.settings.parentName ? `<b>${esc(sc.settings.parentName)}</b>` : '____________________'}
    ${st ? `&nbsp;·&nbsp; State: ${esc(st.name)}` : ''}
  </div>`;
}

export async function buildAttendanceHtml(studentId: number | null): Promise<string> {
  const sc = await scope(studentId);
  const target = resolveTarget(sc.settings);
  const stats = await getStats(sc.filter);
  const days = await getDayTotals(sc.filter);
  const subjects = await getSubjectTotals(sc.filter);

  // Round toward "<1%" rather than "0%": a parent who has logged real hours
  // should never read a flat zero back on their own record.
  const fmtPct = (done: number, goal: number): string => {
    const raw = (done / goal) * 100;
    if (done > 0 && raw < 1) return '<1';
    return String(Math.min(100, Math.round(raw)));
  };
  const dayPct = target.days ? fmtPct(stats.dayCount, target.days) : null;
  const hourPct = target.hours ? fmtPct(stats.totalMin, target.hours * 60) : null;
  const pctParts: string[] = [];
  if (dayPct != null) pctParts.push(`${dayPct}% of the ${target.days}-day target`);
  if (hourPct != null) pctParts.push(`${hourPct}% of the ${target.hours}-hour target`);
  const barPct = dayPct ?? hourPct;

  const rows = days
    .map(
      (d, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td>${prettyDate(d.date)}</td>
      <td class="num"><b>${fmtDecimalHours(d.totalMin)}</b></td>
      <td>${esc(d.subjects || '—')}</td>
    </tr>`
    )
    .join('');

  const subjectRows = subjects
    .map(
      (s) => `<tr><td>${esc(s.subject)}</td><td class="num">${s.entryCount}</td><td class="num"><b>${fmtDecimalHours(s.totalMin)}</b></td></tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><style>${CSS}</style></head>
<body>
  ${header('Homeschool Attendance &amp; Hours Log', sc)}
  <div class="summary">
    <div class="box"><div class="v">${stats.dayCount}</div><div class="l">${target.days != null ? `of ${target.days} ` : ''}school days</div></div>
    <div class="box"><div class="v">${fmtHours(stats.totalMin)}</div><div class="l">${target.hours != null ? `of ${target.hours} ` : ''}instructional hours</div></div>
    <div class="box"><div class="v">${fmtHours(stats.coreMin)}</div><div class="l">in core subjects</div></div>
  </div>
  ${barPct != null ? `<div class="bar"><i style="width:${barPct}%"></i></div>
  <div class="pct">${pctParts.join(' · ')} (${esc(target.label)})</div>` : `<div class="pct">No annual days-or-hours target set (${esc(target.label)})</div>`}

  <h2>Attendance record</h2>
  <table>
    <tr><th>#</th><th>Date</th><th>Hours</th><th>Subjects</th></tr>
    ${rows}
    <tr class="totals">
      <td></td><td>Total · ${stats.dayCount} day${stats.dayCount === 1 ? '' : 's'}</td>
      <td class="num">${fmtDecimalHours(stats.totalMin)}</td><td></td>
    </tr>
  </table>

  <h2>Hours by subject</h2>
  <table>
    <tr><th>Subject</th><th style="text-align:right">Lessons</th><th style="text-align:right">Hours</th></tr>
    ${subjectRows}
  </table>

  <div class="cert">
    I certify that the instruction recorded above was provided as stated, and that these records
    were kept contemporaneously during the ${esc(sc.year.label)} school year.
    <div class="sig">
      <div>Parent / teacher signature</div>
      <div>Printed name</div>
      <div>Date</div>
    </div>
  </div>
  <div class="footer">Logged with Hearth. Requirements vary by state and change over time — confirm your state's exact record-keeping rules before submitting.</div>
</body></html>`;
}

export async function buildPortfolioHtml(studentId: number | null): Promise<string> {
  const sc = await scope(studentId);
  const entries = await getEntries(sc.filter);
  const stats = await getStats(sc.filter);

  const blocks: string[] = [];
  for (const e of [...entries].reverse()) {
    let img = '';
    if (e.photo) {
      const res = await photoThumbBase64Diag(e.photo);
      img = res.b64
        ? `<img src="data:image/jpeg;base64,${res.b64}" />`
        : `<div class="noimg">photo not available</div>`;
    }
    blocks.push(`
    <div class="entry">
      ${img ? `<div>${img}</div>` : ''}
      <div style="flex:1">
        <div class="title">${esc(e.subject || 'Lesson')} · ${fmtHours(e.durationMin)}</div>
        <div class="meta">${prettyDate(e.date)}${sc.student ? '' : ` · ${esc(e.studentName)}`}</div>
        ${e.notes ? `<div class="notes">${esc(e.notes)}</div>` : ''}
      </div>
    </div>`);
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><style>${CSS}</style></head>
<body>
  ${header('Homeschool Portfolio', sc)}
  <div class="summary">
    <div class="box"><div class="v">${stats.entryCount}</div><div class="l">lesson ${stats.entryCount === 1 ? 'entry' : 'entries'}</div></div>
    <div class="box"><div class="v">${stats.dayCount}</div><div class="l">school days</div></div>
    <div class="box"><div class="v">${stats.photoCount}</div><div class="l">work samples</div></div>
  </div>
  <h2>Lessons and work samples</h2>
  ${blocks.join('')}
  <div class="footer">Logged with Hearth. Keep a copy of this portfolio with your other homeschool records.</div>
</body></html>`;
}

async function share(html: string, title: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: title,
      UTI: 'com.adobe.pdf',
    });
  }
}

export async function generateAndShareAttendancePdf(studentId: number | null): Promise<void> {
  await share(await buildAttendanceHtml(studentId), 'Your attendance & hours log');
}

export async function generateAndSharePortfolioPdf(studentId: number | null): Promise<void> {
  await share(await buildPortfolioHtml(studentId), 'Your homeschool portfolio');
}
