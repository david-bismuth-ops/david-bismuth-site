#!/usr/bin/env python3
"""Fabrique une page par projet (projects/<page>/index.html) à partir de data/projects.json,
puis met à jour la liste de ces pages dans sitemap.xml.

Usage, depuis la racine du site :  python3 tools/build_project_pages.py
"""
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://david-bismuth.com"
e = lambda s: html.escape(s or "", quote=True)


def credits_rows(p):
    rows = [("Role", p["role"])]
    for key, label in (("year", "Year"), ("agency", "Agency"), ("director", "Director"), ("studio", "Studio")):
        if p.get(key):
            rows.append((label, p[key]))
    return "\n".join(f"          <dt>{e(k)}</dt><dd>{e(v)}</dd>" for k, v in rows)


def page_html(p, prev, nxt):
    url = f"{SITE}/projects/{p['page']}/"
    poster = f"{SITE}/media/{p['media']}.jpg"
    film = f"{SITE}/media/{p['media']}-full.mp4"
    title = f"{p['title']} — {p['role']} by David Bismuth"
    video_ld = {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        "name": p["title"],
        "description": p["description_en"],
        "thumbnailUrl": poster,
        "contentUrl": film,
        "uploadDate": p["upload_date"],
        "url": url,
        "inLanguage": "en",
        "creator": {"@type": "Person", "@id": f"{SITE}/#david", "name": "David Bismuth"},
    }
    sub = f'\n        <p class="project-sub">{e(p["subtitle"])}</p>' if p.get("subtitle") else ""
    extra = ""
    if p.get("extra_link"):
        extra = f'\n      <p class="project-extra"><a class="ul" href="{e(p["extra_link"][0])}">{e(p["extra_link"][1])}</a></p>'
    portrait = " is-portrait" if p.get("portrait") else ""
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(title)}</title>
  <meta name="description" content="{e(p['description_en'])}">
  <link rel="canonical" href="{url}">
  <meta property="og:type" content="video.other">
  <meta property="og:site_name" content="David Bismuth">
  <meta property="og:title" content="{e(title)}">
  <meta property="og:description" content="{e(p['description_en'])}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{poster}">
  <meta property="og:video" content="{film}">
  <meta name="theme-color" content="#b5b5ae">
  <link rel="icon" type="image/png" href="../../favicon.png">
  <link rel="apple-touch-icon" href="../../favicon.png">
  <link rel="preload" href="../../assets/fonts/inter-tight-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="../../assets/style.css">
  <script type="application/ld+json">
{json.dumps(video_ld, ensure_ascii=False, indent=2)}
  </script>
</head>
<body class="page-project">
  <!-- Page générée par tools/build_project_pages.py depuis data/projects.json : modifier le JSON, pas ce fichier -->
  <header class="site-header">
    <a class="h-role ul" href="../">Composer &amp; Sound Designer</a>
    <a class="h-name ul" href="../../">David Bismuth</a>
    <nav class="h-nav" aria-label="Sections">
      <a class="ul" href="../../games/">games</a>
      <a class="ul" href="../../about/">about</a>
    </nav>
  </header>

  <main class="project">
    <p class="project-back"><a class="ul" href="../">← all projects</a></p>
    <div class="project-player{portrait}">
      <video src="../../media/{e(p['media'])}-full.mp4" poster="../../media/{e(p['media'])}.jpg" controls playsinline preload="metadata"></video>
    </div>
    <div class="project-info">
      <div class="project-head">
        <h1>{e(p['brand'])}</h1>{sub}
      </div>
      <dl class="project-credits">
{credits_rows(p)}
      </dl>
    </div>
    <div class="project-text">
      <p>{e(p['description_en'])}</p>{extra}
    </div>
    <nav class="project-pager" aria-label="Other projects">
      <a class="ul" href="../{e(prev['page'])}/">← {e(prev['title'])}</a>
      <a class="ul" href="../{e(nxt['page'])}/">{e(nxt['title'])} →</a>
    </nav>
  </main>

  <nav class="site-contact" aria-label="Contact">
    <a class="ul" href="mailto:david-bismuth@outlook.fr">mail</a>
    <a class="ul" href="https://www.linkedin.com/in/david-bismuth-2349931a8" target="_blank" rel="noopener">linkedin</a>
    <a class="ul" href="https://www.instagram.com/david__bismuth/" target="_blank" rel="noopener">instagram</a>
    <a class="ul" href="../../cv/David-Bismuth_CV_EN.pdf" target="_blank" rel="noopener">cv</a>
  </nav>

  <script src="../../assets/site.js" defer></script>
</body>
</html>
"""


def main():
    data = json.load(open(os.path.join(ROOT, "data", "projects.json"), encoding="utf-8"))["projects"]
    n = len(data)
    for i, p in enumerate(data):
        out = os.path.join(ROOT, "projects", p["page"])
        os.makedirs(out, exist_ok=True)
        with open(os.path.join(out, "index.html"), "w", encoding="utf-8") as f:
            f.write(page_html(p, data[(i - 1) % n], data[(i + 1) % n]))
    # sitemap : bloc entre les marqueurs, réécrit à chaque fois
    sm_path = os.path.join(ROOT, "sitemap.xml")
    sm = open(sm_path, encoding="utf-8").read()
    block = "  <!-- projets (généré) -->\n" + "".join(
        f"  <url><loc>{SITE}/projects/{p['page']}/</loc></url>\n" for p in data) + "  <!-- /projets -->\n"
    if "<!-- projets (généré) -->" in sm:
        sm = re.sub(r"  <!-- projets \(généré\) -->\n.*?  <!-- /projets -->\n", block, sm, flags=re.S)
    else:
        sm = sm.replace("</urlset>", block + "</urlset>")
    open(sm_path, "w", encoding="utf-8").write(sm)
    print(f"{n} pages projet écrites, sitemap à jour")


if __name__ == "__main__":
    main()
