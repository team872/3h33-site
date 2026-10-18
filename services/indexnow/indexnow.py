#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Prévenir Bing, Yandex, Seznam, Naver (et, par eux, Copilot et les assistants qui
s'appuient sur l'index de Bing) qu'une page de 3h33.com a changé : protocole IndexNow.

Le fichier de clé est publié à https://3h33.com/bdb9085ef1fd81fa737809f046ae3b0a.txt (il doit
répondre 200 avec la clé pour contenu). La clé n'est pas un secret : le protocole
la veut publique, elle prouve seulement que l'envoi vient du propriétaire du site.

    python3 services/indexnow/indexnow.py                 # tout le site (les deux sitemaps)
    python3 services/indexnow/indexnow.py --depuis 2026-10-18   # seulement ce qui a changé depuis
    python3 services/indexnow/indexnow.py https://3h33.com/vibe-coding/   # des adresses précises
    python3 services/indexnow/indexnow.py --essai         # affiche sans rien envoyer

Google n'utilise pas IndexNow : pour lui, c'est le sitemap dans la Search Console.
"""
import json, re, sys, urllib.request

HOTE = "3h33.com"
CLE = "bdb9085ef1fd81fa737809f046ae3b0a"
SITEMAPS = ["https://3h33.com/sitemap.xml", "https://3h33.com/podcast-voix-de-lia/sitemap.xml"]
POINT = "https://api.indexnow.org/indexnow"

def adresses(depuis=None):
    sortie = []
    for plan in SITEMAPS:
        xml = urllib.request.urlopen(plan, timeout=30).read().decode("utf-8")
        for bloc in re.findall(r"<url>(.*?)</url>", xml, re.S):
            loc = re.search(r"<loc>([^<]+)</loc>", bloc).group(1).strip()
            mod = re.search(r"<lastmod>([^<]+)</lastmod>", bloc)
            if depuis and mod and mod.group(1)[:10] < depuis:
                continue
            sortie.append(loc)
    return sortie

def envoyer(urls):
    for i in range(0, len(urls), 10000):            # 10 000 adresses au plus par envoi
        corps = json.dumps({"host": HOTE, "key": CLE,
                            "keyLocation": f"https://{HOTE}/{CLE}.txt",
                            "urlList": urls[i:i + 10000]}).encode("utf-8")
        req = urllib.request.Request(POINT, data=corps, method="POST",
                                     headers={"Content-Type": "application/json; charset=utf-8"})
        try:
            r = urllib.request.urlopen(req, timeout=30)
            print(f"  ✓ {len(urls[i:i + 10000])} adresses envoyées (HTTP {r.status})")
        except urllib.error.HTTPError as e:
            # 200/202 : reçu. 403 : clé introuvable en ligne. 422 : adresse hors du site.
            print(f"  ✕ HTTP {e.code} : {e.read().decode('utf-8', 'replace')[:300]}")
            sys.exit(1)

if __name__ == "__main__":
    args = sys.argv[1:]
    essai = "--essai" in args
    depuis = args[args.index("--depuis") + 1] if "--depuis" in args else None
    urls = [a for a in args if a.startswith("https://")] or adresses(depuis)
    print(f"  {len(urls)} adresse(s)" + (f" modifiées depuis le {depuis}" if depuis else ""))
    if essai:
        print("\n".join("   " + u for u in urls)); sys.exit(0)
    envoyer(urls)
