/* Le monstre et le bébé punk — comportement de la page (19/10/2026).
   Sans dépendance. La 3D (scene3d.js, Three.js) est chargée après tout le reste,
   seulement si WebGL existe ; sinon le repli en CSS reste affiché. */
(function () {
  'use strict';
  var html = document.documentElement;
  html.classList.remove('sans-js');
  html.classList.add('js');

  var calme = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pointeurFin = window.matchMedia && matchMedia('(pointer: fine)').matches;
  var scene = null; // l'objet renvoyé par scene3d.js, quand elle est prête

  /* ------------------------------------------------ lettres de rançon */
  var styles = ['s1', 's2', 's3', 's4', 's5', 's6'];
  document.querySelectorAll('[data-rancon]').forEach(function (el) {
    var texte = el.textContent; el.textContent = '';
    var graine = 7;
    Array.from(texte).forEach(function (c, i) {
      var s = document.createElement('span');
      if (c === ' ') { s.className = 'lettre espace'; s.innerHTML = '&nbsp;'; el.appendChild(s); return; }
      graine = (graine * 31 + i * 17) % 101;
      s.className = 'lettre ' + styles[(graine + i) % styles.length];
      s.style.setProperty('--r', ((graine % 13) - 6) + 'deg');
      s.style.setProperty('--y', ((graine % 7) - 3) + 'px');
      s.textContent = c;
      el.appendChild(s);
    });
  });

  /* ------------------------------------------------ apparitions au défilement */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !calme) {
    var io = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('vu'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (r) { io.observe(r); });
  } else {
    reveals.forEach(function (r) { r.classList.add('vu'); });
  }

  /* ------------------------------------------------ défilement : parallaxe, chute, frise */
  var frise = document.querySelector('.frise');
  var filChute = document.querySelector('.chute-fil');
  var attente = false;
  function surDefilement() {
    attente = false;
    var y = window.scrollY || window.pageYOffset;
    var max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    var p = Math.min(1, Math.max(0, y / max));
    if (!calme) html.style.setProperty('--sy', Math.min(y, innerHeight * 1.2) + 'px');
    html.style.setProperty('--chute', p.toFixed(4));
    if (filChute) html.style.setProperty('--chute-px', (p * (filChute.clientHeight - 30)).toFixed(1) + 'px');
    if (frise) {
      var r = frise.getBoundingClientRect();
      var f = (innerHeight * 0.6 - r.top) / r.height;
      frise.style.setProperty('--frise', Math.min(1, Math.max(0, f)).toFixed(3));
    }
    if (scene) scene.progression(p);
  }
  addEventListener('scroll', function () { if (!attente) { attente = true; requestAnimationFrame(surDefilement); } }, { passive: true });
  addEventListener('resize', surDefilement);
  surDefilement();

  /* ------------------------------------------------ vidéo d'ouverture */
  var vOuv = document.querySelector('.ouverture-video');
  if (vOuv) {
    if (calme) { vOuv.removeAttribute('autoplay'); vOuv.pause(); }
    else { var pr = vOuv.play(); if (pr && pr.catch) pr.catch(function () {}); }
  }

  /* ------------------------------------------------ une seule vidéo sonore à la fois */
  var videosSon = Array.from(document.querySelectorAll('.film-video, .carte-version video, #lecteur-fins, #hero-video'));
  videosSon.forEach(function (v) {
    v.addEventListener('play', function () {
      if (v.muted) return;
      videosSon.forEach(function (autre) { if (autre !== v && !autre.paused && !autre.muted) autre.pause(); });
    });
  });

  /* ------------------------------------------------ le film : bande-son et chapitres */
  var film = document.getElementById('film-principal');
  var etat = document.getElementById('son-etat');
  document.querySelectorAll('.interrupteur').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.getAttribute('aria-pressed') === 'true') return;
      var t = film.currentTime, enCours = !film.paused;
      var musique = b.dataset.son === 'musique';
      film.src = musique ? film.dataset.musique : film.dataset.natif;
      film.addEventListener('loadedmetadata', function f() {
        film.removeEventListener('loadedmetadata', f);
        try { film.currentTime = t; } catch (e) {}
        if (enCours) film.play();
      });
      film.load();
      document.querySelectorAll('.interrupteur').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      etat.textContent = musique
        ? 'En ce moment : avec le riff punk (musique Lyria mixée à 35 %, sous le son du film).'
        : 'En ce moment : son natif seul (les bruits et la voix fabriqués avec les images, sans musique).';
    });
  });
  document.querySelectorAll('.liste-chapitres button').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = parseFloat(b.dataset.t) || 0;
      var aller = function () { try { film.currentTime = t; } catch (e) {} film.muted = false; film.play(); };
      if (film.readyState >= 1) aller(); else { film.preload = 'auto'; film.addEventListener('loadedmetadata', aller, { once: true }); film.load(); }
      film.scrollIntoView({ behavior: calme ? 'auto' : 'smooth', block: 'center' });
    });
  });

  /* ------------------------------------------------ les quatre temps : boucles muettes à l'écran */
  var tempsVideos = document.querySelectorAll('.temps-media video');
  if (!calme && 'IntersectionObserver' in window) {
    var ioT = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (!v.src) v.src = v.dataset.src;
          var p = v.play();
          if (p && p.then) p.then(function () { v.classList.add('joue'); }).catch(function () {});
          else v.classList.add('joue');
        } else if (!v.paused) { v.pause(); }
      });
    }, { threshold: 0.35 });
    tempsVideos.forEach(function (v) { ioT.observe(v); });
  }

  /* ------------------------------------------------ cartes des versions : aperçu au survol, inclinaison 3D */
  document.querySelectorAll('.carte-version').forEach(function (carte) {
    var v = carte.querySelector('video');
    var bouton = carte.querySelector('.regarder');
    if (!v) return;
    var engagee = false;
    function engager() { engagee = true; carte.classList.add('engagee'); }
    if (bouton) bouton.addEventListener('click', function () {
      engager(); v.muted = false; try { v.currentTime = 0; } catch (e) {}
      var p = v.play(); if (p && p.catch) p.catch(function () {});
      v.focus();
    });
    v.addEventListener('volumechange', function () { if (!v.muted) engager(); });
    v.addEventListener('seeking', function () { if (v.dataset.apercu !== '1') engager(); });
    v.addEventListener('click', engager);
    if (pointeurFin && !calme) {
      carte.addEventListener('mouseenter', function () {
        if (engagee || !v.paused) return;
        v.muted = true; v.dataset.apercu = '1'; v.preload = 'auto';
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      });
      carte.addEventListener('mouseleave', function () {
        carte.style.setProperty('--rx', '0deg'); carte.style.setProperty('--ry', '0deg');
        if (engagee) return;
        v.pause(); v.dataset.apercu = '';
      });
      carte.addEventListener('mousemove', function (e) {
        var r = carte.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        carte.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
        carte.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg');
      });
    }
  });

  /* ------------------------------------------------ éclaboussures, flash, secousse */
  function eclabousser(x, y, couleur, nb) {
    if (calme) return;
    var e = document.createElement('div');
    e.className = 'eclabousse';
    e.style.left = x + 'px'; e.style.top = y + 'px';
    nb = nb || 14;
    var flaque = document.createElement('i');
    var t = 26 + Math.random() * 20;
    flaque.style.width = flaque.style.height = t + 'px';
    flaque.style.setProperty('--c', couleur);
    e.appendChild(flaque);
    for (var i = 0; i < nb; i++) {
      var g = document.createElement('i');
      var a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 90, s = 4 + Math.random() * 12;
      g.style.width = g.style.height = s + 'px';
      g.style.setProperty('--dx', (Math.cos(a) * d).toFixed(0) + 'px');
      g.style.setProperty('--dy', (Math.sin(a) * d + 20).toFixed(0) + 'px');
      g.style.setProperty('--c', couleur);
      g.style.animationDelay = (Math.random() * 0.08).toFixed(2) + 's';
      e.appendChild(g);
    }
    document.body.appendChild(e);
    setTimeout(function () { e.remove(); }, 1200);
  }
  function secouer() {
    if (calme) return;
    document.body.classList.remove('secousse'); void document.body.offsetWidth;
    document.body.classList.add('secousse');
    setTimeout(function () { document.body.classList.remove('secousse'); }, 520);
  }
  function flash(x, y) {
    if (calme) return;
    var f = document.createElement('div');
    f.className = 'flash';
    f.style.setProperty('--fx', x + 'px'); f.style.setProperty('--fy', y + 'px');
    document.body.appendChild(f);
    setTimeout(function () { f.remove(); }, 520);
  }
  function motBoom(x, y) {
    var m = document.createElement('div');
    m.className = 'mot-boom'; m.textContent = 'BOOM!';
    m.setAttribute('aria-hidden', 'true');
    m.style.left = x + 'px'; m.style.top = y + 'px';
    document.body.appendChild(m);
    setTimeout(function () { m.remove(); }, 950);
  }

  /* le cri du bébé, tiré du film (0,8 s) */
  var cri = null;
  function crier() {
    if (!cri) { cri = new Audio('medias/boom.m4a'); cri.preload = 'auto'; }
    try { cri.currentTime = 0; } catch (e) {}
    var p = cri.play(); if (p && p.catch) p.catch(function () {});
  }

  function boom(x, y, avecCri) {
    if (avecCri) crier();
    secouer(); flash(x, y);
    if (!calme) motBoom(x, y);
    eclabousser(x, y, 'var(--orange)', 10);
    setTimeout(function () { eclabousser(x + 30, y - 20, 'var(--lait)', 16); }, 90);
  }

  var boutonBoom = document.getElementById('boom');
  if (boutonBoom) boutonBoom.addEventListener('click', function (ev) {
    var r = boutonBoom.getBoundingClientRect();
    var x = r.left + r.width / 2, y = r.top + r.height / 2;
    boom(x, y, true);
    if (scene) scene.boomGeneral();
    ev.stopPropagation();
  });
  document.querySelectorAll('[data-boom-seul]').forEach(function (b) {
    b.addEventListener('click', function (ev) { crier(); ev.stopPropagation(); });
  });

  /* un clic ailleurs : soit on touche un biberon-grenade en 3D, soit ça éclabousse de lait */
  document.addEventListener('click', function (ev) {
    if (ev.target.closest('a,button,video,input,label,summary,dialog,.ecran,.carte-version,.choix-fin,.planche')) return;
    if (scene && scene.toucher(ev.clientX, ev.clientY)) { boom(ev.clientX, ev.clientY, false); return; }
    eclabousser(ev.clientX, ev.clientY, Math.random() < 0.8 ? 'var(--lait)' : 'var(--bleu)', 12);
  });


  /* ------------------------------------------------ choisis ta fin : un lecteur, neuf fins
     Chaque fin est un court fichier (du plongeon à la fin, ≈ 12 s) ; « Voir le film en entier » charge la version complète. */
  var lecteur = document.getElementById('lecteur-fins');
  var finEnCours = document.getElementById('fin-en-cours');
  var finChoisie = document.querySelector('.fin[aria-pressed="true"]');
  function charger(src, poster) {
    if (lecteur.getAttribute('src') !== src) {
      lecteur.pause();
      if (poster) lecteur.setAttribute('poster', poster);
      lecteur.setAttribute('src', src);
      lecteur.load();
    }
    var aller = function () { try { lecteur.currentTime = 0; } catch (e) {} lecteur.muted = false; var p = lecteur.play(); if (p && p.catch) p.catch(function () {}); };
    if (lecteur.readyState >= 1) aller(); else lecteur.addEventListener('loadedmetadata', aller, { once: true });
  }
  if (lecteur) {
    var boutonsFins = document.querySelectorAll('.fin');
    boutonsFins.forEach(function (b) {
      b.addEventListener('click', function () {
        finChoisie = b;
        boutonsFins.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        var sym = b.querySelector('.fin-symbole').textContent;
        finEnCours.innerHTML = '';
        var s1 = document.createElement('span'); s1.className = 'fin-en-cours-sym'; s1.setAttribute('aria-hidden', 'true'); s1.textContent = sym;
        var st = document.createElement('strong'); st.textContent = b.dataset.titre;
        finEnCours.appendChild(s1); finEnCours.appendChild(document.createTextNode(' Fin choisie : '));
        finEnCours.appendChild(st); finEnCours.appendChild(document.createTextNode('. ' + b.dataset.texte));
        charger(b.dataset.src, b.dataset.poster);
        if (innerWidth < 1000) lecteur.scrollIntoView({ behavior: calme ? 'auto' : 'smooth', block: 'center' });
      });
    });
    document.getElementById('voir-fin').addEventListener('click', function () { if (finChoisie) charger(finChoisie.dataset.src); });
    document.getElementById('depuis-debut').addEventListener('click', function () { if (finChoisie) charger(finChoisie.dataset.film || finChoisie.dataset.src); });
  }

  /* ------------------------------------------------ planches-contact : visionneuse */
  var vis = document.getElementById('visionneuse');
  if (vis && typeof vis.showModal === 'function') {
    var visImg = document.getElementById('visionneuse-img');
    var visTitre = document.getElementById('visionneuse-titre');
    var visZoom = document.getElementById('visionneuse-zoom');
    function zoomer(oui) { vis.classList.toggle('zoom', oui); visZoom.setAttribute('aria-pressed', String(oui)); }
    document.querySelectorAll('.planche-bouton').forEach(function (b) {
      b.addEventListener('click', function () {
        visImg.src = b.dataset.grand;
        visImg.alt = 'Planche-contact agrandie : ' + b.dataset.legende;
        visTitre.textContent = b.dataset.legende;
        zoomer(false);
        vis.showModal();
      });
    });
    visZoom.addEventListener('click', function () { zoomer(!vis.classList.contains('zoom')); });
    visImg.addEventListener('click', function () { zoomer(!vis.classList.contains('zoom')); });
    document.getElementById('visionneuse-fermer').addEventListener('click', function () { vis.close(); });
    vis.addEventListener('click', function (e) { if (e.target === vis) vis.close(); });
  } else {
    // sans <dialog> : la planche s'ouvre seule dans l'onglet
    document.querySelectorAll('.planche-bouton').forEach(function (b) {
      b.addEventListener('click', function () { location.href = b.dataset.grand; });
    });
  }

  /* ------------------------------------------------ des gouttes de lait tombent sur la page */
  if (!calme) {
    var gouttes = 0;
    function goutte() {
      if (document.hidden || gouttes > 3) return;
      gouttes++;
      var x = 6 + Math.random() * 84, yFin = innerHeight * (0.35 + Math.random() * 0.55);
      var d = 0.9 + Math.random() * 0.7;
      var g = document.createElement('div');
      g.className = 'goutte'; g.setAttribute('aria-hidden', 'true');
      g.style.setProperty('--x', x + 'vw'); g.style.setProperty('--y', (yFin + 24) + 'px'); g.style.setProperty('--d', d + 's');
      document.body.appendChild(g);
      setTimeout(function () {
        g.remove();
        var t = document.createElement('div');
        t.className = 'tache'; t.setAttribute('aria-hidden', 'true');
        t.style.setProperty('--x', x + 'vw'); t.style.setProperty('--y', yFin + 'px');
        t.style.setProperty('--t', (18 + Math.random() * 18) + 'px');
        t.appendChild(document.createElement('i'));
        for (var i = 0; i < 6; i++) {
          var p = document.createElement('i');
          var a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 22, z = 8 + Math.random() * 10;
          p.style.width = p.style.height = z + '%';
          p.style.left = (50 + Math.cos(a) * r - z / 2) + '%'; p.style.top = (50 + Math.sin(a) * r * 0.6 - z / 2) + '%';
          t.appendChild(p);
        }
        document.body.appendChild(t);
        setTimeout(function () { t.remove(); gouttes--; }, 7100);
      }, d * 1000);
    }
    (function prochaine() { setTimeout(function () { goutte(); prochaine(); }, 2600 + Math.random() * 3400); })();
  }

  /* ------------------------------------------------ REPEAT : retomber en haut */
  var repeat = document.getElementById('repeat');
  if (repeat) repeat.addEventListener('click', function () {
    if (scene) scene.retomber();
    window.scrollTo({ top: 0, behavior: calme ? 'auto' : 'smooth' });
    setTimeout(function () { var t = document.getElementById('titre'); if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); } }, calme ? 0 : 900);
  });

  /* ------------------------------------------------ la 3D, chargée en dernier */
  var TELEPHONE = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || innerWidth < 900;
  function webglPossible() {
    try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); }
    catch (e) { return false; }
  }
  function chargerScene() {
    var canvas = document.getElementById('scene3d');
    // Pas de 3D sur téléphone et tablette : la mémoire graphique y est limitée et la page, très longue,
    // faisait planter Chrome et Safari sur iPhone (20/10). Le repli dessiné en CSS prend le relais.
    if (TELEPHONE) return;
    if (!canvas || !webglPossible()) return;
    import('./scene3d.js?v=1').then(function (m) {
      scene = m.demarrer(canvas, { calme: calme, petit: innerWidth < 700 });
      if (!scene) return;
      html.classList.add('avec-3d');
      surDefilement();
      // on ne dessine que si l'ouverture ou le trou final sont à l'écran
      if ('IntersectionObserver' in window) {
        var visibles = new Set();
        var ioS = new IntersectionObserver(function (entrees) {
          entrees.forEach(function (e) { if (e.isIntersecting) visibles.add(e.target); else visibles.delete(e.target); });
          scene.actif(visibles.size > 0);
        }, { threshold: 0 });
        document.querySelectorAll('.ouverture, .saut').forEach(function (s) { ioS.observe(s); });
      }
    }).catch(function () { /* le repli CSS reste en place */ });
  }
  function apresChargement() {
    if ('requestIdleCallback' in window) requestIdleCallback(chargerScene, { timeout: 2500 });
    else setTimeout(chargerScene, 600);
  }

  /* ------------------------------------------------ partager : la page, chaque version, chaque fin */
  var BASE = 'https://3h33.com/bebe-punk/';
  var TEXTE_PAGE = 'Un monstre de 4 mètres tombe du ciel… et c’est un bébé punk qui lui fait peur. BOOM! Le film IA d’Alexandre Stopnicki pour The Loophole Project.';
  function adresse(slug) { return (!slug || slug === 'page') ? BASE : BASE + 'v/' + slug + '/'; }
  function vignette(slug) { return BASE + 'medias/vignettes/' + (slug || 'page') + '.jpg'; }
  function enc(x) { return encodeURIComponent(x); }
  function reseaux(o) {
    var u = enc(o.url), t = enc(o.texte), tu = enc(o.texte + ' ' + o.url), ti = enc(o.titre);
    return [
      ['whatsapp', '✆', 'WhatsApp', 'https://wa.me/?text=' + tu],
      ['x', '✕', 'X (Twitter)', 'https://x.com/intent/post?text=' + t + '&url=' + u + '&hashtags=AIfilm,TheLoopholeProject,BabyPunk'],
      ['facebook', 'f', 'Facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + u],
      ['linkedin', 'in', 'LinkedIn', 'https://www.linkedin.com/sharing/share-offsite/?url=' + u],
      ['bluesky', '☁', 'Bluesky', 'https://bsky.app/intent/compose?text=' + tu],
      ['threads', '@', 'Threads', 'https://www.threads.net/intent/post?text=' + tu],
      ['reddit', '◉', 'Reddit', 'https://www.reddit.com/submit?url=' + u + '&title=' + ti],
      ['telegram', '➤', 'Telegram', 'https://t.me/share/url?url=' + u + '&text=' + t],
      ['pinterest', 'P', 'Pinterest', 'https://pinterest.com/pin/create/button/?url=' + u + '&media=' + enc(o.image) + '&description=' + t],
      ['email', '✉', 'E-mail', 'mailto:?subject=' + ti + '&body=' + enc(o.texte + '\n\n' + o.url)]
    ];
  }
  function remplir(boite, o) {
    boite.innerHTML = '';
    var ul = document.createElement('ul'); ul.className = 'partage-grille';
    function li(el) { var l = document.createElement('li'); l.appendChild(el); ul.appendChild(l); }
    if (navigator.share) {
      var nat = document.createElement('button'); nat.type = 'button'; nat.className = 'partage-lien partage-natif';
      nat.innerHTML = '<span class="partage-ico" aria-hidden="true">↗</span><span>Partager… <small>(menu du téléphone)</small></span>';
      nat.addEventListener('click', function () { navigator.share({ title: o.titre, text: o.texte, url: o.url }).catch(function () {}); });
      li(nat);
    }
    reseaux(o).forEach(function (r) {
      var a = document.createElement('a'); a.className = 'partage-lien partage-' + r[0]; a.href = r[3];
      if (r[0] !== 'email') { a.target = '_blank'; a.rel = 'noopener'; }
      a.innerHTML = '<span class="partage-ico" aria-hidden="true"></span><span></span>';
      a.firstChild.textContent = r[1]; a.lastChild.textContent = r[2];
      li(a);
    });
    var copie = document.createElement('button'); copie.type = 'button'; copie.className = 'partage-lien partage-copie';
    copie.innerHTML = '<span class="partage-ico" aria-hidden="true">⧉</span><span>Copier le lien</span>';
    copie.addEventListener('click', function () {
      var fait = function () { copie.lastChild.textContent = '✓ Lien copié'; setTimeout(function () { copie.lastChild.textContent = 'Copier le lien'; }, 2200); };
      if (navigator.clipboard) navigator.clipboard.writeText(o.url).then(fait, function () { prompt('Le lien :', o.url); });
      else prompt('Le lien :', o.url);
    });
    li(copie);
    if (o.video) {
      // Instagram et TikTok n'acceptent pas de lien : on envoie la vidéo elle-même
      var vid = document.createElement('button'); vid.type = 'button'; vid.className = 'partage-lien partage-video';
      vid.innerHTML = '<span class="partage-ico" aria-hidden="true">▶</span><span>La vidéo pour Instagram, TikTok… <small>(fichier MP4)</small></span>';
      vid.addEventListener('click', function () {
        var nom = o.video.split('/').pop();
        var telecharger = function () { var a = document.createElement('a'); a.href = o.video; a.download = 'bebe-punk-' + nom; document.body.appendChild(a); a.click(); a.remove(); };
        if (!navigator.canShare) return telecharger();
        vid.lastChild.firstChild.textContent = 'Préparation de la vidéo… ';
        fetch(o.video).then(function (r) { return r.blob(); }).then(function (b) {
          var f = new File([b], 'bebe-punk-' + nom, { type: 'video/mp4' });
          vid.lastChild.firstChild.textContent = 'La vidéo pour Instagram, TikTok… ';
          if (navigator.canShare({ files: [f] })) return navigator.share({ files: [f], title: o.titre, text: o.texte + ' ' + o.url }).catch(function () {});
          telecharger();
        }).catch(telecharger);
      });
      li(vid);
    }
    boite.appendChild(ul);
  }
  var dlg = document.getElementById('partage');
  function ouvrirPartage(slug, titre, video) {
    var o = { url: adresse(slug), titre: titre + ' — Le monstre et le bébé punk', image: vignette(slug), video: video,
              texte: slug === 'page' ? TEXTE_PAGE : titre + ' — Le monstre et le bébé punk, un film IA d’Alexandre Stopnicki. BOOM!' };
    if (!dlg || !dlg.showModal) { if (navigator.share) navigator.share({ title: o.titre, url: o.url }).catch(function () {}); else prompt('Le lien :', o.url); return; }
    document.getElementById('partage-titre').textContent = titre;
    var img = document.getElementById('partage-vignette'); img.src = 'medias/vignettes/' + (slug || 'page') + '.jpg'; img.alt = 'Vignette de partage : ' + titre;
    remplir(dlg.querySelector('[data-partage-liens]'), o);
    dlg.showModal();
  }
  if (dlg) {
    document.getElementById('partage-fermer').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  }
  var zonePage = document.querySelector('[data-partage-liens="page"]');
  if (zonePage) remplir(zonePage, { url: BASE, titre: 'Le monstre et le bébé punk', texte: TEXTE_PAGE, image: vignette('page'), video: 'medias/v3-musique.mp4' });
  // un bouton « Partager » sur chaque version
  document.querySelectorAll('.carte-version[id]').forEach(function (carte) {
    var v = carte.querySelector('video'), t = carte.querySelector('h4'), zone = carte.querySelector('.carte-texte');
    if (!v || !t || !zone) return;
    var b = document.createElement('button'); b.type = 'button'; b.className = 'bouton-partage-carte';
    b.dataset.partage = carte.id === 'carte-v3' ? 'film' : carte.id; b.dataset.titre = t.textContent; b.dataset.video = v.getAttribute('src');
    b.innerHTML = '<span aria-hidden="true">↗</span> Partager';
    zone.appendChild(b);
  });
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-partage]');
    if (b) ouvrirPartage(b.dataset.partage, b.dataset.titre, b.dataset.video);
  });
  // le bouton « Partager cette fin » suit la fin choisie
  var bFin = document.getElementById('partager-fin');
  document.querySelectorAll('.liste-fins li[id] .fin').forEach(function (f) {
    f.addEventListener('click', function () {
      if (!bFin) return;
      bFin.dataset.partage = f.parentNode.id; bFin.dataset.titre = f.dataset.titre; bFin.dataset.video = f.dataset.film || f.dataset.src;
    });
  });
  // arrivée par un lien partagé : #fin-… ouvre la bonne fin
  (function () {
    var id = decodeURIComponent(location.hash.slice(1));
    var li = id && document.getElementById(id);
    if (li && li.closest('.liste-fins')) {
      var f = li.querySelector('.fin'); if (f) f.click();
      var ancre = document.getElementById('fins'); if (ancre) setTimeout(function () { ancre.scrollIntoView(); }, 50);
    }
  })();

  /* ------------------------------------------------ clic droit refusé sur les images et les vidéos (un frein, pas une protection) */
  document.addEventListener('contextmenu', function (e) {
    if (e.target.closest('img, video, canvas, picture, .planche, .polaroid, .carte-media, .ecran, .choix-ecran')) e.preventDefault();
  });
  document.addEventListener('dragstart', function (e) { if (e.target.closest('img, video')) e.preventDefault(); });
  document.querySelectorAll('video, audio').forEach(function (m) { m.setAttribute('controlslist', 'nodownload'); });

  /* ------------------------------------------------ le film déposé, dans l'ouverture */
  var heroV = document.getElementById('hero-video'), heroB = document.getElementById('hero-play');
  if (heroV && heroB) {
    heroB.addEventListener('click', function () {
      heroV.closest('.hero-film').classList.add('lance');
      heroV.muted = false; var p = heroV.play(); if (p && p.catch) p.catch(function () {});
      heroV.focus();
    });
    heroV.addEventListener('play', function () { heroV.closest('.hero-film').classList.add('lance'); });
  }

  /* ------------------------------------------------ légèreté (20/10) : une vidéo quittée s'arrête, rien ne tourne onglet caché */
  if ('IntersectionObserver' in window) {
    var ioPause = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) { if (!e.isIntersecting && !e.target.paused) e.target.pause(); });
    }, { threshold: 0 });
    document.querySelectorAll('video').forEach(function (v) { ioPause.observe(v); });
  }
  document.addEventListener('visibilitychange', function () {
    document.documentElement.classList.toggle('onglet-cache', document.hidden);
    if (document.hidden) document.querySelectorAll('video').forEach(function (v) { if (!v.paused && v.muted) v.pause(); });
  });

  if (document.readyState === 'complete') apresChargement();
  else addEventListener('load', apresChargement);
})();
