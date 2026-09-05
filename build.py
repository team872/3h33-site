#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Générateur du site 3h33.com.

  contenu/*.md  +  gabarits/page.html   ->   site/<url>/index.html

Chaque fichier de contenu porte un en-tête (front matter) qui décrit la page et
son référencement. Le script produit aussi le plan du site, le sitemap XML et
les données structurées.

    python3 build.py            construit tout
    python3 build.py --verifie  contrôle sans écrire
"""
import json, re, sys, html, pathlib, datetime, shutil

def esc(t):
    """Échappe &, <, > et les guillemets doubles, mais laisse les apostrophes."""
    return (str(t).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))

RACINE = pathlib.Path(__file__).parent
CONTENU = RACINE / "contenu"
SITE = RACINE / "site"
GABARIT = (RACINE / "gabarits" / "page.html").read_text(encoding="utf-8")
SITE_URL = "https://3h33.com"
AUJOURD_HUI = datetime.date.today().isoformat()

# ---------------------------------------------------------------- front matter
def lire_fiche(chemin):
    txt = chemin.read_text(encoding="utf-8")
    if not txt.startswith("---"):
        raise SystemExit(f"{chemin.name} : en-tête manquant")
    _, entete, corps = txt.split("---", 2)
    meta = {}
    cle = None
    for ligne in entete.strip().splitlines():
        if ligne.startswith("  - "):                 # liste
            meta.setdefault(cle, []).append(ligne[4:].strip())
            continue
        if ":" not in ligne:
            continue
        cle, val = ligne.split(":", 1)
        cle, val = cle.strip(), val.strip()
        if val.startswith('"') and val.endswith('"'):
            val = val[1:-1]
        meta[cle] = val if val else []
    meta["_fichier"] = chemin.name
    return meta, corps.strip()

# ---------------------------------------------------------------- markdown
def md(texte):
    """Markdown minimal, suffisant pour nos pages, sans dépendance."""
    out, i, lignes = [], 0, texte.split("\n")
    liste = None
    def ferme():
        nonlocal liste
        if liste:
            out.append(f"</{liste}>")
            liste = None
    while i < len(lignes):
        l = lignes[i]
        # bloc HTML brut : recopié tel quel
        if l.startswith("<"):
            ferme(); out.append(l); i += 1; continue
        if not l.strip():
            ferme(); i += 1; continue
        m = re.match(r"^(#{2,4})\s+(.*)$", l)
        if m:
            ferme()
            n = len(m.group(1))
            out.append(f"<h{n}>{enligne(m.group(2))}</h{n}>")
            i += 1; continue
        if re.match(r"^[-*]\s+", l):
            if liste != "ul": ferme(); out.append("<ul>"); liste = "ul"
            item = re.sub(r"^[-*]\s+", "", l)
            out.append("<li>" + enligne(item) + "</li>")
            i += 1; continue
        if re.match(r"^\d+\.\s+", l):
            if liste != "ol": ferme(); out.append("<ol>"); liste = "ol"
            item = re.sub(r"^\d+\.\s+", "", l)
            out.append("<li>" + enligne(item) + "</li>")
            i += 1; continue
        if l.startswith("> "):
            ferme()
            bloc = []
            while i < len(lignes) and lignes[i].startswith("> "):
                bloc.append(lignes[i][2:]); i += 1
            out.append("<blockquote><p>" + enligne(" ".join(bloc)) + "</p></blockquote>")
            continue
        if l.strip() == "---":
            ferme(); out.append("<hr>"); i += 1; continue
        ferme()
        para = [l]
        i += 1
        while i < len(lignes) and lignes[i].strip() and not re.match(r"^(#{2,4}\s|[-*]\s|\d+\.\s|>\s|<)", lignes[i]):
            para.append(lignes[i]); i += 1
        out.append("<p>" + enligne(" ".join(para)) + "</p>")
    ferme()
    return "\n".join(out)

def enligne(t):
    t = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", r'<img src="\2" alt="\1" loading="lazy">', t)
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<em>\1</em>", t)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    return t

# ---------------------------------------------------------------- données structurées
def jsonld(meta, url):
    fil = [{"@type": "ListItem", "position": 1, "name": "Accueil", "item": SITE_URL + "/"}]
    for n, (nom, lien) in enumerate(fil_dariane(meta), start=2):
        fil.append({"@type": "ListItem", "position": n, "name": nom,
                    **({"item": SITE_URL + lien} if lien else {})})
    blocs = [{"@type": "BreadcrumbList", "itemListElement": fil}]

    t = meta.get("type", "page")
    base = {"name": meta["titre"], "description": meta["description"],
            "url": SITE_URL + url, "inLanguage": "fr-FR",
            "isPartOf": {"@type": "WebSite", "name": "3h33", "url": SITE_URL + "/"},
            "publisher": {"@type": "Organization", "name": "3h33", "url": SITE_URL + "/"}}
    if t == "formation":
        blocs.append({"@type": "Course", **base,
                      "provider": {"@type": "Organization", "name": "3h33", "url": SITE_URL + "/"},
                      "teaches": meta.get("enseigne", meta["titre"]),
                      "hasCourseInstance": {"@type": "CourseInstance",
                                            "courseMode": meta.get("mode", "blended"),
                                            "courseWorkload": meta.get("duree", "PT2H")}})
    elif t == "article":
        blocs.append({"@type": "BlogPosting", **base, "headline": meta["titre"],
                      "datePublished": meta.get("publie", AUJOURD_HUI),
                      "dateModified": meta.get("modifie", meta.get("publie", AUJOURD_HUI)),
                      "author": {"@type": "Person", "name": "Alexandre Stopnicki",
                                 "url": "https://alexandrestopnicki.com"}})
    elif t == "service":
        blocs.append({"@type": "Service", **base,
                      "serviceType": meta.get("service", meta["titre"]),
                      "areaServed": "FR",
                      "provider": {"@type": "Organization", "name": "3h33", "url": SITE_URL + "/"}})
    else:
        blocs.append({"@type": "WebPage", **base})

    if meta.get("faq"):
        qr = [q.split("|") for q in meta["faq"]]
        blocs.append({"@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q.strip(),
             "acceptedAnswer": {"@type": "Answer", "text": r.strip()}} for q, r in qr]})
    return json.dumps({"@context": "https://schema.org", "@graph": blocs},
                      ensure_ascii=False, separators=(",", ":"))

def fil_dariane(meta):
    """[(nom, lien ou None pour la page courante)]"""
    fil = []
    if meta.get("rubrique"):
        nom, lien = meta["rubrique"].split("|")
        fil.append((nom.strip(), lien.strip()))
    courant = meta.get("fil", meta["titre"])
    # ne pas répéter la rubrique quand la page EST la rubrique
    if fil and fil[-1][0].lower() == courant.lower():
        return [(courant, None)]
    fil.append((courant, None))
    return fil

def duree_lecture(corps, meta):
    """Une horloge et un nombre de minutes, sur les pages qu'on lit vraiment.
    Deux cents mots la minute. Rien sur les pages légales ni le plan du site."""
    if meta.get("duree_lecture") == "non" or meta.get("priorite") in ("0.2", "0.3"):
        return ""
    mots = len(re.sub(r"<[^>]+>", " ", corps).split())
    if mots < 260:
        return ""
    minutes = max(1, round(mots / 200))
    return ('<p class="duree-lecture"><svg viewBox="0 0 24 24" aria-hidden="true">'
            '<circle class="c" cx="12" cy="12" r="9"/>'
            '<path class="a" d="M12 7v5l3.2 2"/></svg>'
            f'{minutes} minute{"s" if minutes > 1 else ""} de lecture</p>')


def fil_html(meta):
    parts = ['<a href="/">Accueil</a>']
    for nom, lien in fil_dariane(meta):
        parts.append(f'<a href="{lien}">{esc(nom)}</a>' if lien
                     else f'<span aria-current="page">{esc(nom)}</span>')
    return ' <span aria-hidden="true">›</span> '.join(parts)

# ---------------------------------------------------------------- construction
def construire(verifie=False):
    fiches = sorted(CONTENU.glob("*.md"))
    if not fiches:
        raise SystemExit("Aucun contenu dans contenu/")
    pages, erreurs = [], []
    for f in fiches:
        meta, corps = lire_fiche(f)
        for champ in ("titre", "description", "url"):
            if not meta.get(champ):
                erreurs.append(f"{f.name} : « {champ} » manquant")
        if len(meta.get("description", "")) > 165:
            erreurs.append(f"{f.name} : description de {len(meta['description'])} caractères (max 165)")
        titre_seo = meta.get("titre_seo") or f"{meta['titre']} · 3h33"
        if len(titre_seo) > 65:
            erreurs.append(f"{f.name} : titre de {len(titre_seo)} caractères (max 65)")
        pages.append((meta, corps, titre_seo))

    urls = [m["url"] for m, _, _ in pages]
    for u in set(urls):
        if urls.count(u) > 1:
            erreurs.append(f"adresse en double : {u}")
    if erreurs:
        print("\n".join("  ✕ " + e for e in erreurs))
        if verifie or True:
            raise SystemExit(f"{len(erreurs)} problème(s), rien n'a été écrit.")
    if verifie:
        print(f"  ✓ {len(pages)} pages, aucun problème"); return

    ecrites = 0
    for meta, corps, titre_seo in pages:
        url = meta["url"]
        page = GABARIT
        page = page.replace("{{titre_seo}}", esc(titre_seo))
        page = page.replace("{{description}}", esc(meta["description"]))
        page = page.replace("{{url}}", url)
        page = page.replace("{{og_type}}", "article" if meta.get("type") == "article" else "website")
        page = page.replace("{{robots}}", '<meta name="robots" content="noindex, follow">'
                            if meta.get("indexer") == "non" else "")
        page = page.replace("{{jsonld}}", jsonld(meta, url))
        page = page.replace("{{fil}}", fil_html(meta))
        page = page.replace("{{titre}}", esc(meta["titre"]))
        if meta.get("heure"):
            eyebrow = (f'<p class="eyebrow eyebrow--heure">{esc(meta.get("eyebrow", meta["titre"]))} · '
                       f'<span class="hh">{esc(meta["heure"])}</span></p>')
        elif meta.get("eyebrow"):
            eyebrow = f'<p class="eyebrow">{esc(meta["eyebrow"])}</p>'
        else:
            eyebrow = ""
        page = page.replace("{{eyebrow}}", eyebrow)
        page = page.replace("{{chapo}}", f'<p class="chapo">{enligne(esc(meta["chapo"]))}</p>'
                            if meta.get("chapo") else "")
        page = page.replace("{{duree}}", duree_lecture(corps, meta))
        page = page.replace("{{contenu}}", md(corps))
        dest = SITE / url.strip("/") / "index.html" if url != "/" else SITE / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(page, encoding="utf-8")
        ecrites += 1

    sitemap(pages)
    plan(pages)
    print(f"  ✓ {ecrites} pages écrites, sitemap et plan du site à jour")

def sitemap(pages):
    lignes = ['<?xml version="1.0" encoding="UTF-8"?>',
              '<urlset xmlns="http://www.sitemap.org/schemas/sitemap/0.9">'.replace("sitemap.org", "sitemaps.org")]
    entrees = [("/", "1.0", AUJOURD_HUI)]
    for meta, _, _ in pages:
        if meta.get("indexer") == "non" or meta["url"] == "/":
            continue
        prio = meta.get("priorite", "0.7")
        entrees.append((meta["url"], prio, meta.get("modifie", AUJOURD_HUI)))
    # les sept sites HTML purs, conservés à l'identique
    for u in ("/galaxie/", "/forge/", "/formation-claude/", "/podcast-voix-de-lia/",
              "/verif-nom/", "/cartographie-mondiale-des-usages-de-l-ia/", "/cobrandz/"):
        entrees.append((u, "0.8", AUJOURD_HUI))
    for url, prio, date in entrees:
        lignes += ["  <url>", f"    <loc>{SITE_URL}{url}</loc>",
                   f"    <lastmod>{date}</lastmod>", f"    <priority>{prio}</priority>", "  </url>"]
    lignes.append("</urlset>")
    (SITE / "sitemap.xml").write_text("\n".join(lignes) + "\n", encoding="utf-8")

def plan(pages):
    par_rubrique = {}
    for meta, _, _ in pages:
        if meta.get("indexer") == "non":
            continue
        r = meta.get("rubrique", "|").split("|")[0].strip() or "Le site"
        par_rubrique.setdefault(r, []).append(meta)
    corps = []
    for rub in sorted(par_rubrique):
        corps.append(f"## {rub}")
        for m in sorted(par_rubrique[rub], key=lambda m: m["titre"]):
            corps.append(f"- [{m['titre']}]({m['url']}) — {m['description'][:90]}")
        corps.append("")
    corps.append("## Sites et outils")
    for nom, u in (("La galaxie 3h33", "/galaxie/"), ("Méthode Forge", "/forge/"),
                   ("Formation Claude", "/formation-claude/"), ("Les Voix de l'IA", "/podcast-voix-de-lia/"),
                   ("Vérifier un nom", "/verif-nom/"),
                   ("Cartographie mondiale des usages de l'IA", "/cartographie-mondiale-des-usages-de-l-ia/"),
                   ("Cobrandz", "/cobrandz/")):
        corps.append(f"- [{nom}]({u})")
    (CONTENU / "plan-du-site.md").write_text(
        "---\n"
        "titre: \"Plan du site\"\n"
        "titre_seo: \"Plan du site · 3h33\"\n"
        "description: \"Toutes les pages de 3h33.com : formations à l'IA, prestations de l'agence, vibe coding, studio créatif, podcasts et archives.\"\n"
        "url: /plan-du-site/\n"
        "priorite: 0.3\n"
        "chapo: \"Toutes les pages du site, rubrique par rubrique.\"\n"
        "---\n\n" + "\n".join(corps), encoding="utf-8")

if __name__ == "__main__":
    construire(verifie="--verifie" in sys.argv)
