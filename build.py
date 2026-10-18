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
        if l.startswith("@vedette "):
            ferme()
            v = video("@video " + l[len("@vedette "):])
            out.append(f'<figure class="vcarte vcarte--vedette"><button type="button" class="vcarte__lire" data-video="{v["id"]}" '
                       f'aria-label="Lire la vidéo : {esc(v["titre"])}"><img src="https://i.ytimg.com/vi/{v["id"]}/maxresdefault.jpg" '
                       f'alt="" loading="lazy" width="1280" height="720"><span class="vcarte__play" aria-hidden="true">▶</span></button>'
                       f'<figcaption><b>{esc(v["titre"])}</b><span class="vcarte__meta">{v["annee"]} · {v["duree"]}</span>'
                       f'<span class="vcarte__texte">{enligne(esc(v["texte"]))}</span></figcaption></figure>')
            i += 1; continue
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
    return [video("@video " + l.split(" ", 1)[1]) for l in corps.split("\n")
            if l.startswith("@video ") or l.startswith("@vedette ")]

def enligne(t):
    t = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", r'<img src="\2" alt="\1" loading="lazy">', t)
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<![\w*])\*([^*\n]+)\*(?![\w*])", r"<em>\1</em>", t)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    return t

# ---------------------------------------------------------------- entités
# Une seule définition de « 3h33 » et d'« Alexandre Stopnicki », reprise par TOUTES
# les pages avec le même @id : c'est ce qui permet à Google, Bing et aux assistants
# d'IA de comprendre que la page Masterclass, l'accueil et le blog parlent de la même
# organisation et de la même personne (18/10/2026). Avant, chaque page déclarait une
# « Organization » anonyme, sans @id ni sameAs : quatre-vingts organisations homonymes.
# sameAs : uniquement des profils officiels déjà cités dans le site. Les comptes
# personnels d'Alexandre vont sur la Personne, pas sur l'Organisation.
ORG_ID, PERS_ID, SITE_ID = SITE_URL + "/#organisation", SITE_URL + "/#alexandre", SITE_URL + "/#site"
ORG_SAMEAS = ["https://www.facebook.com/3h33.FORMATIONS", "https://twitter.com/alexandre3h33",
              "https://instagram.com/alexandre3h33"]
PERS_SAMEAS = ["https://fr.linkedin.com/in/alexandrestopnicki", "https://alexandrestopnicki.com",
               "https://alexandre.ai", "https://twitter.com/alexandre3h33"]
LOGO = {"@type": "ImageObject", "url": SITE_URL + "/medias/partage.jpg", "width": 2400, "height": 1260}

def noeud_org(complet=False):
    n = {"@type": ["Organization", "EducationalOrganization"], "@id": ORG_ID, "name": "3h33",
         "alternateName": ["3h33, l'agence de l'IA", "3H33"], "url": SITE_URL + "/",
         "logo": LOGO, "founder": {"@id": PERS_ID}, "foundingDate": "2010",
         "areaServed": "FR", "sameAs": ORG_SAMEAS}
    if complet:
        n.update({
            "image": SITE_URL + "/medias/partage.jpg",
            "description": "Agence et organisme de formation français spécialisés dans les usages de "
                           "l'intelligence artificielle générative en entreprise : formations, outils sur "
                           "mesure en vibe coding, agents conversationnels et studio créatif.",
            "slogan": "On apprend l'IA en construisant.", "email": "info@3h33.fr",
            "contactPoint": {"@type": "ContactPoint", "contactType": "commercial",
                             "url": SITE_URL + "/contact/", "email": "info@3h33.fr",
                             "availableLanguage": ["fr", "en"]},
            "knowsAbout": ["Intelligence artificielle générative", "Formation à l'intelligence artificielle",
                           "Vibe coding", "Agents conversationnels", "AI Act", "IA souveraine",
                           "Learning Management Agentique", "Production audiovisuelle par IA"],
            "brand": [{"@type": "Brand", "name": n, "url": u} for n, u in (
                ("BotMoiLeQi", "https://botmoileqi.com"), ("NegoVox", "https://negovox.com"),
                ("Media Training Vox", "https://media-training-vox.com"),
                ("Le savez-vous ?", "https://le-savez-vous.com"))],
            "subjectOf": [{"@id": SITE_URL + "/podcast-voix-de-lia/#serie"}]})
    return n

def noeud_personne(complet=False):
    n = {"@type": "Person", "@id": PERS_ID, "name": "Alexandre Stopnicki",
         "url": "https://alexandrestopnicki.com", "image": SITE_URL + "/medias/alexandre-stopnicki.jpg",
         "jobTitle": "Fondateur de 3h33, formateur et conférencier en intelligence artificielle",
         "worksFor": {"@id": ORG_ID}, "sameAs": PERS_SAMEAS}
    if complet:
        n.update({
            "description": "Fondateur de 3h33. Dans le numérique depuis trente ans : en 1997, sa société "
                           "Numériland tenait la régie publicitaire du Deuxième Monde, le métavers de Canal+. "
                           "Construit des chatbots depuis 2017 ; chroniqueur de l'émission The Artificial "
                           "Intelligence Society.",
            "worksFor": [{"@id": ORG_ID},
                         {"@type": "Organization", "@id": "https://listen-to-my-art.com/#organisation",
                          "name": "Listen to my art", "alternateName": "Musée à la maison",
                          "url": "https://listen-to-my-art.com/"}],
            "knowsAbout": ["Intelligence artificielle générative", "Vibe coding", "Pédagogie",
                           "Agents conversationnels", "Métavers"],
            "nationality": {"@type": "Country", "name": "France"}, "knowsLanguage": ["fr", "en"]})
    return n

def noeud_site():
    return {"@type": "WebSite", "@id": SITE_ID, "url": SITE_URL + "/", "name": "3h33",
            "alternateName": "3h33.com", "inLanguage": "fr-FR", "publisher": {"@id": ORG_ID}}

# Les deux podcasts, tels que le site les décrit (podcasts.md et la page de la série).
PODCASTS = [
    {"@type": "PodcastSeries", "@id": SITE_URL + "/podcast-voix-de-lia/#serie", "name": "Les Voix de l'IA",
     "url": SITE_URL + "/podcast-voix-de-lia/", "webFeed": SITE_URL + "/podcast-voix-de-lia/flux.xml",
     "inLanguage": "fr-FR", "image": SITE_URL + "/podcast-voix-de-lia/images/partage.jpg",
     "description": "130 portraits audio d'une dizaine de minutes des femmes et des hommes qui "
                    "font la tech et l'intelligence artificielle, racontés par Ada, Alan et Lia, des "
                    "IA-nimateurs ; chaque fait est vérifié et les sources sont sous chaque épisode.",
     "author": {"@id": PERS_ID}, "publisher": {"@id": ORG_ID},
     "sameAs": ["https://podcasts.apple.com/fr/podcast/les-voix-de-lia/id6822430918",
                "https://open.spotify.com/show/0rdllAOWQFhE8vTfKgAxzV"]},
    {"@type": "PodcastSeries", "@id": "https://choucroute-citron.com/#serie", "name": "Choucroute Citron",
     "url": "https://choucroute-citron.com/", "inLanguage": "fr-FR",
     "description": "Le podcast animé par Alexandre Stopnicki où des IA-nimatrices et IA-nimateurs "
                    "interrogent en direct des invités au parcours remarquable.",
     "author": {"@id": PERS_ID},
     "sameAs": ["https://podcasts.apple.com/fr/podcast/choucroute-citron/id1812305442",
                "https://podcast.ausha.co/show/9peJafn6W6DR"]},
]

# La vidéo « Mon nouveau métier : le vibe coding » (17/10/2026), servie sous /pour/.
VIDEO_VIBE = {"@type": "VideoObject", "@id": SITE_URL + "/pour/alexandre-vibe-coding/#video",
              "name": "Mon nouveau métier : le vibe coding",
              "description": "30 ans dans le digital, et un nouveau métier : réaliser les projets des "
                             "entreprises avec l'IA, vite et sur mesure. Le message d'Alexandre Stopnicki, "
                             "en moins d'une minute, avec sa voix clonée par IA.",
              "thumbnailUrl": [SITE_URL + "/pour/alexandre-vibe-coding/vignette.jpg",
                               SITE_URL + "/pour/alexandre-vibe-coding/alexandre.jpg"],
              "uploadDate": "2026-10-17", "duration": "PT49S", "inLanguage": "fr-FR",
              "contentUrl": SITE_URL + "/pour/alexandre-vibe-coding/video.mp4",
              "url": SITE_URL + "/pour/alexandre-vibe-coding/",
              "creator": {"@id": PERS_ID}, "publisher": {"@id": ORG_ID}}

def image_page(meta):
    if meta.get("dessin"):
        return SITE_URL + "/dessins/" + meta["dessin"].split("|")[0].strip()
    return SITE_URL + "/medias/partage.jpg"

# ---------------------------------------------------------------- données structurées
def jsonld(meta, url, corps="", modifie=None):
    page_id = SITE_URL + url + "#page"
    fil = [{"@type": "ListItem", "position": 1, "name": "Accueil", "item": SITE_URL + "/"}]
    for n, (nom, lien) in enumerate(fil_dariane(meta), start=2):
        fil.append({"@type": "ListItem", "position": n, "name": nom,
                    "item": SITE_URL + (lien or url)})
    blocs = [noeud_org(), noeud_personne(), noeud_site(),
             {"@type": "BreadcrumbList", "@id": SITE_URL + url + "#fil", "itemListElement": fil}]

    t = meta.get("type", "page")
    # La page elle-même : un WebPage (AboutPage, ContactPage, CollectionPage selon
    # le cas) qui dit de quoi il parle, quand il a changé, et qui l'édite.
    type_page = {"/a-propos/": "AboutPage", "/contact/": "ContactPage", "/plan-du-site/": "CollectionPage",
                 "/blog/": "CollectionPage", "/archives/": "CollectionPage", "/ia-en-entreprise/": "FAQPage"
                 }.get(url, "WebPage")
    page = {"@type": type_page, "@id": page_id, "url": SITE_URL + url, "name": meta["titre"],
            "description": meta["description"], "inLanguage": "fr-FR",
            "isPartOf": {"@id": SITE_ID}, "publisher": {"@id": ORG_ID},
            "breadcrumb": {"@id": SITE_URL + url + "#fil"},
            "primaryImageOfPage": {"@type": "ImageObject", "url": image_page(meta)}}
    if modifie:
        page["dateModified"] = modifie
    if meta.get("en_bref"):
        page["abstract"] = texte_brut(meta["en_bref"])
    if url == "/a-propos/":
        page["mainEntity"] = {"@id": ORG_ID}
        page["about"] = [{"@id": ORG_ID}, {"@id": PERS_ID}]
        blocs[0], blocs[1] = noeud_org(complet=True), noeud_personne(complet=True)
    blocs.append(page)

    base = {"name": meta["titre"], "description": meta["description"],
            "url": SITE_URL + url, "inLanguage": "fr-FR",
            "mainEntityOfPage": {"@id": page_id}}
    if t == "formation":
        modes = [m.strip() for m in meta.get("mode", "blended").split(",")]
        blocs.append({"@type": "Course", "@id": SITE_URL + url + "#formation", **base,
                      "provider": {"@id": ORG_ID}, "instructor": {"@id": PERS_ID},
                      "teaches": meta.get("enseigne", meta["titre"]),
                      "hasCourseInstance": [{"@type": "CourseInstance", "courseMode": m,
                                             "courseWorkload": meta.get("duree", "PT2H"),
                                             "inLanguage": "fr-FR",
                                             "instructor": {"@id": PERS_ID}} for m in modes]})
    elif t == "article":
        blocs.append({"@type": "BlogPosting", "@id": SITE_URL + url + "#article", **base,
                      "headline": meta["titre"][:110], "image": image_page(meta),
                      "datePublished": meta.get("publie", AUJOURD_HUI),
                      "dateModified": meta.get("modifie", meta.get("publie", AUJOURD_HUI)),
                      "author": {"@id": PERS_ID}, "publisher": {"@id": ORG_ID}})
    elif t == "service":
        blocs.append({"@type": "Service", "@id": SITE_URL + url + "#service", **base,
                      "serviceType": meta.get("service", meta["titre"]),
                      "areaServed": {"@type": "Country", "name": "France"},
                      "provider": {"@id": ORG_ID}})
    if meta.get("definition"):
        terme, sens = meta["definition"].split("|", 1)
        blocs.append({"@type": "DefinedTerm", "@id": SITE_URL + url + "#definition",
                      "name": terme.strip(), "description": texte_brut(sens), "inLanguage": "fr-FR",
                      "url": SITE_URL + url,
                      "inDefinedTermSet": {"@type": "DefinedTermSet", "name": "Le vocabulaire de l'IA, par 3h33",
                                           "url": SITE_URL + "/ia-en-entreprise/"}})
        page["about"] = {"@id": SITE_URL + url + "#definition"}
    if url == "/podcasts/":
        blocs += PODCASTS
        page["about"] = [{"@id": p["@id"]} for p in PODCASTS]
    if url == "/vibe-coding/":
        blocs.append(VIDEO_VIBE)
        page["video"] = {"@id": VIDEO_VIBE["@id"]}

    if meta.get("faq"):
        qr = [q.split("|", 1) for q in meta["faq"]]
        faq = {"mainEntity": [
            {"@type": "Question", "name": q.strip(),
             "acceptedAnswer": {"@type": "Answer", "text": texte_brut(r)}} for q, r in qr]}
        if type_page == "FAQPage":
            page.update(faq)                          # la page EST la FAQ : un seul nœud
        else:
            blocs.append({"@type": "FAQPage", "@id": SITE_URL + url + "#faq", "isPartOf": {"@id": page_id}, **faq})
    for v in videos_de(corps):
        blocs.append({"@type": "VideoObject", "name": v["titre"], "description": texte_brut(v["texte"]),
                      "thumbnailUrl": f"https://i.ytimg.com/vi/{v['id']}/hqdefault.jpg",
                      "uploadDate": v["date"], "duration": v["iso"],
                      "embedUrl": f"https://www.youtube-nocookie.com/embed/{v['id']}",
                      "contentUrl": f"https://www.youtube.com/watch?v={v['id']}",
                      "inLanguage": "fr-FR",
                      "creator": {"@id": PERS_ID}, "publisher": {"@id": ORG_ID}})
    return json.dumps({"@context": "https://schema.org", "@graph": blocs},
                      ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

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


# ---------------------------------------------------------------- aides de construction
def date_page(meta):
    """La date de dernière modification d'une page : celle que fixe la fiche, sinon
    celle du dernier commit de sa fiche. L'accueil vit aussi dans son gabarit."""
    if meta.get("modifie"):
        return meta["modifie"]
    d = date_git(CONTENU / meta["_fichier"])
    if meta.get("gabarit") == "accueil":
        d = max(d, date_git(RACINE / "gabarits" / "accueil.html"))
    return d

def robots_meta(meta):
    """Indexable : on autorise explicitement les grands aperçus (image, extrait, vidéo).
    Sans cette ligne, Google peut se contenter d'une vignette et d'un extrait court,
    et les assistants qui suivent ces directives citent moins long."""
    if meta.get("indexer") == "non":
        return '<meta name="robots" content="noindex, follow">'
    return '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">'

def en_bref_html(meta):
    """« En bref » : la réponse courte, en tête de page. C'est le passage que les
    assistants d'IA (ChatGPT, Perplexity, Gemini, Claude) reprennent quand ils
    citent une source : il doit se comprendre seul, sans le reste de la page."""
    if not meta.get("en_bref"):
        return ""
    return (f'<p class="en-bref"><strong>En bref.</strong> {enligne(esc(meta["en_bref"]))}</p>\n')

def taille_image(chemin):
    """(largeur, hauteur) d'un PNG, JPEG, GIF ou WebP, sans dépendance. None si inconnu."""
    import struct
    try:
        with open(chemin, "rb") as f:
            d = f.read(1 << 16)
            if d[:8] == b"\x89PNG\r\n\x1a\n":
                return struct.unpack(">II", d[16:24])
            if d[:6] in (b"GIF87a", b"GIF89a"):
                return struct.unpack("<HH", d[6:10])
            if d[:4] == b"RIFF" and d[8:12] == b"WEBP":
                if d[12:16] == b"VP8X": return (int.from_bytes(d[24:27], "little") + 1, int.from_bytes(d[27:30], "little") + 1)
                if d[12:16] == b"VP8 ": return (struct.unpack("<H", d[26:28])[0] & 0x3fff, struct.unpack("<H", d[28:30])[0] & 0x3fff)
                if d[12:16] == b"VP8L":
                    b = int.from_bytes(d[21:25], "little"); return ((b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1)
            if d[:2] == b"\xff\xd8":
                f.seek(2)
                while True:
                    m = f.read(2)
                    if len(m) < 2 or m[0] != 0xFF: return None
                    if m[1] in (0xD8, 0x01) or 0xD0 <= m[1] <= 0xD7: continue
                    n = struct.unpack(">H", f.read(2))[0]
                    if m[1] in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                        h, w = struct.unpack(">xHH", f.read(5)); return (w, h)
                    f.seek(n - 2, 1)
    except OSError:
        return None
    return None

def dimensions_images(texte):
    """Ajoute width et height aux images locales qui n'en ont pas : sans eux, la page
    saute pendant le chargement (CLS), ce que Google mesure et pénalise."""
    def ajoute(m):
        balise = m.group(0)
        if re.search(r"\swidth=", balise):
            return balise
        src = re.search(r'src="(/[^"?#]+)', balise)
        if not src:
            return balise
        taille = taille_image(SITE / src.group(1).lstrip("/"))
        if not taille:
            return balise
        return balise[:-1].rstrip("/").rstrip() + f' width="{taille[0]}" height="{taille[1]}">'
    return re.sub(r"<img\b[^>]*>", ajoute, texte)

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
        modifie = date_page(meta)
        if meta.get("gabarit") == "accueil":
            ecrire(meta["url"], page_accueil(meta, titre_seo, modifie)); ecrites += 1
            continue
        page = GABARIT.replace('href="/style.css"', f'href="/style.css?v={VERSION_STYLE}"')
        page = page.replace("{{titre_seo}}", esc(titre_seo))
        page = page.replace("{{description}}", esc(meta["description"]))
        page = page.replace("{{url}}", url)
        page = page.replace("{{og_type}}", "article" if meta.get("type") == "article" else "website")
        page = page.replace("{{robots}}", robots_meta(meta))
        suppl = []
        if meta.get("type") == "article":
            suppl += [f'<meta property="article:published_time" content="{meta.get("publie", modifie)}">',
                      f'<meta property="article:modified_time" content="{meta.get("modifie", modifie)}">',
                      '<meta property="article:author" content="https://alexandrestopnicki.com">']
        page = page.replace("{{meta_suppl}}", "\n".join(suppl))
        page = page.replace("{{jsonld}}", jsonld(meta, url, corps, modifie))
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
            # Les dessins font 1400 × 1050 : la hauteur annoncée était 933, et le
            # navigateur réservait une place fausse avant de charger l'image.
            dessin = (f'<figure class="dessin"><img src="/dessins/{fichier.strip()}" '
                      f'alt="{esc(legende.strip() or meta["titre"])}" loading="lazy" decoding="async" '
                      f'width="1400" height="1050"></figure>')
        page = page.replace("{{dessin}}", dessin)
        page = page.replace("{{duree}}", duree_lecture(corps, meta))
        page = page.replace("{{contenu}}", dimensions_images(en_bref_html(meta) + md(corps) + faq_html(meta)))
        dest = SITE / url.strip("/") / "index.html" if url != "/" else SITE / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(page, encoding="utf-8")
        ecrites += 1

    episodes_secours()
    sitemap(pages)
    plan(pages)
    llms(pages)
    llms_complet(pages)
    print(f"  ✓ {ecrites} pages écrites, sitemap, plan du site et llms.txt à jour")

FAITS_CLES = [
    "Nom : 3h33 (aussi écrit 3H33), « l'agence de l'IA ». Site officiel : https://3h33.com",
    "Nature : agence et organisme de formation français, spécialisés dans les usages de l'intelligence artificielle générative en entreprise.",
    "Création : 2010, par Alexandre Stopnicki, qui en est le fondateur. Depuis 2023, l'essentiel du travail porte sur l'IA générative.",
    "Ce que fait 3h33 : former les équipes (masterclass de deux heures, ateliers d'un à deux jours, formation Claude, rendez-vous de veille mensuels), construire avec elles des outils d'IA en vibe coding (agents, automatisations, tableaux de bord ; méthode Forge en une demi-journée) et produire des contenus avec son studio créatif (vidéos, podcasts, comédiens virtuels).",
    "Réalisations : plus de trente-cinq sites et outils en ligne, tous fabriqués en vibe coding, réunis dans la galaxie 3h33 (https://3h33.com/galaxie/).",
    "Applications éditées : NegoVox, Media Training Vox, BotMoiLeQi (et BotMoiLeQi LMA, BotMoiLeQi Slide), Le savez-vous ?.",
    "Podcasts : Choucroute Citron (des IA-nimatrices interrogent des invités en direct) et Les Voix de l'IA (130 portraits des talents de la tech et de l'IA).",
    "Clients cités sur le site : Criteo, Saint-Gobain, Air Liquide, Dentsply Sirona, Bolton Group, Robert Half, le Cnam, Esmod, Casino, Maria Schools, De Vinci Executive Education, l'Institut français, Giropharm, Les Acteurs de la Compétence, Acorus, la mairie de Laxou.",
    "Zone : France ; interventions à distance comme en présentiel, en français (et en anglais sur demande).",
    "Contact : https://3h33.com/contact/ — info@3h33.fr ; premier échange de vingt minutes gratuit.",
]
FAITS_ALEXANDRE = [
    "Alexandre Stopnicki : fondateur de 3h33, formateur, conférencier et constructeur d'outils d'IA ; il travaille dans le numérique depuis trente ans.",
    "En 1997, sa société Numériland tenait la régie publicitaire du Deuxième Monde, le métavers de Canal+ (https://3h33.com/deuxieme-monde/).",
    "Il construit des chatbots depuis 2017 (LècheBot, puis BotMoiLeQi) et il est chroniqueur de l'émission The Artificial Intelligence Society.",
    "Il anime le podcast Choucroute Citron. Site personnel : https://alexandrestopnicki.com ; créations visuelles : https://alexandre.ai ; LinkedIn : https://fr.linkedin.com/in/alexandrestopnicki",
]

def episodes_voix_de_lia():
    """Les portraits de la série Les Voix de l'IA, lus dans les pages que publie le dépôt
    podcast-engine (on ne les modifie pas : on lit leur titre et leur description)."""
    plan_serie = SITE / "podcast-voix-de-lia" / "sitemap.xml"
    if not plan_serie.exists():
        return []
    sortie = []
    for loc in re.findall(r"<loc>([^<]+)</loc>", plan_serie.read_text(encoding="utf-8")):
        chemin = loc.replace(SITE_URL, "").strip("/")
        if chemin == "podcast-voix-de-lia":
            continue
        f = SITE / chemin / "index.html"
        if not f.exists():
            continue
        t = f.read_text(encoding="utf-8")
        titre = re.search(r"<title>(.*?)</title>", t, re.S)
        desc = re.search(r'<meta name="description" content="([^"]*)"', t)
        if titre:
            titre = html.unescape(titre.group(1)).strip()
            titre = re.sub(r"\s*[·|—-]\s*Les Voix de l.IA\s*$", "", titre)
            sortie.append((titre, loc, html.unescape(desc.group(1)).strip() if desc else ""))
    return sortie

def llms(pages):
    """/llms.txt : le résumé du site à l'usage des assistants d'IA (format llmstxt.org).
    Régénéré à chaque construction, comme le sitemap, pour ne jamais décrire un site
    qui n'existe plus. Les archives et les pages légales restent hors du résumé.
    Depuis le 18/10/2026 : des faits clés en phrases autonomes, faciles à citer, les
    contenus de référence en tête, et la liste des portraits des Voix de l'IA."""
    groupes = {"Offres": [], "Comprendre l'IA": [], "Articles": [], "Autres pages": []}
    reference = {"/vibe-coding/", "/ia-en-entreprise/", "/formation-ia-obligatoire-ai-act/",
                 "/chatgpt-claude-mistral-gemini/", "/no-code/", "/ia-locale-souveraine/",
                 "/lma-learning-management-agentique/"}
    refs = []
    for meta, _, _ in sorted(pages, key=lambda p: -float(p[0].get("priorite", "0.7"))):
        u = meta["url"]
        if meta.get("indexer") == "non" or u in ("/", "/plan-du-site/") or u.startswith("/archives/") \
                or float(meta.get("priorite", "0.7")) <= 0.3 or meta.get("type") == "legal":
            continue
        ligne = f"- [{meta['titre']}]({SITE_URL}{u}): {texte_brut(meta.get('en_bref') or meta['description'])}"
        if u in reference:
            refs.append(ligne); continue
        t = meta.get("type", "page")
        cle = ("Offres" if t in ("service", "formation") else "Articles" if t == "article"
               else "Comprendre l'IA" if meta.get("faq") else "Autres pages")
        groupes[cle].append(ligne)
    lignes = ["# 3h33", "",
              "> 3h33 est une agence et un organisme de formation français spécialisés dans les "
              "usages de l'intelligence artificielle générative en entreprise, fondés en 2010 par "
              "Alexandre Stopnicki. 3h33 forme les équipes (masterclass, ateliers, formation "
              "Claude), construit avec elles des outils d'IA en vibe coding (agents, "
              "automatisations, tableaux de bord, méthode Forge en une demi-journée) et produit "
              "des contenus avec son studio créatif.", "",
              "Contact : https://3h33.com/contact/ — les réponses aux questions fréquentes sur "
              "l'IA en entreprise sont rassemblées sur https://3h33.com/ia-en-entreprise/. Le texte "
              "complet du site, en un seul fichier : https://3h33.com/llms-full.txt", "",
              "## Faits clés sur 3h33", ""] + [f"- {f}" for f in FAITS_CLES] + [
              "", "## Alexandre Stopnicki, fondateur", ""] + [f"- {f}" for f in FAITS_ALEXANDRE] + [
              "", "## Contenus de référence", ""] + refs + [""]
    for nom, items in groupes.items():
        if items:
            lignes += [f"## {nom}", ""] + items + [""]
    lignes += ["## Sites et outils", "",
               f"- [Méthode Forge]({SITE_URL}/forge/): des solutions IA (agent, automatisation, tableau de bord) co-construites avec vos équipes en une demi-journée.",
               f"- [Formation Claude]({SITE_URL}/formation-claude/): formation à Claude (Anthropic) pour salariés et managers, un ou deux jours.",
               f"- [La galaxie 3h33]({SITE_URL}/galaxie/): l'annuaire des sites et applications de l'écosystème 3h33.",
               f"- [Cartographie mondiale des usages de l'IA]({SITE_URL}/cartographie-mondiale-des-usages-de-l-ia/): étude 2024–2026 sur les usages réels de l'IA dans le monde, 90 pages, plus de 90 sources, 13 zones géographiques, PDF gratuit.",
               f"- [Mon nouveau métier : le vibe coding]({SITE_URL}/pour/alexandre-vibe-coding/): le message vidéo d'Alexandre Stopnicki, en moins d'une minute.", "",
               "## Applications éditées par 3h33", "",
               "- [NegoVox](https://negovox.com/): simulateur d'entraînement vocal par IA pour les commerciaux ; un client joué par l'IA, puis un débrief noté sur douze compétences de vente.",
               "- [Media Training Vox](https://media-training-vox.com/): entraînement par IA vocale aux prises de parole des dirigeants, face aux médias, au comité de direction, au conseil ou aux actionnaires.",
               "- [BotMoiLeQi](https://botmoileqi.com/): le learning agentique pour les organismes de formation ; un agent IA et ses outils (BotMoiLeQi LMA, BotMoiLeQi Slide) accompagnent chaque apprenant jusqu'à la certification. Marque de 3h33.",
               "- [Le savez-vous ?](https://le-savez-vous.com/): chaque matin, un fait surprenant et sourcé à lire ou écouter en 90 secondes.", ""]
    eps = episodes_voix_de_lia()
    if eps:
        lignes += ["## Les Voix de l'IA : les portraits", "",
                   f"Podcast gratuit de 3h33 : {SITE_URL}/podcast-voix-de-lia/ (flux RSS : "
                   f"{SITE_URL}/podcast-voix-de-lia/flux.xml). Chaque portrait cite ses sources sous l'épisode.", ""]
        lignes += [f"- [{t}]({u})" for t, u, _ in eps] + [""]
    lignes += ["## Profils officiels", "",
               "- 3h33 : https://www.facebook.com/3h33.FORMATIONS · https://twitter.com/alexandre3h33 · https://instagram.com/alexandre3h33",
               "- Alexandre Stopnicki : https://fr.linkedin.com/in/alexandrestopnicki · https://alexandrestopnicki.com · https://alexandre.ai",
               "- Choucroute Citron : https://choucroute-citron.com · https://podcasts.apple.com/fr/podcast/choucroute-citron/id1812305442",
               "- Les Voix de l'IA : https://podcasts.apple.com/fr/podcast/les-voix-de-lia/id6822430918 · https://open.spotify.com/show/0rdllAOWQFhE8vTfKgAxzV", ""]
    (SITE / "llms.txt").write_text("\n".join(lignes), encoding="utf-8")

def ecrire(url, page):
    dest = SITE / url.strip("/") / "index.html" if url != "/" else SITE / "index.html"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(page, encoding="utf-8")

def page_accueil(meta, titre_seo, modifie=None):
    """La page d'accueil : gabarit à part (gabarits/accueil.html), FAQ et données
    structurées tirées de contenu/accueil.md. La FAQ affichée et celle du JSON-LD
    viennent de la même liste : elles ne peuvent plus diverger (l'ancienne page
    affichait cinq questions et n'en déclarait que quatre)."""
    page = (RACINE / "gabarits" / "accueil.html").read_text(encoding="utf-8")
    faq = "\n".join(f'        <details><summary>{esc(q.split("|",1)[0].strip())}</summary>'
                     f'<p>{enligne(esc(q.split("|",1)[1].strip()))}</p></details>' for q in meta["faq"])
    for cle, val in (("{{titre_seo}}", esc(titre_seo)), ("{{description}}", esc(meta["description"])),
                     ("{{url}}", meta["url"]), ("{{faq}}", faq), ("{{jsonld}}", jsonld_accueil(meta, modifie)),
                     ("{{robots}}", robots_meta(meta))):
        page = page.replace(cle, val)
    return page

def jsonld_accueil(meta, modifie=None):
    services = [("Masterclass IA", "/masterclass-ia/"), ("Ateliers de formation à l'IA", "/ateliers-formation/"),
                ("Formation Claude", "/formation-claude/"), ("Méthode Forge", "/forge/"),
                ("Vibe coding : outils sur mesure", "/vibe-coding/"), ("Chatbots et agents IA", "/chatbots/"),
                ("Coaching IA des dirigeants", "/coaching-ia-dirigeants/"), ("Studio créatif IA", "/studio/")]
    org = noeud_org(complet=True)
    org["makesOffer"] = [{"@type": "Offer", "itemOffered": {"@type": "Service", "name": n,
                          "url": SITE_URL + u, "provider": {"@id": ORG_ID}}} for n, u in services]
    page = {"@type": "WebPage", "@id": SITE_URL + "/#accueil", "url": SITE_URL + "/",
            "name": meta["titre"], "description": meta["description"], "inLanguage": "fr-FR",
            "isPartOf": {"@id": SITE_ID}, "about": {"@id": ORG_ID}, "publisher": {"@id": ORG_ID},
            "primaryImageOfPage": {"@type": "ImageObject", "url": SITE_URL + "/medias/partage.jpg"}}
    if modifie:
        page["dateModified"] = modifie
    graphe = [org, noeud_personne(complet=True), noeud_site(), page, PODCASTS[0],
        {"@type": "FAQPage", "@id": SITE_URL + "/#faq", "isPartOf": {"@id": SITE_URL + "/#accueil"},
         "mainEntity": [
            {"@type": "Question", "name": q.split("|", 1)[0].strip(),
             "acceptedAnswer": {"@type": "Answer", "text": texte_brut(q.split("|", 1)[1])}}
            for q in meta["faq"]]},
    ]
    return json.dumps({"@context": "https://schema.org", "@graph": graphe},
                      ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")

def episodes_secours():
    """site/inclus/choucroute-defaut.html : la liste servie quand le serveur n'a pas
    (encore) écrit la sienne. Flux injoignable au moment de construire : on garde
    la liste précédente plutôt que d'en écrire une vide."""
    sys.path.insert(0, str(RACINE / "services" / "podcast"))
    try:
        import choucroute
        choucroute.ecrire(SITE / "inclus" / "choucroute-defaut.html", choucroute.fragment())
    except Exception as e:
        print(f"  ! épisodes Choucroute Citron non rafraîchis ({e}) : liste précédente gardée")

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
             "générative en entreprise. Résumé court : " + SITE_URL + "/llms.txt", "",
             "## Faits clés", ""] + [f"- {f}" for f in FAITS_CLES + FAITS_ALEXANDRE] + ["", "---", ""]
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
                if "/inclus/choucroute.html" in l:
                    secours = SITE / "inclus" / "choucroute-defaut.html"
                    if secours.exists():
                        for a in re.finditer(r'<a href="([^"]+)">(.*?)</a> · ([^<]+)', secours.read_text(encoding="utf-8")):
                            texte.append(f"- {html.unescape(a.group(2))} ({a.group(3)}) : {a.group(1)}")
                    continue
                if l.lstrip().startswith("<"): continue
                if l.startswith("@video ") or l.startswith("@vedette "):
                    v = video("@video " + l.split(" ", 1)[1])
                    texte.append(f"- Vidéo « {v['titre']} » ({v['annee']}, {v['duree']}) : {texte_brut(v['texte'])} — https://www.youtube.com/watch?v={v['id']}")
                    continue
                m = re.match(r"^@youtube\s+([\w-]{11})\s*\|\s*(.+)$", l)
                texte.append(f"Vidéo : {m.group(2).strip()} — https://www.youtube.com/watch?v={m.group(1)}" if m else l)
        blocs += [f"# {meta['titre']}", f"URL : {url}", "", f"> {meta['description']}", ""]
        if meta.get("en_bref"):
            blocs += ["En bref : " + texte_brut(meta["en_bref"]), ""]
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
    eps = episodes_voix_de_lia()
    if eps:
        blocs += ["# Les Voix de l'IA : les portraits", f"URL : {SITE_URL}/podcast-voix-de-lia/", "",
                  "> Podcast gratuit de 3h33 : 130 portraits audio d'une dizaine de minutes des femmes et des "
                  "hommes qui font la tech et l'intelligence artificielle, racontés par Ada, Alan et Lia, des "
                  "IA-nimateurs. Chaque fait est vérifié, les sources sont sous chaque épisode.", ""]
        blocs += [f"- {t} — {d} {u}" for t, u, d in eps] + [""]
    (SITE / "llms-full.txt").write_text("\n".join(blocs), encoding="utf-8")

def sitemap(pages):
    """Le plan du site pour les moteurs. Chaque page porte la date de sa dernière vraie
    modification (le dernier commit de sa fiche) et, quand elle en a une, son image :
    Google Images et les assistants qui affichent des visuels la trouvent ainsi."""
    lignes = ['<?xml version="1.0" encoding="UTF-8"?>',
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
              'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">']
    entrees = []
    for meta, _, _ in pages:
        if meta.get("indexer") == "non":
            continue
        prio = "1.0" if meta["url"] == "/" else meta.get("priorite", "0.7")
        image = image_page(meta) if meta.get("dessin") else None
        entrees.append((meta["url"], prio, date_page(meta), image))
    entrees.sort(key=lambda e: (e[0] != "/", e[0]))
    # les sites HTML purs, conservés à l'identique
    for u in ("/galaxie/", "/forge/", "/formation-claude/", "/podcast-voix-de-lia/",
              "/verif-nom/", "/cartographie-mondiale-des-usages-de-l-ia/", "/cobrandz/"):
        entrees.append((u, "0.8", date_git(SITE / u.strip("/") / "index.html"), None))
    # La seule page de /pour/ qui soit publique et faite pour être partagée : le message
    # d'Alexandre sur le vibe coding. Les autres pages de /pour/ sont privées (noindex).
    entrees.append(("/pour/alexandre-vibe-coding/", "0.8",
                    date_git(SITE / "pour" / "alexandre-vibe-coding" / "index.html"),
                    SITE_URL + "/pour/alexandre-vibe-coding/vignette.jpg"))
    for url, prio, date, image in entrees:
        lignes += ["  <url>", f"    <loc>{SITE_URL}{url}</loc>",
                   f"    <lastmod>{date}</lastmod>", f"    <priority>{prio}</priority>"]
        if image:
            lignes.append(f"    <image:image><image:loc>{image}</image:loc></image:image>")
        lignes.append("  </url>")
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
