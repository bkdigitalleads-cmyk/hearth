# Hearth — App Store metadata (v1.0) — DRAFT, pricing needs Brian's approval

## Identity
- **App name (26/30):** `Hearth: Homeschool Tracker`
- **Subtitle (30/30):** `Attendance, hours & portfolio`
- Bundle id: `com.bwk.hearth` · slug `hearth-homeschool-tracker` · owner `bkdeveloper123`
- Categories: Education (primary), Productivity (secondary)
- Age rating: 4+

Title carries the exact Apple-autocomplete phrase ("homeschool tracker"); subtitle carries the
Google workaround cluster (attendance, hours) plus the compliance word (portfolio). Between them:
homeschool, tracker, attendance, hours, portfolio.

## Keywords (no words repeated from title/subtitle; US storefront indexes all three locales)

**en-US (99/100):**
`planner,scheduler,log,record,sheet,printable,days,lesson,student,state,report,evaluator,umbrella`

**es-MX (additional English terms):**
`curriculum,grade,subject,teacher,parent,family,kids,co-op,portfolio,pdf`

**ar-SA (additional English terms):**
`compliance,requirement,law,diary,logbook,calendar,timesheet,progress,year,records`

## Description (EULA + Privacy links REQUIRED — do not remove)

Hearth is the homeschool tracker that keeps your attendance and hours for you, so records are ready before anyone asks.

Log each lesson in seconds: date, hours, subject, what you covered, and a photo of the work. Every day with an entry counts as a school day. Hearth totals days and instructional hours for the school year and shows exactly where you stand against your state's requirement.

LOG A LESSON IN SECONDS
• Tap +, enter hours (1.5 works fine) or run the lesson timer
• Subjects as chips, plus your own (Latin, co-op, nature study)
• Snap the worksheet or project as a work sample
• One student or the whole family, each with their own record

A TARGET THAT MATCHES YOUR STATE
• Pick your state and Hearth sets the days and hours from its published rules, checked against official state sources
• No statewide number? Set the target your evaluator, umbrella school, or district expects
• Two progress bars: school days and instructional hours

RECORDS READY WHEN SOMEONE ASKS
• Attendance & hours log PDF: one row per school day with hours and subjects, hours by subject, totals against your target, and a parent certification block with a signature line
• Portfolio PDF: every lesson with notes and work-sample photos, in date order
• CSV export for spreadsheets and evaluators

PRIVATE BY DESIGN
• Your family's records live on your iPhone: no account, no cloud, no tracking
• Optional Face ID lock
• Works fully offline

Free to start: log your first 14 entries on us. Hearth Pro unlocks unlimited entries, the attendance and portfolio PDFs, CSV export, and Face ID lock, as a one-time Lifetime purchase or a Yearly subscription.

State information is a convenience summary and not legal advice. Requirements change; confirm with your state.

Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://bkdigitalleads-cmyk.github.io/hearth/privacy.html

## Promotional text (live-editable, ≤170)
Track homeschool attendance days and hours per student against your state's requirement, then export an attendance log or portfolio PDF in one tap.

## What's New (1.0)
Welcome to Hearth! Log lessons in seconds, track days and hours against your state's requirement, and export attendance and portfolio PDFs.

## Pricing (RevenueCat: entitlement `pro`, offering `default`) — PROPOSED, needs Brian's OK
- `hearth_pro_lifetime` — non-consumable IAP, **$24.99** (hero: pay once, keep for every school year)
- `hearth_pro_yearly` — auto-renewing subscription, **$12.99/yr** (anchor)
- ONE subscription group "Hearth Pro" with GROUP-level localization set immediately
- Free tier: 14 entries; no time-limited trial
- Rationale: multi-year use (families homeschool for years) justifies a higher lifetime than Merit's $19.99; yearly at $12.99 keeps the ~2x gap.

## App Review Notes (paste into ASC)
The subscription's title, length, price, and functional Terms of Use (EULA) and
Privacy Policy links are shown inside the app on the paywall screen, pinned at the
bottom (visible without scrolling), plus in Settings → Purchases. Restore Purchases
is on the paywall and in Settings. The app is fully usable without an account;
all data is stored on-device. Camera/photo access is used only to attach a photo
of a student's work to a lesson entry. State requirement summaries are informational.

## App Privacy labels
- Purchases → Purchase History: App Functionality, not linked, no tracking
- Everything else: Data Not Collected

## URLs
- Privacy: https://bkdigitalleads-cmyk.github.io/hearth/privacy.html
- Support: https://bkdigitalleads-cmyk.github.io/hearth/support.html
- Marketing: https://bkdigitalleads-cmyk.github.io/hearth/

## Screenshot shot list (Brian, 6.9" device, 5–6 shots)
1. Log tab with both progress bars partway (days + hours) and several entries, one with a photo thumbnail (hero)
2. Entry form filled (student chips, hours, subject chips, notes, work sample)
3. Attendance & hours PDF in share sheet (money shot: table + certification block)
4. Portfolio PDF page with a work-sample photo
5. Settings → State & target (state picker or the state row with days/hours)
6. Paywall (lifetime hero) — also record the 30–60s paywall video here
