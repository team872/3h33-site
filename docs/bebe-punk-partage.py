#!/usr/bin/env python3
"""Bébé punk : vignettes de partage (1200 × 630) et petites pages de partage, une par vidéo.

Pourquoi : Facebook, LinkedIn, WhatsApp, X… lisent la vignette (og:image) de l'adresse partagée.
Une ancre (#fin-…) ne change pas la vignette : chaque vidéo a donc sa propre adresse,
https://3h33.com/bebe-punk/v/<nom>/, qui porte sa vignette et sa vidéo, puis renvoie
le visiteur vers la bonne carte de la page.

Lancer depuis la racine du dépôt (Chrome et ffmpeg requis) :
    python3 docs/bebe-punk-partage.py [images-du-film]
`images-du-film` : dossier contenant boom-face.jpg (le cri, tiré de la V3 à 7,1 s), sinon on
prend l'affiche de la V3. Écrit site/bebe-punk/medias/vignettes/*.jpg et site/bebe-punk/v/*/index.html.
"""
import html, os, subprocess, sys, tempfile

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(RACINE, 'site', 'bebe-punk')
BASE = 'https://3h33.com/bebe-punk/'
CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
EXTRA = sys.argv[1] if len(sys.argv) > 1 else None

# nom, titre, ligne, affiche, vidéo, ancre sur la page
VIDEOS = [
    ('film', 'Le film du concours', 'La version déposée · 20,00 s', 'medias/affiche-v3.jpg', 'medias/v3-musique.mp4', 'film'),
    ('v2', 'V2 · Gros plans, caméra qui bouge', 'Conforme au concours · 20,00 s', 'medias/affiche-v2.jpg', 'medias/v2.mp4', 'v2'),
    ('fin-maman-monstre', 'Fin 2 · La maman monstre', 'Choisis ta fin · 28 s', 'medias/affiche-v4-long-maman-monstre.jpg', 'medias/v4-long-maman-monstre.mp4', 'fin-maman-monstre'),
    ('fin-il-retombe', 'Fin 1 · Il retombe', 'Choisis ta fin · 27 s', 'medias/affiche-v4-long-la-boucle.jpg', 'medias/v4-long-la-boucle.mp4', 'fin-il-retombe'),
    ('fin-maman-punk', 'Fin 3 · La maman punk', 'Choisis ta fin · 27 s', 'medias/affiche-v4-long-maman-punk.jpg', 'medias/v4-long-maman-punk.mp4', 'fin-maman-punk'),
    ('fin-reconciliation', 'Fin 5 · La réconciliation', 'Choisis ta fin · 27 s', 'medias/affiche-v4-long-reconciliation.jpg', 'medias/v4-long-reconciliation.mp4', 'fin-reconciliation'),
    ('boucle-camera-plonge', 'Par le trou, par le ciel', 'Une boucle · 27 s', 'medias/affiche-boucle-camera-plonge.jpg', 'medias/boucle-camera-plonge.mp4', 'boucle-camera-plonge'),
    ('boucle-monstre-en-bebe', 'Le monstre revient… en bébé', 'Une boucle · 27 s', 'medias/affiche-boucle-monstre-en-bebe.jpg', 'medias/boucle-monstre-en-bebe.mp4', 'boucle-monstre-en-bebe'),
    ('boucle-chasseur-chasse', 'Le chasseur chassé', 'Une boucle · 27 s', 'medias/affiche-boucle-chasseur-chasse.jpg', 'medias/boucle-chasseur-chasse.mp4', 'boucle-chasseur-chasse'),
    ('boucle-boule-a-neige', 'La boule à neige', 'Une boucle · 28 s', 'medias/affiche-boucle-boule-a-neige.jpg', 'medias/boucle-boule-a-neige.mp4', 'boucle-boule-a-neige'),
    ('boucle-boucle-sonore', 'La boucle sonore', 'Une boucle · 26 s', 'medias/affiche-boucle-boucle-sonore.jpg', 'medias/boucle-boucle-sonore.mp4', 'boucle-boucle-sonore'),
    ('essai-maman-monstre', 'La maman monstre, en 20 s', 'Essai · 20,00 s', 'medias/affiche-v4-20s-maman-monstre.jpg', 'medias/v4-20s-maman-monstre.mp4', 'essai-maman-monstre'),
    ('essai-la-boucle', 'La boucle, en 20 s', 'Essai · 20,00 s', 'medias/affiche-v4-20s-la-boucle.jpg', 'medias/v4-20s-la-boucle.mp4', 'essai-la-boucle'),
    ('essai-maman-punk', 'La maman punk, en 20 s', 'Essai · 20,00 s', 'medias/affiche-v4-20s-maman-punk.jpg', 'medias/v4-20s-maman-punk.mp4', 'essai-maman-punk'),
    ('essai-reconciliation', 'La réconciliation, en 20 s', 'Essai · 20,00 s', 'medias/affiche-v4-20s-reconciliation.jpg', 'medias/v4-20s-reconciliation.mp4', 'essai-reconciliation'),
    ('v1-plan-sequence', 'V1 · Le plan-séquence', 'La toute première version', 'medias/affiche-v1-plan-sequence.jpg', 'medias/v1-plan-sequence.mp4', 'v1-plan-sequence'),
    ('v1-4-clips', 'V1 · En quatre clips', 'La toute première version', 'medias/affiche-v1-4-clips.jpg', 'medias/v1-4-clips.mp4', 'v1-4-clips'),
    ('chute-premier-essai', 'Le tout premier essai', 'Les chutes · ce qu’on n’a pas gardé', 'medias/chutes/affiche-premier-essai.jpg', 'medias/chutes/premier-essai.mp4', 'chute-premier-essai'),
    ('chute-bebe-a-cote', 'Le bébé court à côté', 'Les chutes · ce qu’on n’a pas gardé', 'medias/chutes/affiche-bebe-a-cote.jpg', 'medias/chutes/bebe-a-cote.mp4', 'chute-bebe-a-cote'),
    ('chute-boom-rate', '« One… loud… BOOM! »', 'Les chutes · ce qu’on n’a pas gardé', 'medias/chutes/affiche-boom-rate.jpg', 'medias/chutes/boom-rate.mp4', 'chute-boom-rate'),
    ('chute-fin3-sans-foret', 'La maman punk… sans la forêt', 'Les chutes · ce qu’on n’a pas gardé', 'medias/chutes/affiche-fin3-sans-foret.jpg', 'medias/chutes/fin3-sans-foret.mp4', 'chute-fin3-sans-foret'),
]

POLICES = ''.join(
    '@font-face{font-family:"%s";src:url("file://%s/polices/%s.woff2")}' % (n, PAGE, f)
    for n, f in (('Anton', 'anton'), ('Marker', 'permanent-marker'), ('Elite', 'special-elite')))

GABARIT_VIDEO = """<!doctype html><meta charset="utf-8"><style>%s
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#0c0c0e}
.f{position:absolute;inset:0;background:url("file://%s") center/cover}
.v{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.15) 0,rgba(0,0,0,0) 35%%,rgba(0,0,0,.82) 78%%)}
.tag{position:absolute;left:36px;top:30px;padding:10px 16px 8px;background:#3aa2ff;color:#000;font:30px/1 Anton;letter-spacing:.04em;text-transform:uppercase;transform:rotate(-2deg);box-shadow:5px 5px 0 #000}
.play{position:absolute;right:46px;top:36px;width:104px;height:104px;border-radius:50%%;background:#f3eee2;border:5px solid #000;box-shadow:6px 6px 0 #000;display:grid;place-items:center;font:52px/1 sans-serif;color:#000;padding-left:10px;box-sizing:border-box}
.t{position:absolute;left:40px;right:40px;bottom:92px;color:#f3eee2;font:78px/.98 Anton;text-transform:uppercase;letter-spacing:.01em;text-shadow:4px 4px 0 #000}
.l{position:absolute;left:42px;bottom:40px;color:#ff8a2b;font:30px/1 Marker;text-shadow:2px 2px 0 #000}
.u{position:absolute;right:40px;bottom:42px;color:#f3eee2;font:24px/1 Elite;background:#000;padding:6px 10px}
</style><div class="f"></div><div class="v"></div><div class="tag">Le monstre et le bébé punk</div><div class="play">▶</div>
<div class="t">%s</div><div class="l">%s</div><div class="u">3h33.com/bebe-punk</div>"""

GABARIT_PAGE = """<!doctype html><meta charset="utf-8"><style>%s
html,body{margin:0;width:1200px;height:630px;overflow:hidden;background:#0c0c0e}
.f{position:absolute;left:380px;top:0;width:820px;height:630px;background:url("file://%s") 62%% 30%%/cover}
.v{position:absolute;inset:0;background:linear-gradient(90deg,#0c0c0e 0,#0c0c0e 31%%,rgba(12,12,14,.55) 46%%,rgba(12,12,14,0) 62%%)}
.a{position:absolute;left:44px;top:56px;color:#f3eee2;font:84px/.92 Anton;text-transform:uppercase;text-shadow:4px 4px 0 #000}
.b{position:absolute;left:52px;top:300px;color:#ff8a2b;font:40px/1 Marker;transform:rotate(-4deg);text-shadow:2px 2px 0 #000}
.c{position:absolute;left:38px;top:338px;color:#3aa2ff;font:190px/1 Anton;letter-spacing:.01em;text-shadow:6px 6px 0 #000}
.d{position:absolute;left:46px;bottom:40px;color:#f3eee2;font:26px/1.2 Elite}
.e{position:absolute;right:36px;bottom:34px;padding:8px 14px;background:#f3eee2;color:#000;font:24px/1 Anton;letter-spacing:.05em;text-transform:uppercase;transform:rotate(2deg);box-shadow:4px 4px 0 #000}
</style><div class="f"></div><div class="v"></div>
<div class="a">Le monstre<br>et le bébé</div><div class="b">punk, armé de biberons</div><div class="c">BOOM!</div>
<div class="d">Un film IA d’Alexandre Stopnicki<br>3h33.com/bebe-punk</div><div class="e">The Loophole Project</div>"""

PAGE_PARTAGE = """<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{titre} · Le monstre et le bébé punk · 3h33</title>
<meta name="description" content="{desc}">
<meta name="robots" content="noindex,follow">
<link rel="canonical" href="{url}">
<link rel="icon" href="/bebe-punk/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/bebe-punk/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/bebe-punk/apple-touch-icon.png">
<meta property="og:type" content="video.other">
<meta property="og:site_name" content="3h33">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="{titre} — Le monstre et le bébé punk">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{image}">
<meta property="og:image:secure_url" content="{image}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{titre} — vignette du film Le monstre et le bébé punk">
<meta property="og:video" content="{video}">
<meta property="og:video:secure_url" content="{video}">
<meta property="og:video:type" content="video/mp4">
<meta property="og:video:width" content="{vl}">
<meta property="og:video:height" content="{vh}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{titre} — Le monstre et le bébé punk">
<meta name="twitter:description" content="{desc}">
<meta name="twitter:image" content="{image}">
<meta name="theme-color" content="#0c0c0e">
<style>body{{margin:0;min-height:100vh;display:grid;place-items:center;background:#0c0c0e;color:#ece7dc;font:18px/1.5 -apple-system,"Segoe UI",sans-serif;text-align:center;padding:16px}}a{{color:#3aa2ff}}img{{max-width:100%;height:auto}}</style>
</head>
<body>
<main>
<p><img src="{image}" alt="" width="600" height="315"></p>
<p><strong>{titre}</strong> — Le monstre et le bébé punk</p>
<p><a href="{cible}">Voir la vidéo sur la page du film →</a></p>
</main>
<script>location.replace({cible_js});</script>
</body>
</html>
"""


def rendre(gabarit, sortie):
    with tempfile.TemporaryDirectory() as d:
        page = os.path.join(d, 'v.html')
        png = os.path.join(d, 'v.png')
        open(page, 'w', encoding='utf-8').write(gabarit)
        subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
                        '--window-size=1200,630', '--virtual-time-budget=3000', '--screenshot=' + png, 'file://' + page],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', png, '-vf', 'crop=1200:630:0:0', '-q:v', '3', sortie], check=True)


def taille_video(chemin):
    out = subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
                                   '-of', 'csv=p=0', chemin]).decode().strip().split(',')
    return out[0], out[1]


def main():
    vign = os.path.join(PAGE, 'medias', 'vignettes')
    os.makedirs(vign, exist_ok=True)
    fond = os.path.join(EXTRA, 'boom-face.jpg') if EXTRA and os.path.exists(os.path.join(EXTRA, 'boom-face.jpg')) \
        else os.path.join(PAGE, 'medias', 'affiche-v3.jpg')
    rendre(GABARIT_PAGE % (POLICES, fond), os.path.join(vign, 'page.jpg'))
    for nom, titre, ligne, affiche, video, ancre in VIDEOS:
        rendre(GABARIT_VIDEO % (POLICES, os.path.join(PAGE, affiche), html.escape(titre), html.escape(ligne)),
               os.path.join(vign, nom + '.jpg'))
        vl, vh = taille_video(os.path.join(PAGE, video))
        cible = BASE + '#' + ancre
        desc = '%s — %s. Le film IA d’Alexandre Stopnicki pour The Loophole Project : un monstre de 4 mètres, un bébé punk armé de biberons-grenades. BOOM!' % (titre, ligne)
        dossier = os.path.join(PAGE, 'v', nom)
        os.makedirs(dossier, exist_ok=True)
        open(os.path.join(dossier, 'index.html'), 'w', encoding='utf-8').write(PAGE_PARTAGE.format(
            titre=html.escape(titre), desc=html.escape(desc), url=BASE + 'v/' + nom + '/',
            image=BASE + 'medias/vignettes/' + nom + '.jpg', video=BASE + video, vl=vl, vh=vh,
            cible=html.escape(cible), cible_js='"%s"' % cible))
        print('ok', nom)


if __name__ == '__main__':
    main()
