#!/usr/bin/env python3
"""Build the per-state homeschool record-keeping pages from src/states.ts.

Run from the repo root:  python3 site/gen_states.py
Writes states/<slug>.html, states/index.html and sitemap.xml. Every figure,
note and source link comes from src/states.ts, which was verified against
each state's statute or department of education (docs/state-sources.md).
"""
import html
import json
import os
import re
from datetime import date

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://bkdigitalleads-cmyk.github.io/hearth"
APP_URL = "https://apps.apple.com/us/app/id6810864311"
APP_NAME = "Homeschool Tracker & Planner"
CHECKED = "September 13, 2026"


def load_states():
    src = open(os.path.join(ROOT, "src", "states.ts")).read()
    rows = []
    for line in src.splitlines():
        line = line.strip().rstrip(",")
        if line.startswith('{"code"'):
            rows.append(json.loads(line))
    return rows


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def esc(s):
    return html.escape(s or "", quote=True)


def clean(s):
    return (s or "").replace(" — ", ": ").replace("—", ":")


CSS = """
body{font-family:-apple-system,Helvetica,Arial,sans-serif;margin:0;color:#2a211a;background:#FBF7F2;line-height:1.65}
.wrap{max-width:720px;margin:0 auto;padding:40px 22px 56px}
h1{font-size:30px;line-height:1.25;color:#3B2A1E;margin:10px 0 8px}
h2{color:#B5532A;font-size:21px;margin-top:36px}
a{color:#B5532A}
.badge{color:#B5532A;font-weight:600;letter-spacing:.4px;font-size:13px;text-transform:uppercase}
.answer{background:#fff;border:1px solid #e8ddd2;border-radius:14px;padding:18px 20px;margin:22px 0}
.answer .row{display:flex;gap:18px;flex-wrap:wrap}
.answer .item{min-width:120px}
.answer .big{font-size:30px;font-weight:700;color:#3B2A1E;line-height:1.1}
.answer .lab{color:#6b5b4e;font-size:13px;text-transform:uppercase;letter-spacing:.3px}
.cta{display:inline-block;background:#B5532A;color:#fff;font-weight:700;padding:13px 24px;border-radius:12px;text-decoration:none;font-size:16px;margin-top:8px}
.cta:hover{background:#9a4522}
table{width:100%;border-collapse:collapse;margin:18px 0;font-size:15px}
th,td{text-align:left;padding:9px 8px;border-bottom:1px solid #e8ddd2;vertical-align:top}
th{color:#6b5b4e;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.3px}
.muted{color:#8c7a6b;font-size:14px}
.grid{columns:2;column-gap:28px;font-size:15px}
.grid a{display:block;padding:3px 0}
footer{margin-top:44px;padding-top:18px;border-top:1px solid #e8ddd2;color:#8c7a6b;font-size:14px}
.crumbs{font-size:14px;color:#8c7a6b}
.faq p{margin:6px 0 16px}
.faq b{color:#3B2A1E}
"""


def page_shell(title, desc, canonical, body, ld=None):
    ld_tags = "".join('<script type="application/ld+json">%s</script>' % json.dumps(x, ensure_ascii=False) for x in (ld or []))
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{canonical}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:url" content="{canonical}">
{ld_tags}
<style>{CSS}</style>
</head>
<body>
<div class="wrap">
{body}
<footer>
<p><a href="{BASE}/">{esc(APP_NAME)}</a> · <a href="{BASE}/states/">All states</a> · <a href="{BASE}/privacy.html">Privacy</a> · <a href="{BASE}/support.html">Support</a></p>
<p>A summary for convenience, not legal advice. Each figure was checked against the state's own statute or department of education on {CHECKED}. Laws change; confirm with your state or a homeschool association before relying on it.</p>
</footer>
</div>
</body>
</html>
"""


def yn(v, yes, no, unknown):
    return yes if v is True else no if v is False else unknown


def fmt_hours(s):
    return f"{s['requiredHours']:,}" if s["requiredHours"] else ""


def short_req(s):
    parts = []
    if s["requiredDays"]:
        parts.append(f"{s['requiredDays']} days")
    if s["requiredHours"]:
        parts.append(f"{s['requiredHours']:,} hours")
    return " or ".join(parts) if parts else "no set days or hours"


def state_page(s, all_states):
    name = s["name"]
    url = f"{BASE}/states/{slug(name)}.html"
    days = s["requiredDays"]
    hours = s["requiredHours"]
    att = s["attendanceLog"]
    port = s["portfolio"]
    hours_note = clean(s["hoursNote"])
    summary = clean(s["summary"])

    if days or hours:
        req = short_req(s)
        title = f"{name} Homeschool Requirements (2026): {req.replace(' or ', ' / ')}, Attendance and Records"
        desc = f"{name} homeschool rules in plain terms: {req} of instruction, whether you must keep an attendance log or portfolio, what to file, and the official source."
    else:
        title = f"{name} Homeschool Requirements (2026): Days, Hours, Attendance and Records"
        desc = f"{name} sets no fixed number of homeschool days or hours. What the state does require, whether to keep attendance or a portfolio, what to file, and the official source."

    att_txt = yn(att, "Yes, keep an attendance record", "Not required by the state", "Not stated; keep one anyway")
    port_txt = yn(port, "Yes, a portfolio or work samples", "Not required by the state", "Not stated")

    faq = [
        (f"How many days or hours of homeschool does {name} require?",
         hours_note),
        (f"Do I have to keep attendance records to homeschool in {name}?",
         (f"{name} requires attendance records. " if att else f"{name} does not require an attendance log by statute. " if att is False else f"{name}'s rules do not say either way. ")
         + "Most families keep one regardless: it is the fastest way to answer a district question, it feeds the year-end paperwork, and it settles any later dispute about days of instruction. A log with the date, hours and subjects for each school day is enough."),
        (f"What do I file to homeschool in {name}?",
         summary),
        ("What is the easiest way to keep the records?",
         f"{APP_NAME} for iPhone logs each school day in a few taps (student, minutes, subject, notes and a photo of the work), tracks days and hours against the {name} target, and exports an attendance and hours PDF with a parent certification line, plus a portfolio PDF. Records stay on the phone; no account is needed."),
    ]
    faq_ld = {"@context": "https://schema.org", "@type": "FAQPage",
              "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}
    crumbs_ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": APP_NAME, "item": BASE + "/"},
        {"@type": "ListItem", "position": 2, "name": "Homeschool requirements by state", "item": BASE + "/states/"},
        {"@type": "ListItem", "position": 3, "name": name, "item": url}]}

    others = "".join(f'<a href="{slug(o["name"])}.html">{esc(o["name"])}: {esc(short_req(o))}</a>' for o in all_states if o["code"] != s["code"])
    verified = "Verified against the official source" if s.get("verified") else "Not yet verified against an official source; treat as a starting point"

    body = f"""
<p class="crumbs"><a href="{BASE}/">{esc(APP_NAME)}</a> › <a href="{BASE}/states/">Homeschool requirements by state</a> › {esc(name)}</p>
<p class="badge">Homeschool record-keeping</p>
<h1>What does {esc(name)} require homeschoolers to keep?</h1>
<div class="answer">
<div class="row">
<div class="item"><div class="lab">Days per year</div><div class="big">{days if days else "None set"}</div></div>
<div class="item"><div class="lab">Hours per year</div><div class="big">{f"{hours:,}" if hours else "None set"}</div></div>
</div>
<p style="margin:14px 0 0"><b>Attendance log:</b> {esc(att_txt)}<br><b>Portfolio:</b> {esc(port_txt)}</p>
</div>

<h2>Days and hours</h2>
<p>{esc(hours_note)}</p>

<h2>What to file and keep</h2>
<p>{esc(summary)}</p>

<h2>A simple record that satisfies most requests</h2>
<p>Whatever {esc(name)} asks for, a daily log covers it: the date, which student, minutes or hours of instruction, the subjects touched, and a line of notes. Add a photo of one piece of work a week and you also have a portfolio. Keep the log all year and the end-of-year form is a matter of copying totals.</p>
<p><a class="cta" href="{APP_URL}">Keep {esc(name)} records in the app</a></p>
<p class="muted">{esc(APP_NAME)} has the {esc(name)} rules built in, logs a school day in a few taps, and exports the attendance and hours PDF with a signature line. Free for the first 14 entries.</p>

<h2>Frequently asked questions</h2>
<div class="faq">
{"".join(f"<p><b>{esc(q)}</b><br>{esc(a)}</p>" for q, a in faq)}
</div>

<h2>Source</h2>
<p><a href="{esc(s['source'])}" rel="nofollow">{esc(s['source'])}</a><br><span class="muted">{esc(verified)}, {CHECKED}.</span></p>

<h2>Other states</h2>
<div class="grid">{others}</div>
"""
    return url, page_shell(title, desc, url, body, [faq_ld, crumbs_ld])


def index_page(states):
    url = f"{BASE}/states/"
    title = "Homeschool Requirements by State (2026): Days, Hours, Attendance and Portfolio Rules for All 50 States"
    desc = "How many days or hours of instruction each US state requires for homeschooling, and whether an attendance log or portfolio is required. All 50 states and DC, with official sources."
    rows = "".join(
        f'<tr><td><a href="{slug(s["name"])}.html">{esc(s["name"])}</a></td><td>{s["requiredDays"] or ""}</td><td>{fmt_hours(s)}</td><td>{yn(s["attendanceLog"], "Yes", "No", "Not stated")}</td><td>{yn(s["portfolio"], "Yes", "No", "Not stated")}</td></tr>'
        for s in states)
    body = f"""
<p class="crumbs"><a href="{BASE}/">{esc(APP_NAME)}</a> › Homeschool requirements by state</p>
<p class="badge">Homeschool record-keeping</p>
<h1>Homeschool requirements by state</h1>
<p>About twenty states set an annual number of days or hours of instruction; the rest ask for a regular schedule or say nothing at all. A smaller group requires an attendance log or a portfolio. Tap a state for the rule in plain terms, what to file, and the official source.</p>
<table>
<tr><th>State</th><th>Days</th><th>Hours</th><th>Attendance log</th><th>Portfolio</th></tr>
{rows}
</table>
<p class="muted">Checked against each state's statute or department of education on {CHECKED}. Not legal advice; confirm with your state.</p>
<p><a class="cta" href="{APP_URL}">Keep your records with {esc(APP_NAME)}</a></p>
"""
    ld = {"@context": "https://schema.org", "@type": "ItemList", "name": "Homeschool requirements by state",
          "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": s["name"], "url": f"{BASE}/states/{slug(s['name'])}.html"} for i, s in enumerate(states)]}
    return url, page_shell(title, desc, url, body, [ld])


def main():
    states = sorted(load_states(), key=lambda s: s["name"])
    assert len(states) == 51, len(states)
    out_dir = os.path.join(ROOT, "states")
    os.makedirs(out_dir, exist_ok=True)
    urls = [f"{BASE}/", f"{BASE}/support.html", f"{BASE}/privacy.html"]
    url, html_ = index_page(states)
    open(os.path.join(out_dir, "index.html"), "w").write(html_)
    urls.append(url)
    for s in states:
        url, html_ = state_page(s, states)
        open(os.path.join(out_dir, slug(s["name"]) + ".html"), "w").write(html_)
        urls.append(url)
    today = date.today().isoformat()
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(
        f"  <url><loc>{u}</loc><lastmod>{today}</lastmod></url>\n" for u in urls) + "</urlset>\n"
    open(os.path.join(ROOT, "sitemap.xml"), "w").write(sm)
    rp = os.path.join(ROOT, "robots.txt")
    if not os.path.exists(rp):
        open(rp, "w").write(f"User-agent: *\nAllow: /\nSitemap: {BASE}/sitemap.xml\n")
    print(f"wrote {len(states)} state pages, index, sitemap ({len(urls)} urls)")


if __name__ == "__main__":
    main()
