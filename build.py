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
# nginx sert style.css avec sept jours de cache : sans cette empreinte dans l'adresse,
# un visiteur garde l'ancienne feuille une semaine après chaque retouche (constaté le
# 03/10/2026 : vidéos à 304 px et FAQ sans mise en forme chez qui était déjà passé).
VERSION_STYLE = __import__("hashlib").md5((RACINE / "site" / "style.css").read_bytes()).hexdigest()[:8]

def date_git(chemin):
    """Date du dernier commit qui a touché ce fichier. Sans dépôt, sa date sur le disque.
    Sert de <lastmod> quand la fiche n'en fixe pas : un plan du site qui redate
    toutes les pages à chaque compilation dit aux moteurs qu'elles ont toutes changé."""
    import subprocess
    try:
        d = subprocess.run(["git", "log", "-1", "--format=%cs", "--", str(chemin)],
                           capture_output=True, text=True, cwd=RACINE).stdout.strip()
        if d: return d
    except Exception:
        pass
    try:
        return datetime.date.fromtimestamp(pathlib.Path(chemin).stat().st_mtime).isoformat()
    except Exception:
        return AUJOURD_HUI

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
        # bloc HTML brut : recopié tel quel, indentation comprise.
        # Un <svg> est recopié jusqu'à sa fermeture : ses lignes internes
        # ne commencent pas toutes par « < », et un <p> glissé dedans fait
        # sortir l'analyseur HTML du SVG, qui ne s'affiche alors plus du tout.
        if l.lstrip().startswith("<svg"):
            ferme()
            while i < len(lignes):
                out.append(lignes[i])
                if "</svg>" in lignes[i]: i += 1; break
                i += 1
            continue
        # galerie : lignes consécutives « @video <id> | <titre> | <AAAA-MM-JJ> | <m:ss> | <texte> ».
        # Miniature d'abord, lecteur au clic (une page de vingt lecteurs YouTube chargés
        # d'avance pèserait plusieurs mégaoctets) ; les mêmes lignes nourrissent les
        # VideoObject du JSON-LD (videos_de).
        if l.startswith("@video "):
            ferme()
            out.append('<div class="videos">')
            while i < len(lignes) and lignes[i].startswith("@video "):
                v = video(lignes[i])
                out.append(f'<figure class="vcarte"><button type="button" class="vcarte__lire" data-video="{v["id"]}" '
                           f'aria-label="Lire la vidéo : {esc(v["titre"])}"><img src="https://i.ytimg.com/vi/{v["id"]}/hqdefault.jpg" '
                           f'alt="" loading="lazy" width="480" height="360"><span class="vcarte__play" aria-hidden="true">▶</span></button>'
                           f'<figcaption><b>{esc(v["titre"])}</b><span class="vcarte__meta">{v["annee"]} · {v["duree"]}</span>'
                           f'<span class="vcarte__texte">{enligne(esc(v["texte"]))}</span></figcaption></figure>')
                i += 1
            out.append("</div>")
            continue
        # vidéo YouTube : « @youtube <identifiant> | <titre> ». Lecteur youtube-nocookie,
        # chargé paresseusement : aucun cookie déposé tant qu'on ne lance pas la vidéo,
        # donc pas de bandeau de consentement à ajouter pour une simple page.
        m = re.match(r"^@youtube\s+([\w-]{11})\s*\|\s*(.+)$", l)
        if m:
            ferme()
            vid, titre = m.group(1), esc(m.group(2).strip())
            out.append(f'<figure class="video"><div class="video__cadre"><iframe '
                       f'src="https://www.youtube-nocookie.com/embed/{vid}?rel=0" title="{titre}" '
                       f'loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" '
                       f'allowfullscreen></iframe></div><figcaption>{titre} · '
                       f'<a href="https://www.youtube.com/watch?v={vid}">voir sur YouTube</a></figcaption></figure>')
            i += 1; continue
        if l.lstrip().startswith("<"):
            ferme(); out.append(l); i += 1; continue
        # tableau : lignes « | a | b | », la deuxième étant le séparateur « |---| ».
        # Enveloppé dans un bloc qui défile en largeur : sur téléphone, un tableau
        # de quatre colonnes ferait sinon déborder toute la page.
        if l.startswith("|") and i + 1 < len(lignes) and re.match(r"^\|[\s:|-]+\|\s*$", lignes[i + 1]):
            ferme()
            cellules = lambda x: [c.strip() for c in x.strip().strip("|").split("|")]
            tete = cellules(l); i += 2
            out.append('<div class="tableau"><table><thead><tr>'
                       + "".join(f"<th>{enligne(c)}</th>" for c in tete) + "</tr></thead><tbody>")
            while i < len(lignes) and lignes[i].startswith("|"):
                out.append("<tr>" + "".join(f"<td>{enligne(c)}</td>" for c in cellules(lignes[i])) + "</tr>")
                i += 1
            out.append("</tbody></table></div>")
            continue
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
        while i < len(lignes) and lignes[i].strip() and not re.match(r"^\s*(#{2,4}\s|[-*]\s|\d+\.\s|>\s|<)", lignes[i]):
            para.append(lignes[i]); i += 1
        out.append("<p>" + enligne(" ".join(para)) + "</p>")
    ferme()
    return "\n".join(out)

def video(ligne):
    """« @video <id> | <titre> | <AAAA-MM-JJ> | <m:ss> | <texte> » → dict."""
    vid, titre, date, duree, texte = [x.strip() for x in ligne[len("@video "):].split("|", 4)]
    m, sec = duree.split(":")
    return {"id": vid, "titre": titre, "date": date, "annee": date[:4], "duree": duree,
            "iso": f"PT{int(m)}M{int(sec)}S", "texte": texte}

def videos_de(corps):
    return [video(l) for l in corps.split("\n") if l.startswith("@video ")]

def enligne(t):
    t = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", r'<img src="\2" alt="\1" loading="lazy">', t)
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<em>\1</em>", t)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    return t

# ---------------------------------------------------------------- données structurées
def jsonld(meta, url, corps=""):
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
             "acceptedAnswer": {"@type": "Answer", "text": texte_brut(r)}} for q, r in qr]})
    for v in videos_de(corps):
        blocs.append({"@type": "VideoObject", "name": v["titre"], "description": texte_brut(v["texte"]),
                      "thumbnailUrl": f"https://i.ytimg.com/vi/{v['id']}/hqdefault.jpg",
                      "uploadDate": v["date"], "duration": v["iso"],
                      "embedUrl": f"https://www.youtube-nocookie.com/embed/{v['id']}",
                      "contentUrl": f"https://www.youtube.com/watch?v={v['id']}",
                      "inLanguage": "fr-FR",
                      "creator": {"@type": "Person", "name": "Alexandre Stopnicki", "url": "https://alexandre.ai"},
                      "publisher": {"@type": "Organization", "name": "3h33", "url": SITE_URL + "/"}})
    return json.dumps({"@context": "https://schema.org", "@graph": blocs},
                      ensure_ascii=False, separators=(",", ":"))

def texte_brut(t):
    """Une réponse de FAQ sans sa syntaxe Markdown, pour les données structurées."""
    t = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", t.strip())
    return re.sub(r"\*\*?([^*]+)\*\*?", r"\1", t)

def faq_html(meta):
    """La FAQ, AFFICHÉE. Jusqu'au 03/10/2026 elle n'existait que dans les données
    structurées : invisible du lecteur comme des robots d'IA qui lisent le texte,
    et contraire aux consignes de Google, qui veut un balisage fidèle à la page.
    <details> s'ouvre sans JavaScript, et son texte reste lu par les robots."""
    if not meta.get("faq"):
        return ""
    blocs = []
    for q in meta["faq"]:
        question, reponse = q.split("|", 1)
        blocs.append(f'<details><summary>{esc(question.strip())}</summary>'
                     f'<p>{enligne(esc(reponse.strip()))}</p></details>')
    return ('<section class="faq-page" aria-labelledby="faq-titre">'
            '<h2 id="faq-titre">Questions fréquentes</h2>\n' + "\n".join(blocs) + '</section>')

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
        if meta.get("gabarit") == "accueil":
            ecrire(meta["url"], page_accueil(meta, titre_seo)); ecrites += 1
            continue
        page = GABARIT.replace('href="/style.css"', f'href="/style.css?v={VERSION_STYLE}"')
        page = page.replace("{{titre_seo}}", esc(titre_seo))
        page = page.replace("{{description}}", esc(meta["description"]))
        page = page.replace("{{url}}", url)
        page = page.replace("{{og_type}}", "article" if meta.get("type") == "article" else "website")
        page = page.replace("{{robots}}", '<meta name="robots" content="noindex, follow">'
                            if meta.get("indexer") == "non" else "")
        page = page.replace("{{jsonld}}", jsonld(meta, url, corps))
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
        dessin = ""
        if meta.get("dessin"):
            fichier, legende = (meta["dessin"].split("|") + [""])[:2]
            dessin = (f'<figure class="dessin"><img src="/dessins/{fichier.strip()}" '
                      f'alt="{esc(legende.strip() or meta["titre"])}" loading="lazy" '
                      f'width="1400" height="933"></figure>')
        page = page.replace("{{dessin}}", dessin)
        page = page.replace("{{duree}}", duree_lecture(corps, meta))
        page = page.replace("{{contenu}}", md(corps) + faq_html(meta))
        dest = SITE / url.strip("/") / "index.html" if url != "/" else SITE / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(page, encoding="utf-8")
        ecrites += 1

    sitemap(pages)
    plan(pages)
    llms(pages)
    llms_complet(pages)
    print(f"  ✓ {ecrites} pages écrites, sitemap, plan du site et llms.txt à jour")

def llms(pages):
    """/llms.txt : le résumé du site à l'usage des assistants d'IA (format llmstxt.org).
    Régénéré à chaque construction, comme le sitemap, pour ne jamais décrire un site
    qui n'existe plus. Les archives et les pages légales restent hors du résumé."""
    groupes = {"Offres": [], "Comprendre l'IA": [], "Articles": [], "Autres pages": []}
    for meta, _, _ in sorted(pages, key=lambda p: -float(p[0].get("priorite", "0.7"))):
        u = meta["url"]
        if meta.get("indexer") == "non" or u in ("/", "/plan-du-site/") or u.startswith("/archives/") \
                or float(meta.get("priorite", "0.7")) <= 0.3 or meta.get("type") == "legal":
            continue
        t = meta.get("type", "page")
        cle = ("Offres" if t in ("service", "formation") else "Articles" if t == "article"
               else "Comprendre l'IA" if meta.get("faq") else "Autres pages")
        groupes[cle].append(f"- [{meta['titre']}]({SITE_URL}{u}): {meta['description']}")
    lignes = ["# 3h33", "",
              "> 3h33 est une agence et un organisme de formation français spécialisés dans les "
              "usages de l'intelligence artificielle générative en entreprise, fondés par "
              "Alexandre Stopnicki. 3h33 forme les équipes (masterclass, ateliers, formation "
              "Claude), construit avec elles des outils d'IA en vibe coding (agents, "
              "automatisations, tableaux de bord, méthode Forge en une demi-journée) et produit "
              "des contenus avec son studio créatif.", "",
              "Contact : https://3h33.com/contact/ — les réponses aux questions fréquentes sur "
              "l'IA en entreprise sont rassemblées sur https://3h33.com/ia-en-entreprise/. Le texte "
              "complet du site, en un seul fichier : https://3h33.com/llms-full.txt", ""]
    for nom, items in groupes.items():
        if items:
            lignes += [f"## {nom}", ""] + items + [""]
    lignes += ["## Sites et outils", "",
               f"- [Méthode Forge]({SITE_URL}/forge/): des solutions IA (agent, automatisation, tableau de bord) co-construites avec vos équipes en une demi-journée.",
               f"- [Formation Claude]({SITE_URL}/formation-claude/): formation à Claude (Anthropic) pour salariés et managers, un ou deux jours.",
               f"- [La galaxie 3h33]({SITE_URL}/galaxie/): l'annuaire des sites et applications de l'écosystème 3h33.",
               f"- [Cartographie mondiale des usages de l'IA]({SITE_URL}/cartographie-mondiale-des-usages-de-l-ia/)", "",
               "## Applications éditées par 3h33", "",
               "- [NegoVox](https://negovox.com/): simulateur d'entraînement vocal par IA pour les commerciaux ; un client joué par l'IA, puis un débrief noté sur douze compétences de vente.",
               "- [Media Training Vox](https://media-training-vox.com/): entraînement par IA vocale aux prises de parole des dirigeants, face aux médias, au comité de direction, au conseil ou aux actionnaires.", ""]
    (SITE / "llms.txt").write_text("\n".join(lignes), encoding="utf-8")

def ecrire(url, page):
    dest = SITE / url.strip("/") / "index.html" if url != "/" else SITE / "index.html"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(page, encoding="utf-8")

def page_accueil(meta, titre_seo):
    """La page d'accueil : gabarit à part (gabarits/accueil.html), FAQ et données
    structurées tirées de contenu/accueil.md. La FAQ affichée et celle du JSON-LD
    viennent de la même liste : elles ne peuvent plus diverger (l'ancienne page
    affichait cinq questions et n'en déclarait que quatre)."""
    page = (RACINE / "gabarits" / "accueil.html").read_text(encoding="utf-8")
    faq = "\n".join(f'        <details><summary>{esc(q.split("|",1)[0].strip())}</summary>'
                     f'<p>{enligne(esc(q.split("|",1)[1].strip()))}</p></details>' for q in meta["faq"])
    for cle, val in (("{{titre_seo}}", esc(titre_seo)), ("{{description}}", esc(meta["description"])),
                     ("{{url}}", meta["url"]), ("{{faq}}", faq), ("{{jsonld}}", jsonld_accueil(meta)),
                     ("{{robots}}", '<meta name="robots" content="noindex, nofollow">'
                                    if meta.get("indexer") == "non" else "")):
        page = page.replace(cle, val)
    return page

def jsonld_accueil(meta):
    org, pers = SITE_URL + "/#organisation", SITE_URL + "/#alexandre"
    services = [("Masterclass IA", "/masterclass-ia/"), ("Ateliers de formation à l'IA", "/ateliers-formation/"),
                ("Formation Claude", "/formation-claude/"), ("Méthode Forge", "/forge/"),
                ("Vibe coding : outils sur mesure", "/vibe-coding/"), ("Chatbots et agents IA", "/chatbots/"),
                ("Coaching IA des dirigeants", "/coaching-ia-dirigeants/"), ("Studio créatif IA", "/studio/")]
    graphe = [
        {"@type": ["Organization", "EducationalOrganization"], "@id": org, "name": "3h33",
         "alternateName": ["3h33, l'agence de l'IA", "3H33"], "url": SITE_URL + "/",
         "logo": SITE_URL + "/medias/partage.jpg", "image": SITE_URL + "/medias/partage.jpg",
         "description": "Agence et organisme de formation français spécialisés dans les usages de "
                        "l'intelligence artificielle générative en entreprise : formations, outils sur "
                        "mesure en vibe coding, agents conversationnels et studio créatif.",
         "slogan": "On apprend l'IA en construisant.", "foundingDate": "2010",
         "founder": {"@id": pers}, "email": "info@3h33.fr", "areaServed": "FR",
         "contactPoint": {"@type": "ContactPoint", "contactType": "commercial",
                          "url": SITE_URL + "/contact/", "availableLanguage": ["fr", "en"]},
         "knowsAbout": ["Intelligence artificielle générative", "Formation à l'intelligence artificielle",
                        "Vibe coding", "Agents conversationnels", "AI Act", "IA souveraine",
                        "Learning Management Agentique", "Production audiovisuelle par IA"],
         "makesOffer": [{"@type": "Offer", "itemOffered": {"@type": "Service", "name": n,
                         "url": SITE_URL + u, "provider": {"@id": org}}} for n, u in services],
         "sameAs": ["https://alexandrestopnicki.com", "https://fr.linkedin.com/in/alexandrestopnicki",
                    "https://twitter.com/alexandre3h33", "https://www.facebook.com/3h33.FORMATIONS",
                    "https://instagram.com/alexandre3h33", "https://choucroute-citron.com",
                    "https://negovox.com", "https://media-training-vox.com"]},
        {"@type": "Person", "@id": pers, "name": "Alexandre Stopnicki",
         "jobTitle": "Fondateur de 3h33, formateur et conférencier en intelligence artificielle",
         "description": "Fondateur de 3h33. Dans le numérique depuis trente ans : en 1997, sa société "
                        "Numériland tenait la régie publicitaire du Deuxième Monde, le métavers de Canal+. "
                        "Construit des chatbots depuis 2017 ; chroniqueur de l'émission The Artificial "
                        "Intelligence Society.",
         "url": "https://alexandrestopnicki.com", "image": SITE_URL + "/medias/alexandre-stopnicki.jpg",
         "worksFor": {"@id": org},
         "knowsAbout": ["Intelligence artificielle générative", "Vibe coding", "Pédagogie",
                        "Agents conversationnels", "Métavers"],
         "sameAs": ["https://fr.linkedin.com/in/alexandrestopnicki", "https://alexandre.ai",
                    "https://alexandrestopnicki.com"]},
        {"@type": "WebSite", "@id": SITE_URL + "/#site", "url": SITE_URL + "/", "name": "3h33",
         "inLanguage": "fr-FR", "publisher": {"@id": org}},
        {"@type": "WebPage", "@id": SITE_URL + "/#accueil", "url": SITE_URL + "/",
         "name": meta["titre"], "description": meta["description"], "inLanguage": "fr-FR",
         "isPartOf": {"@id": SITE_URL + "/#site"}, "about": {"@id": org},
         "primaryImageOfPage": SITE_URL + "/medias/partage.jpg"},
        {"@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q.split("|", 1)[0].strip(),
             "acceptedAnswer": {"@type": "Answer", "text": texte_brut(q.split("|", 1)[1])}}
            for q in meta["faq"]]},
    ]
    return json.dumps({"@context": "https://schema.org", "@graph": graphe},
                      ensure_ascii=False, separators=(",", ":"))

def llms_complet(pages):
    """/llms-full.txt : le texte entier des pages utiles, en Markdown propre, pour les
    assistants d'IA qui préfèrent lire un seul fichier que parcourir le site. Le HTML
    brut (SVG, blocs de mise en page) est retiré ; une vidéo devient une ligne de lien."""
    retenues = []
    for meta, corps, _ in pages:
        u = meta["url"]
        accueil = meta.get("gabarit") == "accueil"
        if not accueil and (meta.get("indexer") == "non" or u.startswith("/archives/")
                            or u == "/plan-du-site/" or float(meta.get("priorite", "0.7")) <= 0.3):
            continue
        retenues.append((0 if accueil else 1, -float(meta.get("priorite", "0.7")), meta, corps))
    blocs = ["# 3h33 — texte complet du site", "",
             "> 3h33 est une agence et un organisme de formation français, créé en 2010 par "
             "Alexandre Stopnicki, spécialisé dans les usages de l'intelligence artificielle "
             "générative en entreprise. Résumé court : " + SITE_URL + "/llms.txt", ""]
    for _, _, meta, corps in sorted(retenues, key=lambda r: (r[0], r[1])):
        url = SITE_URL + ("/" if meta.get("gabarit") == "accueil" else meta["url"])
        texte = []
        if meta.get("gabarit") != "accueil":
            dans_svg = False
            for l in corps.split("\n"):
                if l.lstrip().startswith("<svg"): dans_svg = True
                if dans_svg:
                    if "</svg>" in l: dans_svg = False
                    continue
                if l.lstrip().startswith("<"): continue
                if l.startswith("@video "):
                    v = video(l)
                    texte.append(f"- Vidéo « {v['titre']} » ({v['annee']}, {v['duree']}) : {texte_brut(v['texte'])} — https://www.youtube.com/watch?v={v['id']}")
                    continue
                m = re.match(r"^@youtube\s+([\w-]{11})\s*\|\s*(.+)$", l)
                texte.append(f"Vidéo : {m.group(2).strip()} — https://www.youtube.com/watch?v={m.group(1)}" if m else l)
        blocs += [f"# {meta['titre']}", f"URL : {url}", "", f"> {meta['description']}", ""]
        if meta.get("chapo"):
            blocs += [texte_brut(meta["chapo"]), ""]
        if texte:
            blocs += [re.sub(r"\n{3,}", "\n\n", "\n".join(texte)).strip(), ""]
        if meta.get("faq"):
            blocs += ["## Questions fréquentes", ""]
            for q in meta["faq"]:
                question, reponse = q.split("|", 1)
                blocs += [f"**{question.strip()}** {texte_brut(reponse)}", ""]
        blocs += ["---", ""]
    (SITE / "llms-full.txt").write_text("\n".join(blocs), encoding="utf-8")

def sitemap(pages):
    lignes = ['<?xml version="1.0" encoding="UTF-8"?>',
              '<urlset xmlns="http://www.sitemap.org/schemas/sitemap/0.9">'.replace("sitemap.org", "sitemaps.org")]
    entrees = [("/", "1.0", date_git(SITE / "index.html"))]
    for meta, _, _ in pages:
        if meta.get("indexer") == "non" or meta["url"] == "/":
            continue
        prio = meta.get("priorite", "0.7")
        entrees.append((meta["url"], prio, meta.get("modifie") or date_git(RACINE / "contenu" / meta["_fichier"])))
    # les sept sites HTML purs, conservés à l'identique
    for u in ("/galaxie/", "/forge/", "/formation-claude/", "/podcast-voix-de-lia/",
              "/verif-nom/", "/cartographie-mondiale-des-usages-de-l-ia/", "/cobrandz/"):
        entrees.append((u, "0.8", date_git(SITE / u.strip("/") / "index.html")))
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
