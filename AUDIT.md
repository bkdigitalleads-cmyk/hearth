# Hearth audit (Oct 15 2026)
## Findings
1. [MED] With Face ID lock on, leaving the app mid-entry wipes the lesson being logged
   - Where: src/LockGate.tsx:53 (children unmount while locked) together with src/screens/EntryForm.tsx:119-120 (reset() on open for a new entry)
   - What happens: A parent starts the lesson timer, picks a subject, types notes and attaches a photo, then switches apps while the lesson runs. Backgrounding locks the app and unmounts EntryFormModal. After unlock, Shell still has formVisible = true, so the form remounts and its effect calls reset(). Subject, notes, hours and photo are gone (the timer survives because it is in AsyncStorage). The picked photo file is left orphaned in documents/photos.
   - Fix: Render the lock screen as an overlay on top of the children (an absolute View or a Modal) instead of replacing them, so open modals and their state survive.
2. [MED] "All students" totals compare combined hours against a single student's state target
   - Where: src/screens/Home.tsx:39-42 and :81-84; src/report.ts:100-103 (no studentId filter for All) and :136-141, :166-167
   - What happens: Two children each logging 5 h/day add up to 10 h/day. In a state with a 1,000-hour annual target, Home's progress fills, and "reached" flips, at about half the real time. The "All students" attendance PDF prints daily hours of 10, combined hour totals and "100% of the 1000-hour target" under a parent signature line, which is wrong on a document handed to a district.
   - Fix: When scope is All, either compute and print progress per student (one summary block each) or drop the target percentage and bar for the combined view. At minimum, label the combined hours as "all students combined".
3. [LOW] The In-App Event deep link opens the app and does nothing else
   - Where: app.json:6 registers the hearth scheme, but nothing reads the URL (no Linking.getInitialURL or addEventListener anywhere; App.tsx Shell)
   - What happens: Tapping the event's "Open" button with hearth://event/school-year launches or foregrounds Hearth on whatever screen was last shown, or on onboarding for a new install. It does not crash, but nothing about the school year is shown. The scheme first ships in 1.0.6 build 11; any earlier binary can't open the URL at all.
   - Fix: In Shell, read Linking.getInitialURL() plus the 'url' listener, and for a path containing event/school-year run setTab('report') (or Settings > School year). Make sure 1.0.6 build 11 is the live version before the event's publish date.
4. [LOW] After Pro lapses, the Face ID lock can't be turned off
   - Where: src/screens/Settings.tsx:125
   - What happens: The lock was turned on during the trial and the subscription was then cancelled. LockGate keeps locking, but the switch opens the paywall instead of turning the lock off.
   - Fix: `if (!isPro && !settings.lockEnabled)`.
5. [LOW] Quitting during onboarding after the student step creates a duplicate student
   - Where: src/screens/Onboarding.tsx:85 saves the student; ONBOARDED_KEY is only written at App.tsx:64 after the last (attribution) step
   - What happens: The app is killed on the state or source step, and the relaunch runs onboarding again. A second "Maya" is added, Home switches to two students with an "All" chip, and totals split between the two.
   - Fix: Skip the student step when getStudents() already returns rows (or persist an onboarding step marker).

## Checked and fine
- purchases usage: state.tsx inits before getIsPro; Paywall buy/restore only grant on an active 'pro' entitlement; Settings restore alerts for every outcome
- Free-tier gating: 14 lifetime entries checked in Home.handleAdd (the only path to a new entry); editing existing entries stays allowed; PDFs, CSV and Face ID behind Pro; all paywall triggers are root-level screens, so the stacked-modal problem in Attend and Chores doesn't apply here
- Rating prompt: fires once after the first saved entry (EntryForm.tsx:230) and after the first export; the asked flag is stored first
- db.ts: single v1 schema with no added columns in git history; photos are stored as filenames, not absolute paths, so they survive the container path change on update; insert verifies the row; deletes return photo names for cleanup
- Dates: todayIso is local; schoolYearFor handles Jan and July starts and month-end days correctly; no toISOString date bugs
- updateSettings uses a functional setState, so fast typing doesn't drop changes; settings JSON.parse is guarded in state.tsx and report.ts
- Report/CSV: HTML escaped; the empty-data guard is on the PDFs; a missing photo falls back to a "photo not available" tile instead of throwing
- Deep link: no crash path. RN Linking with no listener is a no-op, and LockGate still gates the app
