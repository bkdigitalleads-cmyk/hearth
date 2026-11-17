# Hearth change log

Newest first. One entry per commit: date, version/build, what changed and why.

- 2026-11-17: Version 1.0.7 build 12 (from 1.0.6 build 11). Keyword release, no feature or design changes. app.json: version 1.0.7, ios.buildNumber 12 ("scheme": "hearth" kept). store/metadata.md: es-MX keywords are now school,home,teacher,class,schedule,homework,gradebook,kids,learning,report,card,reading,daily,family (100 characters); en-US keywords unchanged; What's New for 1.0.7 is "Small fixes and improvements."; the App Privacy note no longer says "Data Not Collected" and now matches the live label (Purchases, purchase history, not linked to you). Em dashes removed from store/metadata.md. privacy.html already describes RevenueCat receiving purchase history and never says "Data Not Collected", so it is unchanged.
  - Checked: npx tsc --noEmit passes with no errors. The repo has no unit tests and no test that pins the version or build. Keyword string measured at 100 characters with wc -c. npx expo-doctor: 20 of 21 checks pass; the one failure is the existing newArchEnabled schema warning (see below), same as on main. This goes in as a PR; merging it to main touches app.json and starts a paid EAS build and TestFlight upload.
- 2026-11-03: Website only, no app build (app.json still 1.0.6 build 11). Support address on the website changed from the personal Gmail to bkdigitalleads@gmail.com in index.html, privacy.html, support.html. App source, app.json and store/ untouched; the in-app support address changes in the next release.
  - Checked: .eas/workflows/deploy.yml only runs on pushes to main that touch app.json, eas.json, package*.json, App.tsx, index.ts, src/ or assets/, so this commit (website files and NOTES.md only) starts no EAS build or submit. git grep shows no brianwkershner left in the changed files.
- 2026-10-15: Added CLAUDE.md, AUDIT.md (read-only bug check from Cowork) and this log. No app code changed. Live version 1.0.6 build 11.

## Noticed, not changed

- npx expo-doctor flags `newArchEnabled` in app.json as not allowed by the SDK 57 config schema. It was already there in 1.0.6; left alone because removing it is a build config change outside a keyword release.
- privacy.html uses em dashes (`&mdash;`) in five places, including the page title. Left alone because this release does not touch the website.
