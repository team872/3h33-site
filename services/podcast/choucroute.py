#!/usr/bin/env python3
"""Les derniers épisodes de Choucroute Citron, lus dans le flux Ausha.

Deux usages, une seule fonction (fragment) :
  - build.py en tire site/inclus/choucroute-defaut.html, versionné : la liste de
    secours, servie si le flux est injoignable ou si le serveur n'a encore rien écrit ;
  - sur le VPS, une tâche cron lance ce fichier chaque matin et écrit
    site/inclus/choucroute.html (hors git), que nginx insère dans /podcasts/ par SSI.

Ce n'est pas du JavaScript : la liste est dans la page servie, donc lue par Google
et par les robots d'IA. Bibliothèque standard seulement, rien à installer.

    python3 services/podcast/choucroute.py      écrit site/inclus/choucroute.html
"""
import email.utils, html, pathlib, re, sys, urllib.request
import xml.etree.ElementTree as ET

FLUX = "https://feed.ausha.co/9peJafn6W6DR"
SITE_EMISSION = "https://choucroute-citron.com/episodes/"
ITUNES = {"itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd"}
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
        "septembre", "octobre", "novembre", "décembre"]
RACINE = pathlib.Path(__file__).resolve().parents[2]

def lire(url, delai=20):
    req = urllib.request.Request(url, headers={"User-Agent": "3h33.com (liste des episodes)"})
    with urllib.request.urlopen(req, timeout=delai) as r:
        return r.read()

def page_existe(url):
    """L'épisode a-t-il sa page sur choucroute-citron.com ? Sinon, lien Ausha."""
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "3h33.com"})
        with urllib.request.urlopen(req, timeout=8) as r:
            return r.status == 200
    except Exception:
        return False

def fragment(nb=7):
    """Le HTML de la liste. Lève une exception si le flux est illisible : on ne
    remplace jamais une bonne liste par une liste vide."""
    canal = ET.fromstring(lire(FLUX)).find("channel")
    items = canal.findall("item")
    episodes = [it for it in items if (it.findtext("itunes:episodeType", namespaces=ITUNES) or "full") == "full"]
    if not episodes:
        raise RuntimeError("flux sans épisode")
    lignes = []
    for it in episodes[:nb]:
        titre = html.escape(re.sub(r"\s+", " ", it.findtext("title") or "").strip())
        d = email.utils.parsedate_to_datetime(it.findtext("pubDate"))
        ausha = it.findtext("link") or ""
        slug = ausha.rstrip("/").rsplit("/", 1)[-1]
        lien = SITE_EMISSION + slug + "/" if slug and page_existe(SITE_EMISSION + slug + "/") else ausha
        lignes.append(f'<li><a href="{html.escape(lien)}">{titre}</a> · {MOIS[d.month - 1]} {d.year}</li>')
    total = sum(1 for it in items if it.findtext("itunes:episodeType", namespaces=ITUNES) != "trailer")
    return (f'<p><strong>Les derniers épisodes</strong> ({total} au total)</p>\n'
            '<ul class="episodes">\n' + "\n".join(lignes) + "\n</ul>\n")

def ecrire(chemin, contenu):
    """Écriture atomique : nginx ne lit jamais un fichier à moitié écrit."""
    chemin.parent.mkdir(parents=True, exist_ok=True)
    tmp = chemin.with_suffix(".tmp")
    tmp.write_text(contenu, encoding="utf-8")
    tmp.replace(chemin)

if __name__ == "__main__":
    try:
        ecrire(RACINE / "site" / "inclus" / "choucroute.html", fragment())
        print("liste des épisodes mise à jour")
    except Exception as e:
        print(f"flux Ausha illisible, liste précédente conservée : {e}", file=sys.stderr)
        sys.exit(1)
