/* Les Voix de l'IA — comportements du site (sans bibliothèque).
   Apparitions au défilement, barre du haut (rubrique en cours), bouton « remonter », mur de vignettes du bandeau,
   « Lia vous présente l'émission », lecteur collant (Spotify ou MP3), lecteur des portraits avec onde cliquable
   et mini-lecteur, chapitres suivis à la lecture, partage. Un seul son à la fois. */
(function () {
  "use strict";
  var doc = document.documentElement;
  // Les apparitions au défilement ne cachent rien tant que ce script n'a pas démarré (s'il ne charge pas, tout reste visible).
  doc.classList.add("anime");
  var calme = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var majBoutonsJouer = function () {}; // remplacée par le lecteur collant de la page de l'émission
  // icônes fabriquées ici (« Ma playlist ») : les mêmes que ICONES dans gabarits.mjs
  var trait = function (d, l) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (l || 2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'; };
  var ICONES_MP = { monter: trait("M6 15l6-6 6 6"), descendre: trait("M6 9l6 6 6-6"), croix: trait("M18 6L6 18M6 6l12 12"), plus: trait("M12 5v14M5 12h14", 2.2), coche: trait("M5 12.5l4.5 4.5L19 7", 2.4) };

  function duree(s) {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.round(s);
    var m = Math.floor(s / 60), r = s % 60;
    return m + ":" + (r < 10 ? "0" : "") + r;
  }

  /* ------------------------------------------------ affichage « Essentiel » / « Tout afficher » (page d'un portrait, 13/10/2026)
     Essentiel par défaut : le reste est rangé dans des tiroirs. « Tout afficher » les ouvre tous et la page s'en
     souvient. Un lien vers un passage rangé (#sources…) ouvre son tiroir. Une astuce, une seule fois : toucher une réplique. */
  (function () {
    var boutons = $$("[data-affichage]");
    if (!boutons.length) return;
    var lire = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
    var ecrire = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
    var choisir = function (v, sauver) {
      var complet = v === "complet";
      doc.classList.toggle("complet", complet);
      boutons.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-affichage") === v ? "true" : "false"); });
      $$("details[data-tiroir]").forEach(function (t) { t.open = complet; });
      if (sauver) ecrire("vdia-affichage", v);
    };
    choisir(lire("vdia-affichage") === "complet" ? "complet" : "simple", false);
    boutons.forEach(function (b) { b.addEventListener("click", function () { choisir(b.getAttribute("data-affichage"), true); }); });
    var ouvrirCible = function () {
      var id = location.hash.slice(1), el = null;
      if (!id) return;
      try { el = document.getElementById(decodeURIComponent(id)); } catch (e) {}
      var t = el && el.closest ? el.closest("details[data-tiroir]") : null;
      if (t && !t.open) { t.open = true; el.scrollIntoView(); }
    };
    window.addEventListener("hashchange", ouvrirCible);
    ouvrirCible();
    var astuce = $(".astuce");
    if (astuce && !lire("vdia-astuce")) {
      astuce.hidden = false;
      var vu = function (ev) {
        if (!ev.target.closest || !ev.target.closest(".replique")) return;
        astuce.hidden = true;
        ecrire("vdia-astuce", "1");
        document.removeEventListener("click", vu, true);
      };
      document.addEventListener("click", vu, true);
    }
  })();

  /* ------------------------------------------------ barre du haut qui se densifie au défilement, bouton « remonter » */
  var barre = $(".barre");
  var haut = $(".remonter");
  var liensNav = $$(".barre nav a[href^='#']");
  var majDefile = function () {
    var y = window.scrollY;
    if (barre) barre.classList.toggle("defile", y > 40);
    doc.classList.toggle("a-defile", y > 60); // bandeau : les zones atténuées se rallument dès qu'on descend (14/10/2026)
    if (haut) haut.classList.toggle("visible", y > Math.max(640, window.innerHeight * 0.85));
    if (y < 120) liensNav.forEach(function (a) { a.classList.remove("actif"); a.removeAttribute("aria-current"); });
  };
  majDefile();
  window.addEventListener("scroll", majDefile, { passive: true });
  if (haut) haut.addEventListener("click", function (ev) {
    ev.preventDefault();
    window.scrollTo({ top: 0, behavior: calme ? "auto" : "smooth" });
    var m = $(".marque");
    if (m) try { m.focus({ preventScroll: true }); } catch (e) { m.focus(); }
  });

  /* ------------------------------------------------ rubrique en cours, soulignée dans la barre du haut */
  if (liensNav.length && "IntersectionObserver" in window) {
    var parCible = {};
    liensNav.forEach(function (a) { var id = a.getAttribute("href").slice(1); if (id && document.getElementById(id)) parCible[id] = a; });
    var obsNav = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        if (!e.isIntersecting || window.scrollY < 120) return;
        liensNav.forEach(function (a) { a.classList.remove("actif"); a.removeAttribute("aria-current"); });
        parCible[e.target.id].classList.add("actif");
        parCible[e.target.id].setAttribute("aria-current", "location");
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    Object.keys(parCible).forEach(function (id) { obsNav.observe(document.getElementById(id)); });
  }

  /* ------------------------------------------------ un seul son à la fois (Lia, lecteur collant, lecteur du portrait) */
  document.addEventListener("play", function (ev) {
    $$("audio").forEach(function (a) { if (a !== ev.target && !a.paused) a.pause(); });
  }, true);

  /* ------------------------------------------------ bandeau : « À écouter aujourd'hui » (14/10/2026). Le portrait paru
     aujourd'hui reste ; sinon, à chaque visite, un autre portrait parmi les plus célèbres. */
  var dj = $(".du-jour"), djListe = $("#donnees-du-jour");
  var djAujourdhui = false;
  (function () {
    var et = $(".dj-etiquette");
    if (!et) return;
    var auj = new Date(), deux = function (n) { return (n < 10 ? "0" : "") + n; };
    djAujourdhui = et.getAttribute("data-publie") === auj.getFullYear() + "-" + deux(auj.getMonth() + 1) + "-" + deux(auj.getDate());
  })();
  if (dj && djListe && !djAujourdhui) {
    try {
      var djChoix = JSON.parse(djListe.textContent).filter(function (x) { return x.id !== dj.querySelector("[data-jouer]").getAttribute("data-jouer"); });
      var x = djChoix[Math.floor(Math.random() * djChoix.length)];
      if (x) {
        var img = $(".dj-image img", dj), src = $(".dj-image source", dj);
        img.src = x.image + "-400.jpg";
        img.srcset = x.image + "-400.jpg 400w, " + x.image + "-800.jpg 800w";
        img.alt = "Vignette de " + x.nom;
        if (src) { if (x.webp) src.srcset = x.image + "-400.webp 400w, " + x.image + "-800.webp 800w"; else src.parentNode.removeChild(src); }
        $$("[data-jouer]", dj).forEach(function (b) { b.setAttribute("data-jouer", x.id); });
        $(".dj-image", dj).setAttribute("aria-label", "Écouter le portrait de " + x.nom + " (" + x.duree + ")");
        var nom = $(".dj-nom a", dj); nom.href = x.chemin; nom.firstChild.nodeValue = x.nom + " ";
        $(".dj-role", dj).textContent = x.role;
        $(".dj-angle", dj).textContent = x.angle;
        var djs = $(".dj-sources", dj);
        if (djs) { if (x.sources) { djs.href = x.chemin + "#sources"; djs.textContent = x.sources + " sources vérifiées ↓"; } else djs.hidden = true; }
        $(".dj-duree", dj).textContent = x.duree;
        $(".dj-ouvrir", dj).href = x.chemin;
        var pt = $(".card-partager", dj);
        pt.setAttribute("data-partager-url", x.url);
        pt.setAttribute("data-partager-titre", x.titre + " — un portrait des Voix de l'IA");
        pt.setAttribute("aria-label", "Partager le portrait de " + x.nom);
        $(".dj-etiquette", dj).textContent = "Saison 2 · Portrait";
      }
    } catch (e) { if (window.console) console.warn("À écouter aujourd'hui :", e); }
  }
  /* ------------------------------------------------ bandeau : « Le portrait du jour » s'il est paru aujourd'hui */
  var djEtiquette = $(".dj-etiquette");
  if (djEtiquette) {
    var auj = new Date(), deux = function (n) { return (n < 10 ? "0" : "") + n; };
    if (djEtiquette.getAttribute("data-publie") === auj.getFullYear() + "-" + deux(auj.getMonth() + 1) + "-" + deux(auj.getDate())) {
      $(".dj-quand", djEtiquette).textContent = "Le portrait du jour";
      djEtiquette.classList.add("aujourdhui");
    }
  }

  /* ------------------------------------------------ apparitions au défilement (en cascade) */
  if ("IntersectionObserver" in window && !calme) {
    var vus = new IntersectionObserver(function (entrees) {
      var k = 0;
      entrees.forEach(function (e) {
        if (!e.isIntersecting) return;
        // un bloc plus haut que l'écran (la liste des 164 sources de Dario Amodei sur téléphone : 10 000 px) n'atteint
        // jamais 12 % visibles : il apparaît dès qu'il entre à l'écran, sinon il resterait invisible pour toujours
        if (e.intersectionRatio < 0.12 && e.boundingClientRect.height < window.innerHeight * 0.8) return;
        var el = e.target;
        if (!el.style.getPropertyValue("--d")) el.style.setProperty("--d", Math.min(k++ * 0.07, 0.42) + "s");
        el.classList.add("visible");
        vus.unobserve(el);
      });
    }, { threshold: [0, 0.12], rootMargin: "0px 0px -6% 0px" });
    $$(".reveal").forEach(function (el) { vus.observe(el); });
  } else {
    $$(".reveal").forEach(function (el) { el.classList.add("visible"); });
  }

  /* ------------------------------------------------ outils communs du lecteur MP3 */
  function relierCurseur(audio, curseur, txtCourant, txtTotal, onde, autres) {
    var glisse = false;
    function maj() {
      var d = audio.duration || Number(audio.dataset.duree) || 0;
      var p = d ? (audio.currentTime / d) * 100 : 0;
      if (curseur && !glisse) { curseur.value = String(p); curseur.style.setProperty("--p", p + "%"); curseur.setAttribute("aria-valuetext", duree(audio.currentTime) + " sur " + duree(d)); }
      if (txtCourant) txtCourant.textContent = duree(audio.currentTime);
      if (txtTotal && d) txtTotal.textContent = duree(d);
      if (onde) { onde.style.setProperty("--progression", p + "%"); onde.setAttribute("aria-valuenow", String(Math.round(p))); onde.setAttribute("aria-valuetext", duree(audio.currentTime) + " sur " + duree(d)); }
      (autres || []).forEach(function (el) { el.style.setProperty("--progression", p + "%"); });
    }
    audio.addEventListener("timeupdate", maj);
    audio.addEventListener("loadedmetadata", maj);
    audio.addEventListener("seeked", maj);
    if (curseur) {
      curseur.addEventListener("input", function () {
        glisse = true;
        var d = audio.duration || Number(audio.dataset.duree) || 0;
        curseur.style.setProperty("--p", curseur.value + "%");
        if (txtCourant) txtCourant.textContent = duree((curseur.value / 100) * d);
      });
      curseur.addEventListener("change", function () {
        var d = audio.duration || Number(audio.dataset.duree) || 0;
        if (d) audio.currentTime = (curseur.value / 100) * d;
        glisse = false;
      });
    }
    if (onde) {
      var survol = $(".survol", onde);
      var chercher = function (ev) {
        var r = onde.getBoundingClientRect();
        var x = Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width));
        var d = audio.duration || Number(audio.dataset.duree) || 0;
        if (d) audio.currentTime = x * d;
        if (audio.paused) audio.play().catch(function () {});
      };
      onde.addEventListener("click", chercher);
      onde.addEventListener("mousemove", function (ev) {
        if (!survol) return;
        survol.style.left = (ev.clientX - onde.getBoundingClientRect().left) + "px";
      });
      onde.addEventListener("keydown", function (ev) {
        if (ev.key === "ArrowRight") { audio.currentTime += 5; ev.preventDefault(); }
        if (ev.key === "ArrowLeft") { audio.currentTime -= 5; ev.preventDefault(); }
      });
    }
    maj();
    return maj;
  }

  function relierBouton(audio, bouton, nom) {
    function etat() {
      var joue = !audio.paused && !audio.ended;
      bouton.classList.toggle("joue", joue);
      bouton.setAttribute("aria-label", (joue ? "Mettre en pause " : "Écouter ") + nom);
      bouton.setAttribute("aria-pressed", joue ? "true" : "false");
    }
    bouton.addEventListener("click", function () {
      if (audio.paused) audio.play().catch(function () {}); else audio.pause();
    });
    ["play", "pause", "ended"].forEach(function (e) { audio.addEventListener(e, etat); });
    etat();
  }

  /* ------------------------------------------------ bandeau : « Lia vous présente l'émission » */
  var lia = $(".lia-carte");
  if (lia) {
    var liaAudio = $("audio", lia);
    var liaBouton = $(".lia-bouton", lia);
    var liaTemps = $(".lia-temps", lia);
    var liaPiste = $(".lia-piste", lia);
    var morceaux = $$(".lia-citation [data-t]", lia);
    var citation = $(".lia-citation", lia);
    var tempsDepart = liaTemps ? liaTemps.textContent : "";
    // le texte, replié sur téléphone : « Lire tout » le déplie (il se déplie aussi pendant l'écoute)
    if (citation) {
      var lire = document.createElement("button");
      lire.type = "button";
      lire.className = "lia-lire";
      lire.textContent = "Lire le texte";
      lire.setAttribute("aria-expanded", "false");
      citation.parentNode.insertBefore(lire, citation.nextSibling);
      var texteLia = $("p", citation) || citation;
      var majLire = function () { lire.hidden = lia.classList.contains("deplie"); };
      lire.addEventListener("click", function () { lia.classList.add("deplie"); lire.setAttribute("aria-expanded", "true"); majLire(); });
      majLire();
      window.addEventListener("resize", majLire);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(majLire);
    }
    if (liaAudio && liaBouton) {
      relierBouton(liaAudio, liaBouton, "Lia qui vous présente l'émission");
      var courantLia = -1;
      var majLia = function () {
        var d = liaAudio.duration || Number(liaAudio.dataset.duree) || 0;
        var t = liaAudio.currentTime;
        if (liaPiste) liaPiste.style.setProperty("--p", d ? Math.min(1, t / d) : 0);
        if (liaTemps) liaTemps.textContent = (t > 0 && !liaAudio.ended) ? "· " + duree(t) + " / " + duree(d) : tempsDepart;
        var k = -1;
        if (!liaAudio.paused || t > 0) morceaux.forEach(function (m, i) { if (t >= Number(m.getAttribute("data-t"))) k = i; });
        if (liaAudio.ended) k = -1;
        if (k !== courantLia) {
          courantLia = k;
          morceaux.forEach(function (m, i) { m.classList.toggle("dit", i === k); m.classList.toggle("deja", i < k); });
        }
      };
      ["timeupdate", "seeked", "loadedmetadata", "ended"].forEach(function (e) { liaAudio.addEventListener(e, majLia); });
      // le citron d'ambre de Lia (14/10/2026, Alexandre : « il scintillerait quand l'IA parle, vibration douce, lumière
      // douce autour et à l'intérieur ») : sa lumière suit le volume de sa voix ; sans Web Audio, une pulsation en CSS
      var voixCtx = null, voixAna = null, voixDonnees = null, voixLissee = 0;
      var suivreVoix = function () {
        if (!voixAna || liaAudio.paused) { lia.style.setProperty("--voix", "0"); return; }
        voixAna.getByteTimeDomainData(voixDonnees);
        var somme = 0;
        for (var i = 0; i < voixDonnees.length; i++) { var v = (voixDonnees[i] - 128) / 128; somme += v * v; }
        var niveau = Math.min(1, Math.sqrt(somme / voixDonnees.length) * 4.5);
        voixLissee += (niveau - voixLissee) * 0.25;
        lia.style.setProperty("--voix", voixLissee.toFixed(3));
        requestAnimationFrame(suivreVoix);
      };
      liaAudio.addEventListener("play", function () {
        try {
          if (!voixCtx && (window.AudioContext || window.webkitAudioContext) && !calme) {
            voixCtx = new (window.AudioContext || window.webkitAudioContext)();
            var srcVoix = voixCtx.createMediaElementSource(liaAudio);
            voixAna = voixCtx.createAnalyser();
            voixAna.fftSize = 512;
            voixDonnees = new Uint8Array(voixAna.fftSize);
            srcVoix.connect(voixAna);
            voixAna.connect(voixCtx.destination);
            lia.classList.add("voix-suivie");
          }
          if (voixCtx && voixCtx.state === "suspended") voixCtx.resume();
        } catch (e) { voixAna = null; }
        requestAnimationFrame(suivreVoix);
      });
      ["play", "pause", "ended"].forEach(function (e) {
        liaAudio.addEventListener(e, function () {
          var joue = !liaAudio.paused && !liaAudio.ended;
          lia.classList.toggle("joue", joue);
          if (joue) lia.classList.add("ecoute", "ecoutee");
          if (liaAudio.ended) { lia.classList.remove("ecoute"); liaAudio.currentTime = 0; majLia(); }
        });
      });
    }
  }

  /* ------------------------------------------------ chapitres : celui qu'on lit est mis en avant (pendant l'écoute,
     celui qu'on entend : voir le lecteur ci-dessous) */
  var liensCh = $$(".chapitres a[href^='#']");
  var parId = {};
  liensCh.forEach(function (a) { parId[a.getAttribute("href").slice(1)] = a; });
  var courantCh = null;
  var suiviParAudio = function () { return false; };
  var marquerCh = function (id) {
    if (courantCh === id || !parId[id]) return;
    courantCh = id;
    liensCh.forEach(function (a) { a.classList.remove("courant"); a.removeAttribute("aria-current"); });
    parId[id].classList.add("courant");
    parId[id].setAttribute("aria-current", "true");
    // sur téléphone, la liste défile de côté : on amène le chapitre en vue, sans bouger la page
    var liste = parId[id].closest("ol");
    if (liste && liste.scrollWidth > liste.clientWidth) {
      var li = parId[id].parentNode;
      liste.scrollTo({ left: li.offsetLeft - 20, behavior: calme ? "auto" : "smooth" });
    }
  };
  if (liensCh.length && "IntersectionObserver" in window) {
    var obsCh = new IntersectionObserver(function (entrees) {
      if (suiviParAudio()) return;
      entrees.forEach(function (e) { if (e.isIntersecting) marquerCh(e.target.id); });
    }, { rootMargin: "-15% 0px -70% 0px" });
    Object.keys(parId).forEach(function (id) {
      var t = document.getElementById(id);
      if (t) obsCh.observe(t);
    });
  }

  /* ------------------------------------------------ page portrait : le lecteur, le mini-lecteur, les instants
     Chapitres et répliques portent data-debut (secondes, minutage.json) : un clic lance l'écoute à cet instant ;
     pendant l'écoute, la réplique entendue et son chapitre s'éclairent, sans jamais faire défiler la page. */
  var lecteur = $(".lecteur[data-audio]");
  if (lecteur) {
    var audio = $("audio", lecteur);
    var nom = lecteur.getAttribute("data-nom") || "l'épisode";
    var mini = $(".mini");
    var boutons = $$(".bouton-lecture", lecteur).concat(mini ? $$(".bouton-lecture", mini) : []);
    boutons.forEach(function (b) { relierBouton(audio, b, nom); });
    relierCurseur(audio, null, $(".temps-courant", lecteur), $(".temps-total", lecteur), $(".onde", lecteur));
    if (mini) relierCurseur(audio, null, $(".mini-courant", mini), $(".mini-total", mini), $(".mini-piste", mini));
    ["play", "pause", "ended"].forEach(function (e) {
      audio.addEventListener(e, function () { lecteur.classList.toggle("joue", !audio.paused && !audio.ended); });
    });
    $$("[data-saut]", lecteur).concat(mini ? $$("[data-saut]", mini) : []).forEach(function (b) {
      b.addEventListener("click", function () { audio.currentTime = Math.max(0, audio.currentTime + Number(b.getAttribute("data-saut"))); });
    });
    // vitesse : un bouton dans le grand lecteur et un dans le mini-lecteur, toujours d'accord entre eux
    var vitesses = [1, 1.25, 1.5, 2, 0.85], iv = 0;
    var bvs = $$("[data-vitesse]", lecteur).concat(mini ? $$("[data-vitesse]", mini) : []);
    bvs.forEach(function (bv) {
      bv.addEventListener("click", function () {
        iv = (iv + 1) % vitesses.length;
        audio.playbackRate = vitesses[iv];
        var txt = String(vitesses[iv]).replace(".", ",") + "×";
        bvs.forEach(function (b) {
          b.textContent = txt;
          b.setAttribute("aria-label", "Vitesse de lecture : " + txt);
          b.classList.toggle("change", vitesses[iv] !== 1);
        });
      });
    });

    // reprise (13/10/2026) : la position est gardée dans ce navigateur ; la prochaine écoute reprend là
    var clePos = "vdia-position:" + location.pathname, reprise = 0;
    try { reprise = Number(localStorage.getItem(clePos)) || 0; } catch (e) {}
    var dernierEnreg = 0;
    var enregistrer = function (force) {
      var now = Date.now();
      if (!force && now - dernierEnreg < 4000) return;
      dernierEnreg = now;
      try {
        var d = audio.duration || 0;
        if (audio.ended || (d && audio.currentTime > d - 20)) localStorage.removeItem(clePos);
        else if (audio.currentTime > 15) localStorage.setItem(clePos, String(Math.floor(audio.currentTime)));
      } catch (e) {}
    };
    audio.addEventListener("timeupdate", function () { enregistrer(false); });
    audio.addEventListener("pause", function () { enregistrer(true); });
    audio.addEventListener("ended", function () { reprise = 0; enregistrer(true); });
    audio.addEventListener("play", function () {
      if (reprise > 15 && audio.currentTime < 1) audio.currentTime = reprise;
      reprise = 0;
    }, { once: false });

    // commandes du téléphone (écran verrouillé, écouteurs, touches multimédia du clavier)
    if ("mediaSession" in navigator) {
      try {
        var og = document.querySelector('meta[property="og:image"]');
        navigator.mediaSession.metadata = new MediaMetadata({
          title: nom, artist: "Les Voix de l'IA", album: "3h33",
          artwork: og ? [{ src: og.getAttribute("content"), sizes: "1200x630", type: "image/jpeg" }] : []
        });
        var ms = navigator.mediaSession;
        ms.setActionHandler("play", function () { audio.play().catch(function () {}); });
        ms.setActionHandler("pause", function () { audio.pause(); });
        ms.setActionHandler("seekbackward", function () { audio.currentTime = Math.max(0, audio.currentTime - 15); });
        ms.setActionHandler("seekforward", function () { audio.currentTime = audio.currentTime + 15; });
        ms.setActionHandler("seekto", function (d) { if (d && d.seekTime != null) audio.currentTime = d.seekTime; });
      } catch (e) {}
    }

    // clavier : espace = lecture / pause, flèches gauche et droite = 15 secondes (hors champs de saisie et curseurs)
    document.addEventListener("keydown", function (ev) {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      var t = ev.target, tag = t && t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
      if (t && t.getAttribute && t.getAttribute("role") === "slider") return;
      if (ev.key === " " || ev.key === "k") {
        if (tag === "BUTTON" || tag === "A") return; // l'espace sur un bouton ou un lien garde son sens
        ev.preventDefault();
        if (audio.paused) audio.play().catch(function () {}); else audio.pause();
      } else if (ev.key === "ArrowLeft" || ev.key === "j") {
        if (!commence()) return; ev.preventDefault(); audio.currentTime = Math.max(0, audio.currentTime - 15);
      } else if (ev.key === "ArrowRight" || ev.key === "l") {
        if (!commence()) return; ev.preventDefault(); audio.currentTime = audio.currentTime + 15;
      }
    });

    // écouter à partir d'un instant (un souffle avant le premier mot)
    var ecouterA = function (t) {
      t = Math.max(0, t - 0.2);
      var aller = function () { audio.currentTime = t; };
      if (audio.readyState >= 1) aller(); else audio.addEventListener("loadedmetadata", aller, { once: true });
      if (audio.paused) audio.play().catch(function () {});
    };
    var commence = function () { return !audio.paused || (audio.currentTime > 0 && !audio.ended); };
    suiviParAudio = function () { return !audio.paused && !audio.ended; };
    // le quiz (plus bas) se propose quand l'écoute arrive au « mot de la fin » (ou à la toute fin, sans minutage)
    var hFin = $("#le-mot-de-la-fin[data-debut]"), tFin = hFin ? Number(hFin.getAttribute("data-debut")) : 0, finDite = false;
    var annoncerFin = function () { if (!finDite) { finDite = true; document.dispatchEvent(new CustomEvent("episode:fin")); } };
    audio.addEventListener("timeupdate", function () { if (tFin > 60 && !audio.paused && audio.currentTime >= tFin) annoncerFin(); });
    audio.addEventListener("ended", annoncerFin);

    var repliques = $$(".replique[data-debut]");
    var debuts = repliques.map(function (r) { return Number(r.getAttribute("data-debut")); });
    var titres = $$(".chapitre-titre[data-debut]");
    var debutsCh = titres.map(function (h) { return Number(h.getAttribute("data-debut")); });
    var dernierAvant = function (liste, t) { // plus grand k tel que liste[k] <= t (liste croissante), sinon -1
      var a = 0, b = liste.length - 1, k = -1;
      while (a <= b) { var m = (a + b) >> 1; if (liste[m] <= t) { k = m; a = m + 1; } else b = m - 1; }
      return k;
    };
    var kRep = -2, kCh = -2;
    var miniN = mini && $(".mini-n", mini), miniCh = mini && $(".mini-chapitre", mini), miniAller = mini && $(".mini-aller", mini);
    var majInstants = function () {
      var t = audio.currentTime;
      var actif = commence();
      var k = actif && repliques.length ? dernierAvant(debuts, t + 0.25) : -1;
      if (k !== kRep) {
        if (kRep >= 0 && repliques[kRep]) repliques[kRep].classList.remove("en-cours");
        if (k >= 0) repliques[k].classList.add("en-cours");
        kRep = k;
      }
      var c = actif && titres.length ? Math.max(0, dernierAvant(debutsCh, t + 0.35)) : -1;
      var cle = actif ? c : -9; // -9 : pas encore écouté (sans chapitres minutés, c reste à -1 pendant l'écoute)
      if (cle !== kCh) {
        kCh = cle;
        var h = titres[c];
        liensCh.forEach(function (a) { a.classList.toggle("ecoute", !!h && a.getAttribute("href") === "#" + h.id); });
        if (mini) {
          // avant la première écoute (et après la fin) : « Écouter le portrait » et la durée totale
          var titre = h ? h.getAttribute("data-titre") : actif ? nom : reprise > 15 ? "Reprendre à " + duree(reprise) : "Écouter le portrait";
          var num = /^(\d+) · (.*)$/.exec(titre); // « 03 · Le début de sa vie » : le numéro à part, en or
          miniN.textContent = num ? num[1] : "";
          miniCh.textContent = num ? num[2] : titre;
          mini.classList.toggle("avec-chapitre", !!h);
          mini.classList.toggle("attente", !actif);
          miniAller.setAttribute("aria-label", actif ? "Aller au passage en cours dans la conversation" : "Écouter " + nom);
        }
      }
      if (titres[c] && suiviParAudio()) marquerCh(titres[c].id);
    };
    ["timeupdate", "seeked", "play", "pause", "loadedmetadata"].forEach(function (e) { audio.addEventListener(e, majInstants); });
    audio.addEventListener("ended", function () {
      if (kRep >= 0 && repliques[kRep]) repliques[kRep].classList.remove("en-cours");
      kRep = -1;
    });
    var majEcoute = function () {
      doc.classList.toggle("en-ecoute", !audio.paused && !audio.ended);
      doc.classList.toggle("en-pause", audio.paused && commence());
      if (kRep >= 0 && repliques[kRep]) repliques[kRep].setAttribute("title", audio.paused ? "Cliquer pour reprendre" : "Cliquer pour mettre en pause");
    };
    ["play", "pause", "ended"].forEach(function (e) { audio.addEventListener(e, majEcoute); });

    // un clic sur un chapitre : l'écoute part à son instant, et la page descend à son texte (lien normal)
    liensCh.forEach(function (a) {
      if (!a.hasAttribute("data-debut")) return;
      a.addEventListener("click", function () { ecouterA(Number(a.getAttribute("data-debut"))); });
    });
    // un clic sur une réplique (ou sur son instant, ou sur celui d'une partie) : l'écoute part au début de la réplique
    var conv = $(".conversation.minutee");
    if (conv) conv.addEventListener("click", function (ev) {
      var ici = ev.target.closest(".ecouter-ici");
      if (ici) { ev.preventDefault(); ecouterA(Number(ici.getAttribute("data-debut"))); return; }
      var r = ev.target.closest(".replique[data-debut]");
      if (!r || ev.target.closest("a")) return;
      if (window.getSelection && String(window.getSelection())) return; // on sélectionne du texte : on ne lance rien
      // la réplique en cours : un clic met en pause, un autre reprend (demande d'Alexandre, 13/10/2026)
      if (r.classList.contains("en-cours")) {
        if (audio.paused) audio.play().catch(function () {}); else audio.pause();
        return;
      }
      ecouterA(Number(r.getAttribute("data-debut")));
    });

    // le mini-lecteur, sous la barre du haut : visible dès que le grand lecteur n'est pas à l'écran (passé au-dessus,
    // ou encore plus bas : sur téléphone, dès l'arrivée) ; avant la première écoute il dit « Écouter le portrait » et
    // un toucher sur ce libellé lance l'écoute ; ensuite, un clic sur le chapitre ramène au passage entendu
    if (mini) {
      var hautBarre = 56;
      var mesurer = function () {
        hautBarre = barre ? Math.round(barre.getBoundingClientRect().height) : 0;
        doc.style.setProperty("--haut-barre", hautBarre + "px");
        doc.style.setProperty("--haut-mini", Math.round(mini.getBoundingClientRect().height) + "px");
      };
      var visible = null;
      var telephone = window.matchMedia("(max-width:700px)");
      var majMini = function () { // un seul getBoundingClientRect : assez léger pour chaque événement de défilement
        // visible aussi quand le grand lecteur est encore plus bas que l'écran (téléphone : la vignette prend
        // tout le premier écran) ; caché seulement quand le grand lecteur lui-même est à l'écran
        // téléphone (14/10/2026, Alexandre : il apparaissait et disparaissait au défilement) : toujours là, fixe en haut
        var r = lecteur.getBoundingClientRect();
        var v = telephone.matches || r.bottom < hautBarre + 8 || r.top > window.innerHeight - 24;
        if (v === visible) return;
        visible = v;
        mini.classList.toggle("visible", v);
        doc.classList.toggle("mini-ouvert", v);
        mini.setAttribute("aria-hidden", v ? "false" : "true");
      };
      mesurer();
      majMini();
      window.addEventListener("scroll", majMini, { passive: true });
      window.addEventListener("resize", function () { mesurer(); majMini(); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(mesurer);
      miniAller.addEventListener("click", function () {
        if (!commence()) { audio.play().catch(function () {}); return; } // « Écouter le portrait » : on écoute
        var cible = kRep >= 0 ? repliques[kRep] : (kCh >= 0 && titres[kCh]) || lecteur;
        cible.scrollIntoView({ block: cible === lecteur ? "start" : "center", behavior: calme ? "auto" : "smooth" });
      });
    }
  }

  /* ------------------------------------------------ partager une carte (13/10/2026) : le partage du téléphone s'il
     existe, sinon un petit menu LinkedIn, X, Facebook, WhatsApp, e-mail, copier le lien */
  var popPartage = null;
  var fermerPartage = function () {
    if (!popPartage) return;
    var b = popPartage._bouton;
    popPartage.parentNode.removeChild(popPartage);
    popPartage = null;
    if (b) b.setAttribute("aria-expanded", "false");
  };
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest(".card-partager");
    if (!b) { if (popPartage && !popPartage.contains(ev.target)) fermerPartage(); return; }
    ev.preventDefault(); ev.stopPropagation();
    var url = b.getAttribute("data-partager-url"), titre = b.getAttribute("data-partager-titre");
    if (navigator.share && window.matchMedia("(pointer:coarse)").matches) { navigator.share({ title: titre, text: titre, url: url }).catch(function () {}); return; }
    if (popPartage && popPartage._bouton === b) return fermerPartage();
    fermerPartage();
    // ?via=… : chaque réseau reçoit une adresse qu'il n'a pas encore en cache, donc il relit l'aperçu (image comprise)
    var u = encodeURIComponent(url), t = encodeURIComponent(titre), via = function (r) { return encodeURIComponent(url + "?via=" + r); };
    var liens = [
      ["LinkedIn", "https://www.linkedin.com/sharing/share-offsite/?url=" + via("linkedin")],
      ["X", "https://x.com/intent/tweet?text=" + t + "&url=" + via("x")],
      ["Facebook", "https://www.facebook.com/sharer/sharer.php?u=" + via("facebook")],
      ["WhatsApp", "https://wa.me/?text=" + encodeURIComponent(titre + " " + url)],
      ["E-mail", "mailto:?subject=" + t + "&body=" + encodeURIComponent(titre + "\n" + url)]
    ];
    popPartage = document.createElement("div");
    popPartage.className = "partage-pop";
    popPartage.setAttribute("role", "menu");
    liens.forEach(function (l) {
      var a = document.createElement("a");
      a.href = l[1]; a.textContent = l[0]; a.setAttribute("role", "menuitem");
      if (l[0] !== "E-mail") { a.target = "_blank"; a.rel = "noopener"; }
      popPartage.appendChild(a);
    });
    var copier = document.createElement("button");
    copier.type = "button"; copier.textContent = "Copier le lien"; copier.setAttribute("role", "menuitem");
    copier.addEventListener("click", function () {
      var ok = function () { copier.textContent = "Lien copié ✓"; setTimeout(fermerPartage, 1200); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(ok, function () { window.prompt("Copiez ce lien :", url); });
      else window.prompt("Copiez ce lien :", url);
    });
    popPartage.appendChild(copier);
    popPartage._bouton = b;
    b.setAttribute("aria-expanded", "true");
    document.body.appendChild(popPartage);
    // posé au-dessus du bouton (ou dessous s'il n'y a pas la place), dans la page et pas dans la carte qui le couperait
    var r = b.getBoundingClientRect(), h = popPartage.offsetHeight, w = popPartage.offsetWidth;
    var haut = r.top - h - 8 > 8 ? r.top - h - 8 : r.bottom + 8;
    popPartage.style.top = Math.round(haut + window.scrollY) + "px";
    popPartage.style.left = Math.round(Math.max(8, Math.min(r.right - w, document.documentElement.clientWidth - w - 8)) + window.scrollX) + "px";
    var premier = popPartage.querySelector("a");
    if (premier) try { premier.focus({ preventScroll: true }); } catch (e) {}
  });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && popPartage) { var b = popPartage._bouton; fermerPartage(); if (b) b.focus(); } });

  /* ------------------------------------------------ « copier le flux RSS » (bloc Abonnez-vous, 14/10/2026) */
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest("[data-copier]");
    if (!b) return;
    var url = b.getAttribute("data-copier"), mot = $("span", b) || b, avant = mot.textContent;
    var ok = function () { mot.textContent = "Adresse du flux copiée ✓ — collez-la dans votre application"; setTimeout(function () { mot.textContent = avant; }, 3500); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(ok, function () { window.prompt("Copiez l'adresse du flux :", url); });
    else window.prompt("Copiez l'adresse du flux :", url);
  });

  /* ------------------------------------------------ partage */
  var partage = $(".partage");
  if (partage) {
    var natif = $(".partage-natif", partage);
    if (navigator.share && natif) {
      partage.classList.add("natif");
      natif.addEventListener("click", function () {
        navigator.share({ title: partage.getAttribute("data-titre"), text: partage.getAttribute("data-texte"), url: partage.getAttribute("data-url") }).catch(function () {});
      });
    }
    var copie = $(".partage-copie", partage);
    if (copie) copie.addEventListener("click", function () {
      var url = partage.getAttribute("data-url");
      var fini = function () {
        var avant = copie.innerHTML;
        copie.classList.add("copie-ok");
        copie.textContent = "Lien copié";
        setTimeout(function () { copie.classList.remove("copie-ok"); copie.innerHTML = avant; }, 2200);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(fini, function () { window.prompt("Copiez ce lien :", url); });
      else window.prompt("Copiez ce lien :", url);
    });
  }

  /* ------------------------------------------------ « Signaler une erreur ou une info » (12/10/2026)
     L'adresse n'est jamais écrite en clair dans la page (robots) : elle est assemblée au clic, avec un objet
     (« Les Voix de l'IA — <portrait> ») et un corps préremplis. Si aucune messagerie ne s'ouvre, l'adresse s'affiche. */
  $$("[data-signaler]").forEach(function (b) {
    b.addEventListener("click", function () {
      var adresse = b.getAttribute("data-u") + "@" + b.getAttribute("data-d");
      var nom = b.getAttribute("data-nom");
      var objet = "Les Voix de l'IA" + (nom ? " — " + nom : "");
      var corps = "Passage concerné : …\r\nCe qui est inexact ou ce que je sais : …\r\nSource (lien) : …\r\n\r\nPage : " + (b.getAttribute("data-page") || location.href.split(/[?#]/)[0]);
      location.href = "mailto:" + adresse + "?subject=" + encodeURIComponent(objet) + "&body=" + encodeURIComponent(corps);
      var etat = b.parentNode && $(".signaler-etat", b.closest(".signaler") || b.closest("section") || document);
      if (etat) {
        etat.textContent = "Votre messagerie ne s'ouvre pas ? Écrivez à " + adresse + (nom ? ", en précisant le portrait " + (/^[aeiouyàâéèêîôûœ]/i.test(nom) ? "d'" : "de ") + nom : "") + ".";
        etat.classList.add("visible");
      }
    });
  });

  /* ------------------------------------------------ boutons « Copier l'adresse » (flux RSS) */
  $$("[data-copier]").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      var texte = bouton.getAttribute("data-copier");
      var libelle = $("span", bouton);
      if (libelle && !bouton.dataset.libelle) bouton.dataset.libelle = libelle.textContent;
      var fini = function () {
        bouton.classList.add("copie-ok");
        if (libelle) libelle.textContent = "Adresse copiée";
        clearTimeout(bouton._minuteur);
        bouton._minuteur = setTimeout(function () { bouton.classList.remove("copie-ok"); if (libelle) libelle.textContent = bouton.dataset.libelle; }, 2400);
      };
      var secours = function () {
        // ancien navigateur ou page non sécurisée : on sélectionne l'adresse affichée à côté
        var champ = bouton.parentNode && $(".flux-adresse", bouton.parentNode);
        if (champ && window.getSelection) {
          var r = document.createRange(); r.selectNodeContents(champ);
          var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
          try { if (document.execCommand("copy")) return fini(); } catch (e) {}
        }
        window.prompt("Copiez cette adresse :", texte);
      };
      if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(texte).then(fini, secours);
      else secours();
    });
  });

  /* ------------------------------------------------ abonnement par e-mail (double confirmation)
     Le service répond toujours de la même façon, que l'adresse soit nouvelle ou déjà inscrite. */
  $$("form[data-abonnement]").forEach(function (form) {
    if (!window.fetch || !window.JSON) return;               // ancien navigateur : le formulaire poste normalement
    var debut = Date.now();
    var champ = $("input[type=email]", form);
    var bouton = $("button[type=submit]", form);
    var etat = $(".abo-email-etat", form);
    var dire = function (texte, genre) { etat.textContent = texte; etat.className = "abo-email-etat" + (genre ? " " + genre : ""); };
    var rendre = function () { bouton.disabled = false; form.classList.remove("en-cours"); };
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = (champ.value || "").trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) { dire("Cette adresse e-mail semble incorrecte.", "erreur"); champ.focus(); return; }
      bouton.disabled = true;
      form.classList.add("en-cours");
      dire("Envoi en cours…");
      fetch(form.getAttribute("action"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email,
          liste: form.elements.liste.value,
          site: form.elements.site.value,                    // champ piège, invisible pour un humain
          instant: debut,
          ecoule: Date.now() - debut,
          page: location.pathname
        })
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { return { statut: r.status, j: j }; });
      }).then(function (x) {
        if (x.statut === 200 && x.j.ok && !x.j.envoi) {
          form.classList.add("envoye");
          dire("Vérifiez votre boîte : un e-mail de confirmation vient de partir.", "ok");
        } else if (x.statut === 200 && x.j.ok) {
          dire("Votre demande est notée, mais l'envoi des e-mails n'est pas encore en service. Réessayez dans quelques jours.", "erreur");
        } else {
          dire((x.j.erreurs && x.j.erreurs[0]) || "L'inscription n'a pas abouti. Réessayez dans un moment.", "erreur");
        }
        rendre();
      }, function () {
        dire("Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.", "erreur");
        rendre();
      });
    });
  });

  /* ------------------------------------------------ page de l'émission : lecteur collant */
  var player = $("#player");
  var donnees = $("#donnees-lecteur");
  if (player && donnees) {
    var episodes = JSON.parse(donnees.textContent);
    var actuel = null;
    // « Ma playlist » (plus bas) se branche ici : elle sait quel épisode se charge et décide de la suite
    var pl = { charge: function () {}, voisin: function () { return false; }, fin: function () { return false; } };
    var pAudio = $("audio", player);
    var pBouton = $(".bouton-lecture", player);
    var frame = $("#playerFrame");
    relierCurseur(pAudio, $("input.curseur", player), $(".temps-courant", player), $(".temps-total", player));
    relierBouton(pAudio, pBouton, "l'épisode");
    var marquerCartes = majBoutonsJouer = function () {
      $$(".episode-card").forEach(function (c) { c.classList.toggle("actif", c.getAttribute("data-id") === (actuel && actuel.id)); });
      $$("[data-jouer]").forEach(function (b) {
        var lui = actuel && b.getAttribute("data-jouer") === actuel.id && actuel.type === "audio" && !pAudio.paused;
        b.classList.toggle("joue", !!lui);
        var svg = $("svg", b);
        if (svg) svg.innerHTML = lui ? '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>' : '<polygon points="5,3 19,12 5,21"/>';
      });
    };
    ["play", "pause", "ended"].forEach(function (e) { pAudio.addEventListener(e, marquerCartes); });

    var charger = function (i, demarrer) {
      var ep = episodes[i];
      if (!ep) return;
      // même épisode MP3 : simple lecture / pause
      if (actuel && actuel.id === ep.id && ep.type === "audio") {
        if (pAudio.paused) pAudio.play().catch(function () {}); else pAudio.pause();
        return;
      }
      actuel = ep; actuel.index = i;
      $("#playerName").textContent = ep.nom;
      $("#playerRole").textContent = ep.role || "";
      var pc = $("#playerCover");
      pc.innerHTML = "";
      if (ep.image) { var im = document.createElement("img"); im.src = ep.image; im.alt = ""; im.width = 46; im.height = 46; pc.appendChild(im); }
      else pc.textContent = ep.initiales || "V";
      player.setAttribute("data-mode", ep.type);
      document.body.classList.add("lecteur-ouvert");
      document.body.classList.toggle("mode-audio", ep.type === "audio");
      if (ep.type === "audio") {
        frame.innerHTML = "";
        frame.classList.remove("loaded");
        pAudio.src = ep.src;
        pAudio.dataset.duree = ep.duree || "";
        $(".lien-page", player).href = ep.page;
        if (demarrer) pAudio.play().catch(function () {});
      } else {
        pAudio.pause();
        pAudio.removeAttribute("src");
        frame.classList.remove("loaded");
        frame.innerHTML = "";
        var f = document.createElement("iframe");
        f.src = "https://open.spotify.com/embed/episode/" + ep.spotifyId + "?utm_source=generator&theme=0";
        f.title = "Lecteur Spotify — " + ep.nom;
        f.setAttribute("allow", "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture");
        f.setAttribute("loading", "lazy");
        f.addEventListener("load", function () { frame.classList.add("loaded"); });
        frame.appendChild(f);
        $("#openSpotifyBtn").href = ep.spotify;
        $("#openSpotifyBtnMobile").href = ep.spotify;
      }
      player.classList.add("active");
      marquerCartes();
      pl.charge(ep);
    };
    // un seul écouteur pour tous les boutons « écouter » (y compris celui de « Connaissez-vous… ? », qui change de
    // portrait sans recharger la page)
    document.addEventListener("click", function (ev) {
      var b = ev.target.closest && ev.target.closest("[data-jouer]");
      if (!b || ev.defaultPrevented) return;
      if (b.tagName === "A" && (ev.button || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey)) return; // nouvel onglet : la page
      var id = b.getAttribute("data-jouer");
      for (var i = 0; i < episodes.length; i++) if (episodes[i].id === id) { ev.preventDefault(); ev.stopPropagation(); return charger(i, true); }
    });
    var voisin = function (pas) {
      if (!actuel || pl.voisin(pas)) return;
      var n = episodes.length, i = actuel.index;
      for (var k = 1; k <= n; k++) { var j = (i + pas * k + n * k) % n; if (episodes[j].type) return charger(j, true); }
    };
    $("#prevBtn").addEventListener("click", function () { voisin(-1); });
    $("#nextBtn").addEventListener("click", function () { voisin(1); });
    $("#closeBtn").addEventListener("click", function () {
      player.classList.remove("active");
      pAudio.pause();
      document.body.classList.remove("lecteur-ouvert", "mode-audio");
      setTimeout(function () { frame.innerHTML = ""; }, 500);
      actuel = null; marquerCartes();
      pl.charge(null);
    });
    pAudio.addEventListener("ended", function () { if (!pl.fin()) voisin(1); });
    // « La conversation » : la page du portrait reprend au moment écouté (même clé que sa reprise, 13/10/2026)
    $(".lien-page", player).addEventListener("click", function () {
      if (!actuel || actuel.type !== "audio" || !(pAudio.currentTime > 2)) return;
      try { localStorage.setItem("vdia-position:" + new URL(actuel.page, location.href).pathname, String(Math.floor(pAudio.currentTime))); } catch (e) {}
    });
    document.addEventListener("keydown", function (e) {
      if (!player.classList.contains("active") || e.target.closest("input,textarea,dialog,#ma-playlist")) return;
      if (e.key === "Escape") $("#closeBtn").click();
    });

    /* ------------------------------------------------ « Ma playlist » (marche 1 de docs/ETUDE-PLAYLISTS-PARCOURS.md, 16/10/2026)
       Un « + » sur chaque portrait (et « Tout ajouter » sur une recherche ou une famille) remplit la playlist ; une
       barre en bas de l'écran la résume (« Ma playlist · 6 épisodes · 58 min — Écouter ») et le lecteur collant
       l'enchaîne : à la fin d'un épisode, le suivant de la liste, et rien après le dernier. La liste s'ouvre au-dessus
       de la barre : écouter un épisode, le remonter, le descendre, le retirer, copier le lien. Gardée dans ce
       navigateur (localStorage, s'il est permis) ; le lien …/#playlist=id1,id2 la donne à quelqu'un d'autre, sans
       compte ni serveur. Seuls les portraits qu'on peut écouter (MP3) y entrent. */
    (function () {
      var boite = $("#ma-playlist");
      if (!boite) return;
      var CLE = "vdia-playlist", CLE_AVANT = "vdia-playlist-avant";
      var parId = {};
      episodes.forEach(function (ep, i) { if (ep.type === "audio") parId[ep.id] = i; });
      var valides = function (ids) {
        var vus = {};
        return (Array.isArray(ids) ? ids : []).filter(function (id) { if (typeof id !== "string" || !(id in parId) || vus[id]) return false; vus[id] = 1; return true; }).slice(0, 200);
      };
      var lire = function (k) { try { var v = JSON.parse(localStorage.getItem(k) || "null"); return v && Array.isArray(v.ids) ? v : null; } catch (e) { return null; } };
      var garde = lire(CLE) || { ids: [] };
      var ids = valides(garde.ids);
      var enCours = false;  // le lecteur suit-il la playlist ?
      var idCourant = null; // l'épisode de la playlist qu'on écoute
      var pos = Math.max(0, Math.min(Number(garde.pos) || 0, ids.length - 1)); // où reprendre
      var lancement = false;
      var sauver = function () { try { localStorage.setItem(CLE, JSON.stringify({ ids: ids, pos: pos })); } catch (e) {} };

      var barreEl = $(".mp-barre", boite), panneau = $("#mp-panneau"), liste = $(".mp-liste", boite);
      var ouvrir = $(".mp-ouvrir", boite), ecouter = $(".mp-ecouter", boite), resume = $(".mp-resume", boite);
      var etatEl = $(".mp-etat", boite), recu = $(".mp-recu", boite);
      var toutAjouter = $(".tout-ajouter");
      var ICONE_LECTURE = '<polygon points="5,3 19,12 5,21"/>', ICONE_PAUSE = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';

      var dureeTotale = function (s) {
        var m = Math.round(s / 60);
        if (m < 60) return m + "\u00a0min";
        return Math.floor(m / 60) + "\u00a0h\u00a0" + ("0" + (m % 60)).slice(-2);
      };
      var dire = function (t) {
        etatEl.textContent = t;
        clearTimeout(dire.m);
        dire.m = setTimeout(function () { etatEl.textContent = ""; }, 4000);
      };
      // la barre se pose juste au-dessus du lecteur collant quand il est ouvert
      var caler = function () {
        doc.style.setProperty("--lecteur-h", player.classList.contains("active") ? player.offsetHeight + "px" : "0px");
      };
      window.addEventListener("resize", caler);

      var bouton = function (classe, icone, label, action) {
        var b = document.createElement("button");
        b.type = "button"; b.className = classe; b.innerHTML = icone; b.setAttribute("aria-label", label); b.title = label;
        b.addEventListener("click", action);
        return b;
      };
      var rendre = function () {
        var n = ids.length;
        boite.hidden = !n;
        document.body.classList.toggle("avec-playlist", !!n);
        if (!n) { panneau.hidden = true; ouvrir.setAttribute("aria-expanded", "false"); boite.classList.remove("ouverte"); document.body.classList.remove("playlist-ouverte"); enCours = false; }
        var total = ids.reduce(function (t, id) { return t + (Number(episodes[parId[id]].duree) || 0); }, 0);
        var k = enCours && idCourant ? ids.indexOf(idCourant) : -1;
        resume.textContent = (k >= 0 ? (k + 1) + " sur " + n : n + (n > 1 ? " épisodes" : " épisode")) + " · " + dureeTotale(total);
        ouvrir.setAttribute("aria-label", "Ma playlist, " + n + (n > 1 ? " épisodes, " : " épisode, ") + dureeTotale(total) + " : ouvrir la liste");
        var joue = enCours && !pAudio.paused && !pAudio.ended;
        $("svg", ecouter).innerHTML = joue ? ICONE_PAUSE : ICONE_LECTURE;
        $(".mp-ecouter-mot", ecouter).textContent = joue ? "Pause" : enCours ? "Reprendre" : "Écouter";
        ecouter.setAttribute("aria-label", joue ? "Mettre la playlist en pause" : enCours ? "Reprendre la playlist" : "Écouter la playlist");
        boite.classList.toggle("joue", joue);
        // la liste
        liste.textContent = "";
        ids.forEach(function (id, i) {
          var ep = episodes[parId[id]], li = document.createElement("li");
          li.className = "mp-item" + (enCours && id === idCourant ? " en-cours" : "");
          var jouer = document.createElement("button");
          jouer.type = "button"; jouer.className = "mp-jouer";
          jouer.setAttribute("aria-label", "Écouter " + ep.nom + " (" + duree(ep.duree) + "), épisode " + (i + 1) + " de la playlist");
          var vig = document.createElement("span"); vig.className = "mp-vignette";
          if (ep.image) { var im = document.createElement("img"); im.src = ep.image; im.alt = ""; im.width = 40; im.height = 40; im.loading = "lazy"; vig.appendChild(im); }
          else vig.textContent = ep.initiales || "";
          var tx = document.createElement("span"); tx.className = "mp-texte";
          var nm = document.createElement("strong"); nm.textContent = ep.nom;
          var ro = document.createElement("span"); ro.className = "mp-role"; ro.textContent = duree(ep.duree) + (ep.role ? " · " + ep.role : "");
          tx.appendChild(nm); tx.appendChild(ro);
          var num = document.createElement("span"); num.className = "mp-num"; num.setAttribute("aria-hidden", "true"); num.textContent = String(i + 1);
          jouer.appendChild(num); jouer.appendChild(vig); jouer.appendChild(tx);
          jouer.addEventListener("click", function () { lancer(i); });
          var haut = bouton("mp-bouger", ICONES_MP.monter, "Remonter " + ep.nom, function () { bouger(i, -1); });
          var bas = bouton("mp-bouger", ICONES_MP.descendre, "Descendre " + ep.nom, function () { bouger(i, 1); });
          var retirer = bouton("mp-retirer", ICONES_MP.croix, "Retirer " + ep.nom + " de la playlist", function () { retirerId(id, i); });
          haut.disabled = i === 0; bas.disabled = i === n - 1;
          li.appendChild(jouer); li.appendChild(haut); li.appendChild(bas); li.appendChild(retirer);
          liste.appendChild(li);
        });
        // les « + » des cartes
        $$("[data-ajouter]").forEach(function (b) {
          var dedans = ids.indexOf(b.getAttribute("data-ajouter")) >= 0;
          b.setAttribute("aria-pressed", dedans ? "true" : "false");
          var nom = b.getAttribute("data-nom") || (b.setAttribute("data-nom", (b.getAttribute("aria-label") || "").replace(/^Ajouter le portrait | à ma playlist$/g, "")), b.getAttribute("data-nom"));
          b.setAttribute("aria-label", dedans ? "Retirer le portrait " + nom + " de ma playlist" : "Ajouter le portrait " + nom + " à ma playlist");
          b.title = dedans ? "Dans ma playlist (retirer)" : "Ajouter à ma playlist";
        });
        majToutAjouter();
        caler();
        sauver();
      };
      // « Tout ajouter » : seulement pendant une recherche ou une famille, quand des résultats ne sont pas encore dedans
      var resultats = function () {
        return $$("#grille-portraits .episode-card").filter(function (c) { return !c.hidden; })
          .map(function (c) { return c.getAttribute("data-id"); }).filter(function (id) { return id in parId; });
      };
      var majToutAjouter = function () {
        if (!toutAjouter) return;
        var r = doc.classList.contains("en-filtre") ? resultats() : [];
        var manquent = r.filter(function (id) { return ids.indexOf(id) < 0; }).length;
        toutAjouter.hidden = !r.length;
        toutAjouter.classList.toggle("fait", !manquent);
        toutAjouter.disabled = !manquent;
        $(".ta-mot", toutAjouter).textContent = !manquent ? "Tous dans ma playlist" : manquent === r.length ? "Tout ajouter à ma playlist (" + r.length + ")" : "Ajouter les " + manquent + " autres";
        toutAjouter.innerHTML = (!manquent ? ICONES_MP.coche : ICONES_MP.plus) + toutAjouter.innerHTML.replace(/^<svg[\s\S]*?<\/svg>/, "");
      };
      document.addEventListener("vdia-resultats", majToutAjouter);
      if (toutAjouter) toutAjouter.addEventListener("click", function () {
        var r = resultats().filter(function (id) { return ids.indexOf(id) < 0; });
        if (!r.length) return;
        var avaitFocus = document.activeElement === toutAjouter;
        ids = ids.concat(r);
        rendre();
        if (avaitFocus) try { ouvrir.focus({ preventScroll: true }); } catch (e) { ouvrir.focus(); } // le bouton s'éteint : on passe à la barre
        dire(r.length > 1 ? r.length + " épisodes ajoutés à ma playlist" : "1 épisode ajouté à ma playlist");
        clignoter();
      });
      var clignoter = function () { barreEl.classList.remove("ajoute"); void barreEl.offsetWidth; barreEl.classList.add("ajoute"); };

      var lancer = function (i) {
        if (!ids[i]) return;
        pos = i;
        if (enCours && idCourant === ids[i] && actuel && actuel.id === ids[i]) { if (pAudio.paused) pAudio.play().catch(function () {}); else pAudio.pause(); return; }
        lancement = true;
        charger(parId[ids[i]], true);
        lancement = false;
      };
      var bouger = function (i, pas) {
        var j = i + pas;
        if (j < 0 || j >= ids.length) return;
        var x = ids[i]; ids[i] = ids[j]; ids[j] = x;
        rendre();
        var b = $$(".mp-item", liste)[j];
        b = b && $$(".mp-bouger", b)[pas < 0 ? 0 : 1];
        if (b && !b.disabled) b.focus(); else if ($$(".mp-item", liste)[j]) $(".mp-jouer", $$(".mp-item", liste)[j]).focus();
      };
      var retirerId = function (id, i) {
        var k = ids.indexOf(id);
        if (k < 0) return;
        ids.splice(k, 1);
        if (k < pos) pos--;
        if (id === idCourant) pos = k; // l'épisode en cours continue ; ensuite, celui qui a pris sa place
        pos = Math.max(0, Math.min(pos, ids.length - 1));
        rendre();
        if (typeof i === "number") {
          var items = $$(".mp-item", liste), suivant = items[Math.min(i, items.length - 1)];
          if (suivant) $(".mp-jouer", suivant).focus(); else ouvrir.focus();
        }
      };

      // ce que le lecteur collant nous dit et nous demande
      pl.charge = function (ep) {
        if (!ep) { enCours = false; idCourant = null; }
        else if (lancement || (enCours && ids.indexOf(ep.id) >= 0)) { enCours = true; idCourant = ep.id; pos = ids.indexOf(ep.id); }
        else { enCours = false; idCourant = null; } // un autre épisode, lancé d'une carte : on quitte la playlist
        rendre();
      };
      pl.voisin = function (pas) {
        if (!enCours) return false;
        var k = ids.indexOf(idCourant), j = (k < 0 ? pos - (pas > 0 ? 1 : 0) : k) + pas;
        if (j >= 0 && j < ids.length) lancer(j);
        return true;
      };
      pl.fin = function () {
        if (!enCours) return false;
        var k = ids.indexOf(idCourant), j = k < 0 ? pos : k + 1;
        if (j < ids.length) { lancer(j); return true; }
        pos = 0; enCours = false; idCourant = null; // « Écouter » repartira du premier
        rendre();
        dire("Fin de la playlist");
        return true; // après le dernier : on s'arrête
      };
      ["play", "pause", "ended"].forEach(function (e) { pAudio.addEventListener(e, rendre); });

      ecouter.addEventListener("click", function () {
        if (enCours && actuel && actuel.id === idCourant) { if (pAudio.paused) pAudio.play().catch(function () {}); else pAudio.pause(); return; }
        lancer(Math.min(pos, ids.length - 1));
      });
      var basculer = function (ouvert) {
        panneau.hidden = !ouvert;
        ouvrir.setAttribute("aria-expanded", ouvert ? "true" : "false");
        boite.classList.toggle("ouverte", ouvert);
        document.body.classList.toggle("playlist-ouverte", ouvert); // la flèche « remonter » se range
        if (!ouvert) recu.hidden = true;
      };
      ouvrir.addEventListener("click", function () { basculer(panneau.hidden); });
      $(".mp-fermer", boite).addEventListener("click", function () { basculer(false); ouvrir.focus(); });
      boite.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && !panneau.hidden) { ev.preventDefault(); ev.stopPropagation(); basculer(false); ouvrir.focus(); }
      });
      $(".mp-vider", boite).addEventListener("click", function () {
        if (!window.confirm("Vider la playlist (" + ids.length + (ids.length > 1 ? " épisodes" : " épisode") + ") ?")) return;
        ids = []; pos = 0; enCours = false; idCourant = null;
        rendre();
      });
      // le lien de partage : …/podcast-voix-de-lia/#playlist=jensen-huang,lisa-su
      var lien = function () { return location.origin + location.pathname + "#playlist=" + ids.join(","); };
      $(".mp-partager", boite).addEventListener("click", function () {
        var url = lien(), titre = "Ma playlist des Voix de l'IA (" + ids.length + (ids.length > 1 ? " épisodes)" : " épisode)");
        if (navigator.share && window.matchMedia("(pointer:coarse)").matches) { navigator.share({ title: titre, url: url }).catch(function () {}); return; }
        var ok = function () { dire("Lien copié : collez-le dans un message."); };
        // sans presse-papiers : la petite fenêtre « Copiez ce lien », et si elle est refusée, le lien affiché dans la liste
        var secours = function () { try { window.prompt("Copiez ce lien :", url); } catch (e) { clearTimeout(dire.m); etatEl.textContent = "Copiez ce lien : " + url; } };
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(ok, secours); else secours();
      });

      // le « + » de chaque carte : ajoute, ou retire si c'est déjà dedans
      document.addEventListener("click", function (ev) {
        var b = ev.target.closest && ev.target.closest("[data-ajouter]");
        if (!b) return;
        ev.preventDefault(); ev.stopPropagation();
        var id = b.getAttribute("data-ajouter");
        if (!(id in parId)) return;
        if (ids.indexOf(id) >= 0) { retirerId(id); dire("Retiré de ma playlist"); }
        else { ids.push(id); rendre(); dire(episodes[parId[id]].nom + " ajouté à ma playlist"); clignoter(); }
      });

      // arrivée par un lien partagé : la playlist reçue remplace la sienne, qu'on peut remettre d'un clic
      // aussi sans recharger la page : un lien « Écouter le parcours » de la page d'accueil (#playlist=…)
      function recevoir() {
        var m = /[#&]playlist=([^&]*)/.exec(location.hash);
        if (!m) return;
        var duParcours = /[#&]parcours(&|$)/.test(location.hash);
        var recus = [];
        try { recus = valides(decodeURIComponent(m[1]).split(",")); } catch (e) {}
        // on retire la playlist de l'adresse (elle est gardée dans le navigateur), le reste reste (#q=…, #famille=…)
        var resteHash = location.hash.replace(/^#/, "").split("&").filter(function (x) { return x && x.indexOf("playlist=") !== 0 && x !== "parcours"; }).join("&");
        try { history.replaceState(null, "", location.pathname + location.search + (resteHash ? "#" + resteHash : "")); } catch (e) {}
        if (recus.length && recus.join(",") !== ids.join(",")) {
          if (ids.length) try { localStorage.setItem(CLE_AVANT, JSON.stringify({ ids: ids, pos: pos })); } catch (e) {}
          var avant = ids.slice();
          ids = recus; pos = 0; enCours = false;
          recu.textContent = "";
          var duRecu = recus.reduce(function (t, id) { return t + (Number(episodes[parId[id]].duree) || 0); }, 0);
          recu.appendChild(document.createTextNode((duParcours ? "Le parcours est dans votre playlist : " : "On vous a envoyé cette playlist : ") + recus.length + (recus.length > 1 ? " épisodes" : " épisode") + " · " + dureeTotale(duRecu) + ". "));
          if (avant.length) {
            var remettre = document.createElement("button");
            remettre.type = "button"; remettre.className = "mp-remettre";
            remettre.textContent = "Remettre ma playlist (" + avant.length + ")";
            remettre.addEventListener("click", function () {
              ids = valides(avant); pos = 0; enCours = false; recu.hidden = true;
              try { localStorage.removeItem(CLE_AVANT); } catch (e) {}
              rendre();
              dire("Votre playlist est revenue");
            });
            recu.appendChild(remettre);
          }
          recu.hidden = false;
          rendre();
          basculer(true);
          recu.hidden = false;
        } else if (recus.length) basculer(true);
      }
      recevoir();
      window.addEventListener("hashchange", function () { if (/[#&]playlist=/.test(location.hash)) { recevoir(); rendre(); } });
      rendre();
    })();
  }

  // Recherche, familles et « Connaissez-vous… ? » : dans leur propre portée (aucun nom partagé avec ce qui précède)
  (function () {
    /* ================================================ RECHERCHE (12/10/2026)
       Un mini moteur de recherche dans le navigateur, sans service extérieur ni bibliothèque : il fouille recherche.json
       (fabriqué par construire.mjs : nom, rôle, entreprise, titre, accroche, familles, citations, répliques) en
       « minuscules sans accents », un mot trouvé au début d'un mot du texte (« échec » trouve « échecs »), tous les mots
       de la recherche devant se retrouver dans le portrait. Le passage trouvé s'affiche en extrait surligné ; un clic
       mène au portrait, et à la réplique quand le mot vient de la conversation (#replique-N, ?q= pour surligner). */
    var CACHE_NORM = {};
    // « Échecs » → « echecs », « Œuvre » → « oeuvre », apostrophes courbes → droites
    function norm(s) {
      return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
        .replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/ß/g, "ss").replace(/[’‘ʼ`´]/g, "'");
    }
    // la même chose, avec pour chaque caractère obtenu sa position dans le texte d'origine (pour surligner)
    function normCarte(s) {
      var t = "", m = [];
      for (var i = 0; i < s.length; i++) {
        var c = s.charAt(i), n = CACHE_NORM[c];
        if (n === undefined) n = CACHE_NORM[c] = norm(c);
        for (var k = 0; k < n.length; k++) { t += n.charAt(k); m.push(i); }
      }
      m.push(s.length);
      return { t: t, m: m };
    }
    var VIDES = { de: 1, du: 1, des: 1, la: 1, le: 1, les: 1, un: 1, une: 1, et: 1, en: 1, au: 1, aux: 1, a: 1, l: 1, d: 1, the: 1, of: 1, qui: 1, que: 1, pour: 1, par: 1, sur: 1, dans: 1, avec: 1, est: 1, il: 1, elle: 1 };
    var LETTRE = "a-z0-9\u3040-\u9fff";
    var BORD = "(?:^|[^" + LETTRE + "])"; // début de mot
    function echapper(m) { return m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
    // un mot de la recherche, trouvé au début d'un mot du texte ; un mot de deux lettres (« Ma », « Li », « Su »)
    // seulement en entier, sinon « ma » trouverait « mais », « machine »…
    // très petit écran (320 px) : un texte d'aide plus court, qui tient en entier dans le champ
    function aideCourte(champ) { if (champ && champ.clientWidth && champ.clientWidth < 270) champ.placeholder = "Nom, entreprise, mot…"; }
    function regexMot(m, g) { return new RegExp(BORD + echapper(m) + (m.length < 3 ? "(?![" + LETTRE + "])" : ""), g || ""); }
    // les mots utiles d'une recherche (sans « de », « la »…), sans doublon ; aucun mot utile : pas de recherche
    // une seule lettre, mais un vrai nom : « X » (ex-Twitter). Complété par les mots-clés d'une lettre de recherche.json.
    var MOTS_UNE_LETTRE = { x: 1 };
    function motsDe(requete) {
      var tous = norm(requete).split(new RegExp("[^" + LETTRE + "]+")).filter(Boolean);
      var utiles = tous.filter(function (m) { return !VIDES[m] && (m.length > 1 || /\d/.test(m) || MOTS_UNE_LETTRE[m]); });
      var vus = {};
      return utiles.filter(function (m) { if (vus[m]) return false; vus[m] = 1; return true; }).slice(0, 8);
    }

    var promesses = {};
    function chargerIndex(url) {
      if (!promesses[url]) {
        promesses[url] = fetch(url, { credentials: "same-origin" })
          .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
          .then(preparerIndex);
        promesses[url].catch(function () { delete promesses[url]; }); // on pourra réessayer
      }
      return promesses[url];
    }
    function preparerIndex(x) {
      var nomsFam = {};
      (x.familles || []).forEach(function (f) { nomsFam[f[0]] = f[1]; });
      var parId = {};
      var portraits = (x.portraits || []).map(function (p) {
        (p.k || []).forEach(function (k) { var nk = norm(k); if (nk.length === 1) MOTS_UNE_LETTRE[nk] = 1; });
        var passages = [];
        if (p.a) passages.push({ type: "titre", texte: p.a });
        if (p.ac) passages.push({ type: "accroche", texte: p.ac });
        (p.c || []).forEach(function (c, i) {
          if (c[1]) passages.push({ type: "citation", texte: c[1], i: i });
          if (c[0]) passages.push({ type: "citation", texte: c[0], i: i, vo: !!c[1] });
        });
        (p.d || []).forEach(function (t, i) { if (t) passages.push({ type: "replique", texte: t, i: i }); });
        passages.forEach(function (s) { s.n = norm(s.texte); });
        var P = {
          id: p.id, nom: p.n, role: p.r, audio: !!p.au, image: p.im ? (x.pr || "") + "images/" + p.id + "-400.jpg" : null,
          chemin: (x.pr || "") + p.id + "/", brut: p,
          champs: [
            { poids: 12, n: norm(p.n) },
            { poids: 7, n: norm([p.e, p.r, p.fo].join(" · ")) },
            { poids: 4, n: norm((p.f || []).map(function (f) { return nomsFam[f] || ""; }).join(" · ")) },
            { poids: 9, n: norm((p.k || []).join(" · ")) }
          ],
          passages: passages
        };
        parId[p.id] = P;
        return P;
      });
      return { portraits: portraits, parId: parId, chapitres: x.chapitres || [] };
    }

    // { mots, res: { id: { score, extrait, nb } } } ; null si la recherche n'a aucun mot utile
    function chercher(index, requete) {
      var mots = motsDe(requete);
      if (!mots.length) return null;
      var rx = mots.map(function (m) { return regexMot(m); });
      var rxPhrase = mots.length > 1 ? new RegExp(BORD + mots.map(echapper).join("[^" + LETTRE + "]+(?:[" + LETTRE + "]{1,4}[^" + LETTRE + "]+)?")) : null;
      var res = {};
      index.portraits.forEach(function (P) {
        var parChamp = mots.map(function (m, k) {
          var best = 0;
          P.champs.forEach(function (c) { if (c.poids > best && rx[k].test(c.n)) best = c.poids; });
          return best;
        });
        var parPassage = mots.map(function () { return 0; });
        var meilleur = null, nb = 0;
        var enPhrase = !!rxPhrase && P.champs.some(function (c) { return rxPhrase.test(c.n); });
        P.passages.forEach(function (s) {
          var n = 0;
          for (var k = 0; k < mots.length; k++) if (rx[k].test(s.n)) { n++; parPassage[k]++; }
          if (!n) return;
          if (!s.vo && (s.type === "replique" || s.type === "citation")) nb++;
          var phrase = !!(rxPhrase && rxPhrase.test(s.n));
          if (phrase) enPhrase = true;
          var note = (phrase ? 20 : 0) + n * 4 + (s.type === "citation" ? 1 : s.type === "replique" ? 0.5 : 0) - (s.vo ? 0.6 : 0);
          if (!meilleur || note > meilleur.note) meilleur = { note: note, s: s, phrase: phrase, n: n };
        });
        var score = 0;
        for (var k = 0; k < mots.length; k++) {
          if (!parChamp[k] && !parPassage[k]) return; // un des mots n'est nulle part : pas ce portrait
          score += parChamp[k] + (parPassage[k] ? 1 : 0) + Math.min(parPassage[k], 8) * 0.35;
        }
        if (meilleur && meilleur.phrase) score += 8;
        res[P.id] = { score: score, extrait: meilleur, nb: nb, phrase: enPhrase };
      });
      // plusieurs mots qui se suivent quelque part (« Lisa Su », « prix Turing ») : on ne garde que les portraits où ils
      // se suivent ; sinon (« Huawei Chine »), tous ceux qui ont chacun des mots
      var ids = Object.keys(res);
      if (rxPhrase && ids.some(function (id) { return res[id].phrase; })) ids.forEach(function (id) { if (!res[id].phrase) delete res[id]; });
      return { mots: mots, res: res };
    }

    // positions [début, fin[ des mots trouvés dans un texte d'origine (le mot entier : « échec » surligne « échecs »)
    function plagesDe(texte, mots) {
      var c = normCarte(texte), plages = [];
      mots.forEach(function (m) {
        var r = regexMot(m, "g"), x;
        while ((x = r.exec(c.t))) {
          var debut = x.index + x[0].length - m.length, fin = debut + m.length;
          while (fin < c.t.length && new RegExp("[" + LETTRE + "]").test(c.t.charAt(fin))) fin++;
          plages.push([c.m[debut], c.m[fin]]);
          if (r.lastIndex <= x.index) r.lastIndex = x.index + 1;
        }
      });
      plages.sort(function (a, b) { return a[0] - b[0]; });
      var fusion = [];
      plages.forEach(function (p) {
        var der = fusion[fusion.length - 1];
        if (der && (p[0] <= der[1] || /^[ \u00a0\u202f-]{1,2}$/.test(texte.slice(der[1], p[0])))) der[1] = Math.max(der[1], p[1]); else fusion.push(p.slice());
      });
      return fusion;
    }
    // le texte, avec <mark> sur les mots trouvés ; « max » : on n'en garde qu'une fenêtre autour du premier mot trouvé
    function texteSurligne(texte, mots, max) {
      var plages = plagesDe(texte, mots);
      var debut = 0, fin = texte.length;
      if (max && texte.length > max) {
        var p0 = plages.length ? plages[0][0] : 0;
        debut = Math.max(0, p0 - Math.round(max * 0.32));
        if (debut > 0) { var esp = texte.indexOf(" ", debut); if (esp > -1 && esp < p0) debut = esp + 1; }
        fin = Math.min(texte.length, debut + max);
        if (fin < texte.length) { var esp2 = texte.lastIndexOf(" ", fin); if (esp2 > debut + max * 0.6) fin = esp2; }
      }
      var f = document.createDocumentFragment(), pos = debut;
      if (debut > 0) f.appendChild(document.createTextNode("…"));
      plages.forEach(function (p) {
        var a = Math.max(p[0], debut), b = Math.min(p[1], fin);
        if (b <= a || a < pos) return;
        if (a > pos) f.appendChild(document.createTextNode(texte.slice(pos, a)));
        var mk = document.createElement("mark");
        mk.textContent = texte.slice(a, b);
        f.appendChild(mk);
        pos = b;
      });
      if (pos < fin) f.appendChild(document.createTextNode(texte.slice(pos, fin)));
      if (fin < texte.length) f.appendChild(document.createTextNode("…"));
      return f;
    }
    // surligne les mots dans un élément déjà affiché (nœuds de texte seulement)
    function marquerDans(el, mots) {
      var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), noeuds = [], n;
      while ((n = w.nextNode())) if (!n.parentNode.closest("mark,button")) noeuds.push(n);
      var total = 0;
      noeuds.forEach(function (t) {
        if (!plagesDe(t.nodeValue, mots).length) return;
        total++;
        t.parentNode.replaceChild(texteSurligne(t.nodeValue, mots), t);
      });
      return total;
    }

    /* Orthographe proche (v6, 12/10/2026) : quand rien n'est trouvé, « Huwaei » → « Huawei », « Zuckerburg » →
       « Zuckerberg ». Le vocabulaire vient de recherche.json (noms, entreprises et rôles d'abord, puis tout le texte),
       fabriqué une seule fois, au premier échec. Un mot de 4 lettres ou plus qui n'existe nulle part (ni en entier, ni
       comme début d'un mot) est remplacé par le mot le plus proche (une faute pour 4 à 6 lettres, deux au-delà ; une
       inversion de deux lettres compte pour une ; un mot de 3 lettres, seulement vers un nom : « Lisa Sue » → « Lisa Su ») ;
       la suggestion n'est proposée que si elle trouve vraiment quelque chose. */
    var MOT_ORIGINE = /[A-Za-z0-9À-ɏ぀-鿿]+/g;
    function vocabulaire(index) {
      if (index.vocab) return index.vocab;
      var parN = {}, liste = [];
      var ajouter = function (texte, poids) {
        (String(texte || "").match(MOT_ORIGINE) || []).forEach(function (forme) {
          var n = norm(forme);
          if (VIDES[n] || n.length < 2 || (n.length < 3 && poids < 6)) return; // deux lettres : seulement les noms (« Su », « Li »)
          var x = parN[n];
          if (!x) { x = parN[n] = { n: n, forme: forme, poids: 0 }; liste.push(x); }
          x.poids += poids;
          if (poids >= 6) x.champ = true; // vient d'un nom, d'une entreprise ou d'un rôle
        });
      };
      index.portraits.forEach(function (P) { var b = P.brut; ajouter([b.n, b.e, b.r, b.fo].join(" "), 6); });
      index.portraits.forEach(function (P) { P.passages.forEach(function (s) { ajouter(s.texte, 1); }); });
      return (index.vocab = { parN: parN, liste: liste });
    }
    // distance entre deux mots (lettre ajoutée, retirée, changée, ou deux lettres inversées) ; au-delà de max : max + 1
    function distance(a, b, max) {
      var la = a.length, lb = b.length, i, j;
      if (Math.abs(la - lb) > max) return max + 1;
      var d = [];
      for (i = 0; i <= la; i++) d.push([i]);
      for (j = 1; j <= lb; j++) d[0][j] = j;
      for (i = 1; i <= la; i++) {
        var minLigne = Infinity;
        for (j = 1; j <= lb; j++) {
          var v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
          if (i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1)) v = Math.min(v, d[i - 2][j - 2] + 1);
          d[i][j] = v;
          if (v < minLigne) minLigne = v;
        }
        if (minLigne > max) return max + 1;
      }
      return d[la][lb];
    }
    // { texte, n } : la recherche corrigée et le nombre de portraits qu'elle trouve ; null s'il n'y a rien à proposer
    function suggestion(index, requete) {
      var mots = motsDe(requete);
      if (!mots.length) return null;
      var V = vocabulaire(index), formes = {}, change = false;
      (String(requete).match(MOT_ORIGINE) || []).forEach(function (f) { formes[norm(f)] = f; });
      var sortie = mots.map(function (m) {
        var garder = formes[m] || m;
        if (m.length < 3 || V.liste.some(function (x) { return x.n.indexOf(m) === 0; })) return garder;
        var max = m.length >= 7 ? 2 : 1, meilleur = null, note = Infinity;
        V.liste.forEach(function (x) {
          if (m.length === 3 && !x.champ) return; // trois lettres (« Sue ») : seulement vers un nom, une entreprise, un rôle
          var d = distance(m, x.n, max);
          // un mot en cours de frappe : proche du début d'un mot plus long (« huwae » → « huawei »)
          if (d > max && m.length >= 5 && x.n.length > m.length && distance(m, x.n.slice(0, m.length), 1) <= 1) d = 1.5;
          if (d > max && d !== 1.5) return;
          var s = d * 100 - Math.min(x.poids, 99);
          if (s < note) { note = s; meilleur = x; }
        });
        if (!meilleur) return garder;
        change = true;
        return meilleur.forme;
      });
      if (!change) {
        // tous les mots existent, mais pas ensemble (« Lisa Sue ») : un mot à une faute d'un nom, d'une entreprise ou d'un rôle
        for (var k = 0; k < mots.length; k++) {
          var m = mots[k];
          if (m.length < 3) continue;
          var proches = V.liste.filter(function (x) { return x.champ && x.n !== m && distance(m, x.n, 1) <= 1; }).sort(function (a, b) { return b.poids - a.poids; });
          for (var c = 0; c < proches.length && c < 5; c++) {
            var essai = sortie.slice();
            essai[k] = proches[c].forme;
            var r2 = chercher(index, essai.join(" "));
            var n2 = r2 ? Object.keys(r2.res).length : 0;
            if (n2) return { texte: essai.join(" "), n: n2 };
          }
        }
        return null;
      }
      var texte = sortie.join(" ");
      var r = chercher(index, texte);
      var n = r ? Object.keys(r.res).length : 0;
      return n ? { texte: texte, n: n } : null;
    }

    var VOIX_NOM = { a: "Ada", n: "Alan", l: "Lia" };
    // où le passage a été trouvé, et l'adresse qui y mène
    function lieuDe(index, P, r, requete) {
      var s = r.extrait && r.extrait.s, q = "?q=" + encodeURIComponent(requete.trim());
      if (!s) return { url: P.chemin, libelle: "" };
      if (s.type === "replique") {
        var b = P.brut, t = b.t && b.t[s.i] >= 0 ? b.t[s.i] : -1, partie = 0;
        (b.p || []).forEach(function (d, k) { if (s.i >= d) partie = k; });
        var nomPartie = index.chapitres[(b.pn && b.pn[partie] ? b.pn[partie] : partie + 1) - 1] || "";
        var temps = t >= 0 ? Math.floor(t / 60) + ":" + ("0" + (t % 60)).slice(-2) : "";
        return { url: P.chemin + q + "#replique-" + (s.i + 1), libelle: (VOIX_NOM[b.v.charAt(s.i)] || "") + (temps ? " · " + temps : "") + (nomPartie ? " · " + nomPartie : "") };
      }
      if (s.type === "citation") return { url: P.chemin + q + "#citations", libelle: s.vo ? "Citation, en version originale" : "Citation" };
      return { url: P.chemin + q, libelle: "Présentation du portrait" };
    }
    // l'extrait affiché sous un résultat
    function blocExtrait(index, P, r, requete, classe, max) {
      var lieu = lieuDe(index, P, r, requete);
      var s = r.extrait && r.extrait.s;
      var bloc = document.createElement("span");
      bloc.className = classe;
      if (s) {
        var ou = document.createElement("span");
        ou.className = "extrait-ou";
        ou.textContent = lieu.libelle;
        var txt = document.createElement("span");
        txt.className = "extrait-texte";
        txt.appendChild(texteSurligne(s.texte, r.mots || [], max));
        bloc.appendChild(ou);
        bloc.appendChild(txt);
        if (r.nb > 1) {
          var plus = document.createElement("span");
          plus.className = "extrait-plus";
          plus.textContent = r.nb - 1 > 1 ? "et " + (r.nb - 1) + " autres passages" : "et un autre passage";
          bloc.appendChild(plus);
        }
      }
      return { bloc: s ? bloc : null, url: lieu.url, libelle: lieu.libelle };
    }

    // amène un élément à l'écran d'un coup (arrivée sur la page : pas de long défilement doux depuis le haut)
    function aller(el, bloc) {
      var avant = doc.style.scrollBehavior;
      doc.style.scrollBehavior = "auto";
      el.scrollIntoView({ block: bloc || "start" });
      doc.style.scrollBehavior = avant;
    }

    // touche « / » : chercher (sauf quand on écrit déjà quelque part)
    var ouvrirRecherche = null;
    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "/" || ev.metaKey || ev.ctrlKey || ev.altKey || !ouvrirRecherche) return;
      var t = ev.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      ev.preventDefault();
      ouvrirRecherche();
    });
    $$("[data-recherche-ouvrir]").forEach(function (a) {
      a.addEventListener("click", function (ev) {
        if (!ouvrirRecherche || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
        ev.preventDefault();
        ouvrirRecherche();
      });
    });

    /* ------------------------------------------------ page de l'émission : recherche et familles sur la grille
       v6 (12/10/2026), retour d'Alexandre : « on voit assez mal les résultats ; il faut mettre en valeur le résultat
       obtenu ». Dès qu'on tape ou qu'on choisit une famille, la page passe en « mode résultats » (classe en-filtre sur
       <html>) :
       - le champ remonte juste sous la barre si les résultats ne sont pas à l'écran (défilement doux, puis il ne bouge
         plus pendant la frappe ; sur téléphone, le haut de l'écran reste visible au-dessus du clavier) ;
       - la ligne du compteur devient un grand titre doré (« 2 portraits pour « Huawei » ») avec « Effacer » ;
       - les portraits trouvés suivent juste dessous, avec un liseré doré ; pendant une recherche par mots
         (en-recherche), ils passent en liste : vignette, nom, entreprise, passage trouvé bien surligné, « Écouter » ;
       - le reste de la page (saison 1, S'abonner, le projet, la suite) est rangé jusqu'à l'effacement, et
         « Connaissez-vous… ? » s'estompe ; un lien de la barre vers une partie rangée efface d'abord la recherche ;
       - rien trouvé : orthographe proche (« Vouliez-vous dire… »), familles et exemples à la place. */
    var outils = $(".outils[data-recherche]");
    var grille = $("#grille-portraits");
    if (outils && grille) {
      var section = grille.parentNode;
      var urlIndex = outils.getAttribute("data-recherche");
      var cartes = $$(".episode-card", grille);
      var ordre = cartes.slice();
      var champ = $(".cherche-champ", outils);
      var effacer = $(".cherche-effacer", outils);
      var puces = $$(".puce[data-famille]", outils);
      var sujets = $$("[data-sujet]", outils);
      var compte = $(".compte", outils);
      var ligneCompte = $(".compte-ligne", outils);
      var toutVoirHaut = $(".tout-voir", outils);
      var aide = $(".resultats-aide", outils);
      var aucun = $(".aucun");
      var pistes = $(".aucun-pistes");
      var fin = $(".fin-resultats");
      var exemples = $(".exemples", outils);
      var listeExemples = $$("[data-exemple]", outils).map(function (b) { return b.getAttribute("data-exemple"); });
      aideCourte(champ);
      var famillesDe = {}, nomsFamilles = {}, totalFamille = {};
      cartes.forEach(function (c) { famillesDe[c.getAttribute("data-id")] = (c.getAttribute("data-familles") || "").split(" ").filter(Boolean); });
      puces.forEach(function (b) {
        var f = b.getAttribute("data-famille");
        nomsFamilles[f] = $(".puce-nom", b).textContent;
        totalFamille[f] = cartes.filter(function (c) { return famillesDe[c.getAttribute("data-id")].indexOf(f) >= 0; }).length;
      });
      var total = cartes.length;
      var boutonsVue = $$("[data-vue]", outils);
      var boutonFamilles = $(".familles-bouton", outils);
      var celebreDe = {};
      cartes.forEach(function (c) { celebreDe[c.getAttribute("data-id")] = c.getAttribute("data-celebre") === "1"; });
      // vue « Les plus célèbres » par défaut (13/10/2026) ; une recherche ou une famille cherche dans tous les portraits
      var etat = { q: "", familles: [], vue: boutonsVue.length ? "celebres" : "tous" };
      var vueActive = function () { return etat.vue === "celebres" && !motsDe(etat.q.trim()).length && !etat.familles.length; };
      var index = null, chargement = false, echec = false, resultat = null, suggere = null, premierePuce = null;
      // ce que chaque carte affiche d'origine (rendu tel quel quand la recherche s'efface)
      cartes.forEach(function (c) {
        var l = $(".lien-carte", c);
        c._lien = { href: l.getAttribute("href"), label: l.getAttribute("aria-label") };
        c._nom = $(".card-name", c).textContent;
        c._role = $(".card-role", c).textContent;
      });

      var chargerRecherche = function () {
        if (index || chargement) return;
        chargement = true;
        chargerIndex(urlIndex).then(function (x) {
          index = x; chargement = false; echec = false;
          if (etat.q) { rechercher(); amener(); }
        }, function () { chargement = false; echec = true; appliquer(); });
      };
      var rechercher = function () {
        resultat = index && etat.q ? chercher(index, etat.q) : null;
        appliquer();
      };
      var passe = function (id, sansVue) {
        if (!sansVue && vueActive() && !celebreDe[id]) return false;
        var f = famillesDe[id] || [];
        for (var i = 0; i < etat.familles.length; i++) if (f.indexOf(etat.familles[i]) < 0) return false;
        return !resultat || !!resultat.res[id];
      };
      var remplir = function (el, texte, mots) {
        el.textContent = "";
        if (mots && mots.length) el.appendChild(texteSurligne(texte, mots)); else el.textContent = texte;
      };
      var majCarte = function (c, r) {
        var id = c.getAttribute("data-id"), l = $(".lien-carte", c), ancien = $(".card-extrait", c);
        if (ancien) ancien.parentNode.removeChild(ancien);
        c.classList.toggle("avec-extrait", false);
        var mots = r && resultat ? resultat.mots : null;
        remplir($(".card-name", c), c._nom, mots);
        remplir($(".card-role", c), c._role, mots);
        if (!r || !index) { l.setAttribute("href", c._lien.href); l.setAttribute("aria-label", c._lien.label); return; }
        var P = index.parId[id];
        r.mots = resultat.mots;
        var ex = blocExtrait(index, P, r, etat.q, "card-extrait", 180);
        l.setAttribute("href", ex.url);
        l.setAttribute("aria-label", c._nom + (ex.bloc ? " : passage trouvé" + (ex.libelle ? " (" + ex.libelle + ")" : "") : ""));
        if (ex.bloc) {
          ex.bloc.setAttribute("aria-hidden", "true");
          $(".card-inner", c).insertBefore(ex.bloc, $(".card-footer", c));
          c.classList.add("avec-extrait");
        }
      };
      var guillemets = function (q) { return "« " + q.trim() + " »"; };
      var ajouterTexte = function (el, t) { el.appendChild(document.createTextNode(t)); };
      var morceau = function (classe, t) { var s = document.createElement("span"); s.className = classe; s.textContent = t; return s; };
      var nombre = function (el, n) { var f = document.createElement("strong"); f.textContent = String(n); el.appendChild(f); };

      var appliquer = function () {
        var q = etat.q.trim();
        var qUtile = motsDe(q).length > 0;
        var attente = qUtile && !index && !echec; // l'index arrive : on n'affiche pas encore tous les portraits
        var res = resultat && resultat.res;
        var filtre = !!(etat.familles.length || qUtile);
        var n = 0;
        cartes.forEach(function (c) {
          var id = c.getAttribute("data-id"), ok = !attente && passe(id);
          c.hidden = !ok;
          if (ok) n++;
          if (filtre) c.classList.add("visible");
          majCarte(c, ok && res ? res[id] : null);
        });
        var liste = ordre.slice();
        if (res) liste.sort(function (a, b) {
          var ra = res[a.getAttribute("data-id")], rb = res[b.getAttribute("data-id")];
          return (rb ? rb.score : -1) - (ra ? ra.score : -1) || ordre.indexOf(a) - ordre.indexOf(b);
        });
        var pareil = true, actuels = $$(".episode-card", grille);
        for (var i = 0; i < liste.length; i++) if (actuels[i] !== liste[i]) { pareil = false; break; }
        if (!pareil) liste.forEach(function (c) { grille.appendChild(c); });
        // chaque puce dit combien de portraits on verrait en l'ajoutant (0 : elle s'éteint)
        puces.forEach(function (b) {
          var f = b.getAttribute("data-famille"), on = etat.familles.indexOf(f) >= 0;
          var k = on ? n : cartes.filter(function (c) { var id = c.getAttribute("data-id"); return famillesDe[id].indexOf(f) >= 0 && passe(id, true); }).length;
          b.setAttribute("aria-pressed", on ? "true" : "false");
          b.classList.toggle("vide", !on && k === 0);
          b.disabled = !on && k === 0;
          var pn = $(".puce-n", b);
          pn.textContent = String(k);
          pn.setAttribute("aria-label", k + (k > 1 ? " portraits" : " portrait"));
        });
        // le titre des résultats (lu par les lecteurs d'écran : role="status")
        suggere = !attente && filtre && n === 0 && qUtile && index ? suggestion(index, q) : null;
        compte.textContent = "";
        if (attente) ajouterTexte(compte, "Recherche…");
        else if (qUtile && echec) ajouterTexte(compte, "La recherche n'a pas pu se charger. Vérifiez la connexion, puis réessayez.");
        else if (!filtre) {
          nombre(compte, n);
          ajouterTexte(compte, " portrait" + (n > 1 ? "s" : "") + (vueActive() ? " parmi les plus célèbres" : "") + (q ? " · tapez au moins deux lettres" : ""));
        } else {
          if (n) { nombre(compte, n); ajouterTexte(compte, " portrait" + (n > 1 ? "s" : "")); }
          else ajouterTexte(compte, "Aucun portrait");
          if (qUtile && resultat) { ajouterTexte(compte, " pour "); compte.appendChild(morceau("compte-q", guillemets(q))); }
          if (etat.familles.length) {
            ajouterTexte(compte, " dans ");
            etat.familles.forEach(function (f, k) {
              if (k) ajouterTexte(compte, " + ");
              compte.appendChild(morceau("compte-f", guillemets(nomsFamilles[f])));
            });
          }
          if (suggere) compte.appendChild(morceau("visuellement-cache", ". Vouliez-vous dire : " + suggere.texte + " ?"));
        }
        boutonsVue.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-vue") === etat.vue ? "true" : "false"); });
        if (etat.familles.length) outils.classList.add("familles-ouvertes");
        if (boutonFamilles) boutonFamilles.setAttribute("aria-expanded", outils.classList.contains("familles-ouvertes") ? "true" : "false");
        doc.classList.toggle("en-filtre", filtre);
        doc.classList.toggle("en-recherche", filtre && qUtile && !!resultat && n > 0);
        outils.classList.toggle("filtre", filtre);
        toutVoirHaut.hidden = !filtre;
        if (exemples) exemples.hidden = filtre;
        if (aide) aide.hidden = !(qUtile && resultat && n > 0);
        effacer.hidden = !champ.value;
        aucun.hidden = !(filtre && n === 0 && !attente && !(qUtile && echec));
        if (!aucun.hidden) remplirPistes(q, qUtile);
        if (fin) fin.hidden = !(filtre && n > 0);
        // téléphone : les familles défilent de côté ; pendant une recherche, on amène en vue la première qui a des résultats
        // (et on revient au début quand on efface), seulement quand elle change
        var rang = $(".puces", outils);
        if (rang && rang.scrollWidth > rang.clientWidth + 4 && !etat.familles.length) {
          var premiere = qUtile && !attente ? puces.filter(function (b) { return !b.disabled; })[0] || null : null;
          if (premiere !== premierePuce) {
            premierePuce = premiere;
            var gauche = premiere ? rang.scrollLeft + premiere.getBoundingClientRect().left - rang.getBoundingClientRect().left - 20 : 0;
            try { rang.scrollTo({ left: Math.max(0, gauche), behavior: calme ? "auto" : "smooth" }); } catch (e) { rang.scrollLeft = Math.max(0, gauche); }
          }
        }
        // assez de place sous le champ pour toujours pouvoir l'amener sous la barre, même avec un seul résultat
        if (filtre) section.style.setProperty("--avant-outils", Math.max(0, Math.round(outils.getBoundingClientRect().top - section.getBoundingClientRect().top)) + "px");
        // les pastilles « Sujets » : celle qu'on a cliquée reste allumée tant que c'est la recherche en cours
        sujets.forEach(function (b) { b.setAttribute("aria-pressed", norm(b.getAttribute("data-sujet")) === norm(q) ? "true" : "false"); });
        try { document.dispatchEvent(new CustomEvent("vdia-resultats")); } catch (e) {} // « Tout ajouter » (Ma playlist)
      };

      // rien trouvé : des pistes (orthographe proche, hors des familles choisies, familles, exemples)
      var remplirPistes = function (q, qUtile) {
        pistes.textContent = "";
        var ligne = function (classe) { var p = document.createElement("p"); p.className = "aucun-ligne " + classe; pistes.appendChild(p); return p; };
        var bouton = function (classe, contenu, action) {
          var b = document.createElement("button");
          b.type = "button";
          if (classe) b.className = classe;
          if (typeof contenu === "string") b.textContent = contenu; else b.appendChild(contenu);
          b.addEventListener("click", action);
          return b;
        };
        if (suggere) {
          var corrige = suggere.texte, l1 = ligne("aucun-orthographe");
          ajouterTexte(l1, "Vouliez-vous dire ");
          l1.appendChild(bouton("aucun-mot", corrige, function () { chercherTexte(corrige); }));
          ajouterTexte(l1, " ?");
        }
        if (qUtile && resultat && etat.familles.length) {
          var k = Object.keys(resultat.res).length;
          if (k) {
            var l2 = ligne("aucun-hors");
            ajouterTexte(l2, "Hors des familles choisies, " + guillemets(q) + " donne " + k + " portrait" + (k > 1 ? "s" : "") + ". ");
            l2.appendChild(bouton("aucun-lien", "Chercher dans tous les portraits", function () { etat.familles = []; appliquer(); ecrireAdresse(); amener(); }));
          }
        }
        if (!qUtile && etat.familles.length > 1) ajouterTexte(ligne("aucun-hors"), "Aucun portrait n'est dans toutes ces familles à la fois : retirez-en une.");
        if (qUtile) {
          var l3 = ligne("aucun-familles");
          l3.appendChild(morceau("aucun-libelle", suggere ? "Ou parcourez une famille :" : "Parcourez plutôt une famille :"));
          puces.map(function (b) { return b.getAttribute("data-famille"); }).filter(function (f) { return totalFamille[f] > 0; }).slice(0, 6).forEach(function (f) {
            var contenu = document.createDocumentFragment();
            contenu.appendChild(morceau("puce-nom", nomsFamilles[f]));
            ajouterTexte(contenu, " ");
            contenu.appendChild(morceau("puce-n", String(totalFamille[f])));
            var b = bouton("puce", contenu, function () {
              champ.value = ""; etat.q = ""; resultat = null; etat.familles = [f];
              appliquer(); ecrireAdresse(); amener(); montrerPuces();
            });
            b.setAttribute("aria-label", nomsFamilles[f] + ", " + totalFamille[f] + " portraits");
            l3.appendChild(b);
          });
        }
        if (listeExemples.length) {
          var l4 = ligne("aucun-exemples");
          ajouterTexte(l4, qUtile ? "Ou essayez : " : "Essayez : ");
          listeExemples.forEach(function (x, k) {
            if (k) ajouterTexte(l4, ", ");
            l4.appendChild(bouton("", x, function () { chercherTexte(x); }));
          });
        }
      };

      // amène le champ juste sous la barre du haut, seulement si le titre des résultats n'est pas déjà dans le haut de
      // l'écran (sur téléphone, la partie au-dessus du clavier : visualViewport)
      var sousLaBarre = function () { var b = $(".barre"); return (b ? b.getBoundingClientRect().bottom : 0) + 10; };
      var dernierDefilement = 0;
      var defiler = function (dy, doux) {
        if (Math.abs(dy) < 3) return;
        dernierDefilement = Date.now();
        if (doux && !calme) { window.scrollBy({ top: dy, behavior: "smooth" }); return; }
        var avant = doc.style.scrollBehavior;
        doc.style.scrollBehavior = "auto";
        window.scrollBy(0, dy);
        doc.style.scrollBehavior = avant;
      };
      // pendant un défilement doux déjà lancé, on revérifie juste après (la page a pu changer de hauteur entre-temps),
      // sauf si la personne fait défiler elle-même
      var minuteurAmener = null;
      ["wheel", "touchstart"].forEach(function (e) { window.addEventListener(e, function () { clearTimeout(minuteurAmener); }, { passive: true }); });
      var amener = function () {
        if (!doc.classList.contains("en-filtre")) return;
        var reste = 700 - (Date.now() - dernierDefilement);
        clearTimeout(minuteurAmener);
        if (reste > 0) { minuteurAmener = setTimeout(amener, reste + 40); return; }
        var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        var haut = outils.getBoundingClientRect().top, cible = sousLaBarre();
        if (haut >= cible - 6 && ligneCompte.getBoundingClientRect().bottom <= vh * 0.62) return; // déjà en vue
        defiler(haut - cible, true);
      };

      // l'adresse garde l'état (#famille=chine,robots&q=huawei) : on peut la partager
      var minuteurAdresse = null;
      var ecrireAdresse = function () {
        clearTimeout(minuteurAdresse);
        minuteurAdresse = setTimeout(function () {
          var h = [];
          if (etat.familles.length) h.push("famille=" + etat.familles.map(encodeURIComponent).join(","));
          if (etat.q.trim()) h.push("q=" + encodeURIComponent(etat.q.trim()));
          if (boutonsVue.length && etat.vue === "tous") h.push("vue=tous");
          // une autre ancre (#abonnement, après un clic dans la barre) : on n'y touche pas
          if (!h.length && location.hash && !/[#&](famille|q|vue)=/.test(location.hash)) return;
          var cible = h.length ? "#" + h.join("&") : location.pathname + location.search;
          if ((h.length ? "#" + h.join("&") : "") === location.hash) return;
          try { history.replaceState(null, "", cible); } catch (e) {}
        }, 350);
      };
      var lireAdresse = function () {
        var h = location.hash, mf = /[#&]famille=([^&]*)/.exec(h), mq = /[#&]q=([^&]*)/.exec(h), mv = /[#&]vue=tous/.test(h);
        if (!mf && !mq && !mv) return false;
        if (boutonsVue.length) etat.vue = mv ? "tous" : "celebres";
        var dec = function (s) { try { return decodeURIComponent(s.replace(/\+/g, " ")); } catch (e) { return ""; } };
        etat.familles = mf ? dec(mf[1]).split(",").filter(function (f) { return nomsFamilles[f]; }) : [];
        etat.q = mq ? dec(mq[1]).slice(0, 80) : "";
        champ.value = etat.q;
        if (etat.q) chargerRecherche();
        rechercher();
        return true;
      };

      var chercherTexte = function (t) {
        champ.value = t; etat.q = t;
        chargerRecherche();
        rechercher();
        ecrireAdresse();
        amener();
      };
      var minuteur = null;
      // « input » à chaque lettre ; « change » et « search » aussi (saisie dictée, remplissage automatique, croix du champ)
      var surSaisie = function () {
        if (champ.value === etat.q && (resultat || !champ.value)) return;
        etat.q = champ.value;
        effacer.hidden = !champ.value;
        chargerRecherche();
        clearTimeout(minuteur);
        minuteur = setTimeout(function () { rechercher(); amener(); }, index ? 90 : 0);
        ecrireAdresse();
      };
      ["input", "change", "search"].forEach(function (e) { champ.addEventListener(e, surSaisie); });
      ["focus", "pointerenter"].forEach(function (e) { champ.addEventListener(e, chargerRecherche); });
      // sur téléphone, le clavier cache la moitié de l'écran : le champ remonte sous la barre, les résultats juste dessous
      champ.addEventListener("focus", function () {
        if (window.innerWidth < 700 && outils.getBoundingClientRect().top > window.innerHeight * 0.3) {
          setTimeout(function () { defiler(outils.getBoundingClientRect().top - sousLaBarre(), true); }, 250);
        }
      });
      champ.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && (champ.value || etat.familles.length)) { ev.preventDefault(); vider(!!champ.value); }
        if (ev.key === "Enter") {
          ev.preventDefault();
          clearTimeout(minuteur);
          rechercher();
          amener();
          if (window.matchMedia("(pointer:coarse)").matches) champ.blur(); // range le clavier : on voit les résultats
        }
      });
      // Échap ailleurs dans les résultats (une puce, une carte) : tout effacer et revenir au champ
      [outils, grille, aucun, fin].forEach(function (zone) {
        if (zone) zone.addEventListener("keydown", function (ev) {
          if (ev.key !== "Escape" || ev.target === champ || !doc.classList.contains("en-filtre")) return;
          ev.preventDefault();
          vider(false);
          try { champ.focus({ preventScroll: true }); } catch (e) { champ.focus(); }
          defiler(outils.getBoundingClientRect().top - sousLaBarre(), true);
        });
      });
      var vider = function (garderFamilles) {
        champ.value = ""; etat.q = "";
        if (!garderFamilles) etat.familles = [];
        resultat = null;
        appliquer();
        ecrireAdresse();
      };
      effacer.addEventListener("click", function () { vider(true); champ.focus(); });
      $$(".tout-voir").forEach(function (b) {
        b.addEventListener("click", function () {
          var dehors = !outils.contains(b);
          vider(false);
          // depuis le bas des résultats : on revient au champ, au-dessus de tous les portraits
          if (dehors) defiler(outils.getBoundingClientRect().top - sousLaBarre(), true);
          if (!window.matchMedia("(pointer:coarse)").matches) try { champ.focus({ preventScroll: true }); } catch (e) { champ.focus(); }
        });
      });
      boutonsVue.forEach(function (b) {
        b.addEventListener("click", function () { etat.vue = b.getAttribute("data-vue"); appliquer(); ecrireAdresse(); });
      });
      if (boutonFamilles) boutonFamilles.addEventListener("click", function () {
        outils.classList.toggle("familles-ouvertes");
        boutonFamilles.setAttribute("aria-expanded", outils.classList.contains("familles-ouvertes") ? "true" : "false");
      });
      puces.forEach(function (b) {
        b.addEventListener("click", function () {
          var f = b.getAttribute("data-famille"), i = etat.familles.indexOf(f);
          if (i >= 0) etat.familles.splice(i, 1); else etat.familles.push(f);
          appliquer();
          ecrireAdresse();
          amener();
        });
      });
      $$("[data-exemple]", outils).forEach(function (b) {
        b.addEventListener("click", function () { chercherTexte(b.getAttribute("data-exemple")); });
      });
      // Sujets (playlists, 16/10/2026) : un clic cherche ce mot ; un second clic l'efface
      sujets.forEach(function (b) {
        b.addEventListener("click", function () {
          if (b.getAttribute("aria-pressed") === "true") { vider(true); return; }
          chercherTexte(b.getAttribute("data-sujet"));
        });
      });
      // un lien vers une partie rangée pendant la recherche (« Saison 1 », « S'abonner »…) : on efface d'abord, pour
      // qu'elle réapparaisse et que le navigateur puisse y aller
      document.addEventListener("click", function (ev) {
        if (!doc.classList.contains("en-filtre") || !ev.target.closest) return;
        var a = ev.target.closest("a[href^='#']"), el = null;
        if (a) try { el = document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1))); } catch (e) {}
        if (el && !el.getClientRects().length) vider(false);
      }, true);
      // sur téléphone, les puces défilent de côté : on amène la première famille choisie en vue
      var montrerPuces = function () {
        var rang = $(".puces", outils), on = $(".puce[aria-pressed=\"true\"]", outils);
        if (on && rang.scrollWidth > rang.clientWidth) rang.scrollLeft += on.getBoundingClientRect().left - rang.getBoundingClientRect().left - 20;
      };
      // (scrollIntoView ajouterait la marge de défilement de la page à celle du bloc : le champ resterait 150 px plus bas)
      var arriver = function () { defiler(outils.getBoundingClientRect().top - sousLaBarre(), false); montrerPuces(); };
      window.addEventListener("hashchange", function () { if (lireAdresse()) arriver(); });
      ouvrirRecherche = function () {
        try { champ.focus({ preventScroll: true }); } catch (e) { champ.focus(); }
        defiler(outils.getBoundingClientRect().top - sousLaBarre(), true); // après le focus, qui couperait le défilement
        chargerRecherche();
      };
      // arrivée avec un état dans l'adresse (lien partagé) : on l'applique et on amène le champ sous la barre, puis on
      // recale quand les polices, les images et l'index sont là (ils font bouger ce qui est au-dessus), sauf si la
      // personne a déjà fait défiler la page
      if (lireAdresse()) {
        var aBougeArrivee = false;
        ["wheel", "touchstart", "keydown"].forEach(function (e) { window.addEventListener(e, function () { aBougeArrivee = true; }, { once: true, passive: true }); });
        var placer = function () { if (!aBougeArrivee) arriver(); };
        setTimeout(placer, 30);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(placer, 60); });
        window.addEventListener("load", function () { setTimeout(placer, 60); });
        if (etat.q) chargerIndex(urlIndex).then(function () { setTimeout(placer, 60); }, function () {});
      } else if (boutonsVue.length) appliquer(); // vue « Les plus célèbres » dès l'arrivée
    }

    /* ------------------------------------------------ pages des portraits : la recherche dans une fenêtre */
    var fenetre = $(".recherche-fenetre");
    if (fenetre && typeof fenetre.showModal === "function") {
      var rfUrl = fenetre.getAttribute("data-recherche");
      var rfChamp = $(".cherche-champ", fenetre);
      var rfEffacer = $(".cherche-effacer", fenetre);
      var rfEtat = $(".rf-etat", fenetre);
      var rfListe = $(".rf-resultats", fenetre);
      var rfAide = Array.prototype.slice.call(rfEtat.childNodes).map(function (n) { return n.cloneNode(true); });
      var rfIndex = null, rfMinuteur = null;
      var rfAfficher = function () {
        var q = rfChamp.value;
        rfEffacer.hidden = !q;
        rfListe.textContent = "";
        rfEtat.textContent = "";
        if (!q.trim()) { rfAide.forEach(function (n) { rfEtat.appendChild(n.cloneNode(true)); }); lierExemples(); return; }
        if (!rfIndex) { rfEtat.textContent = "Recherche…"; return; }
        var r = chercher(rfIndex, q);
        if (!r) { rfEtat.textContent = "Tapez au moins deux lettres."; return; }
        var ids = Object.keys(r.res).sort(function (a, b) { return r.res[b].score - r.res[a].score; });
        rfEtat.textContent = ids.length ? ids.length + (ids.length > 1 ? " portraits trouvés" : " portrait trouvé") + " pour \u00ab\u00a0" + q.trim() + "\u00a0\u00bb" : "Aucun portrait ne correspond à \u00ab\u00a0" + q.trim() + "\u00a0\u00bb.";
        var corrige = ids.length ? null : suggestion(rfIndex, q); // orthographe proche (v6)
        if (corrige) {
          var bc = document.createElement("button");
          bc.type = "button";
          bc.textContent = corrige.texte;
          bc.addEventListener("click", function () { rfChamp.value = corrige.texte; rfAfficher(); rfChamp.focus(); });
          rfEtat.appendChild(document.createTextNode(" Vouliez-vous dire "));
          rfEtat.appendChild(bc);
          rfEtat.appendChild(document.createTextNode(" ?"));
        }
        ids.slice(0, 40).forEach(function (id) {
          var P = rfIndex.parId[id], res = r.res[id];
          res.mots = r.mots;
          var ex = blocExtrait(rfIndex, P, res, q, "rf-extrait", 170);
          var li = document.createElement("li"), a = document.createElement("a");
          a.href = ex.url;
          var vi = document.createElement("span");
          vi.className = "rf-vignette";
          if (P.image) { var im = document.createElement("img"); im.src = P.image; im.alt = ""; im.width = 56; im.height = 56; im.loading = "lazy"; vi.appendChild(im); }
          else vi.textContent = P.nom.split(/\s+/).map(function (m) { return m.charAt(0); }).join("").slice(0, 2);
          var tx = document.createElement("span");
          tx.className = "rf-texte";
          var nm = document.createElement("strong");
          nm.appendChild(texteSurligne(P.nom, r.mots));
          var ro = document.createElement("span");
          ro.className = "rf-role";
          ro.appendChild(texteSurligne(P.role + (P.audio ? "" : " · audio bientôt"), r.mots));
          tx.appendChild(nm); tx.appendChild(ro);
          if (ex.bloc) tx.appendChild(ex.bloc);
          a.appendChild(vi); a.appendChild(tx);
          li.appendChild(a);
          rfListe.appendChild(li);
        });
      };
      var lierExemples = function () {
        $$("[data-exemple]", rfEtat).forEach(function (b) {
          b.addEventListener("click", function () { rfChamp.value = b.getAttribute("data-exemple"); rfAfficher(); rfChamp.focus(); });
        });
      };
      lierExemples();
      var rfCharger = function () {
        chargerIndex(rfUrl).then(function (x) { rfIndex = x; rfAfficher(); }, function () { rfEtat.textContent = "La recherche n'a pas pu se charger. Vérifiez la connexion, puis réessayez."; });
      };
      ["input", "change", "search"].forEach(function (e) {
        rfChamp.addEventListener(e, function () {
          clearTimeout(rfMinuteur);
          rfMinuteur = setTimeout(rfAfficher, rfIndex ? 90 : 0);
          if (!rfIndex) rfCharger();
        });
      });
      rfChamp.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") {
          ev.preventDefault();
          clearTimeout(rfMinuteur);
          rfAfficher();
          var a = $(".rf-resultats a", fenetre);
          if (a) location.href = a.href;
        }
        if (ev.key === "ArrowDown") { var b = $(".rf-resultats a", fenetre); if (b) { ev.preventDefault(); b.focus(); } }
      });
      rfListe.addEventListener("keydown", function (ev) {
        if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
        var liens = $$("a", rfListe), i = liens.indexOf(document.activeElement);
        if (i < 0) return;
        ev.preventDefault();
        if (ev.key === "ArrowDown" && liens[i + 1]) liens[i + 1].focus();
        if (ev.key === "ArrowUp") (liens[i - 1] || rfChamp).focus();
      });
      rfEffacer.addEventListener("click", function () { rfChamp.value = ""; rfAfficher(); rfChamp.focus(); });
      $(".rf-fermer", fenetre).addEventListener("click", function () { fenetre.close(); });
      fenetre.addEventListener("click", function (ev) { if (ev.target === fenetre) fenetre.close(); }); // clic à côté
      fenetre.addEventListener("close", function () { doc.classList.remove("fenetre-ouverte"); });
      ouvrirRecherche = function () {
        if (fenetre.open) { rfChamp.focus(); return; }
        fenetre.showModal();
        aideCourte(rfChamp);
        doc.classList.add("fenetre-ouverte");
        rfChamp.focus();
        rfChamp.select();
        if (!rfIndex) rfCharger();
      };
    }

    /* ------------------------------------------------ page d'un portrait : arrivée depuis une recherche
       ?q=… surligne les mots dans la conversation, les citations et l'accroche ; #replique-N éclaire la réplique
       trouvée et la place au milieu de l'écran (sous la barre et le mini-lecteur). */
    var conversationPage = $(".conversation");
    if (conversationPage) {
      var qArrivee = "";
      try { qArrivee = (new URLSearchParams(location.search).get("q") || "").slice(0, 80); } catch (e) {}
      var motsArrivee = qArrivee ? motsDe(qArrivee) : [];
      if (motsArrivee.length) $$(".conversation .bulle, .citation blockquote, .citation .trad, .portrait-texte .accroche, .portrait-texte .angle").forEach(function (el) { marquerDans(el, motsArrivee); });
      var mr = /^#replique-(\d+)$/.exec(location.hash);
      var trouvee = mr && document.getElementById("replique-" + mr[1]);
      if (trouvee) {
        trouvee.classList.add("trouvee", "visible");
        var aBouge = false;
        ["wheel", "touchstart", "keydown"].forEach(function (e) { window.addEventListener(e, function () { aBouge = true; }, { once: true, passive: true }); });
        var centrer = function () { if (!aBouge) aller(trouvee, "center"); };
        setTimeout(centrer, 60);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(centrer, 60); });
      }
    }

    /* ------------------------------------------------ « Connaissez-vous… ? » : un portrait au hasard à chaque visite
       Jamais le même deux fois de suite : les derniers montrés sont notés dans ce navigateur (localStorage, s'il est
       permis ; sinon, on tire simplement au hasard). */
    var cv = $("[data-connaissez]"), cvDonnees = $("#donnees-connaissez");
    if (cv && cvDonnees) {
      var cvListe = [];
      try { cvListe = JSON.parse(cvDonnees.textContent) || []; } catch (e) {}
      var CLE_CV = "voix-de-lia.connaissez";
      var lireVus = function () { try { var v = JSON.parse(localStorage.getItem(CLE_CV) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
      var noterVu = function (id) {
        try { var v = lireVus().filter(function (x) { return x !== id; }); v.unshift(id); localStorage.setItem(CLE_CV, JSON.stringify(v.slice(0, Math.min(8, Math.max(1, cvListe.length - 2))))); } catch (e) {}
      };
      var tirer = function (exclus) {
        var possibles = cvListe.filter(function (x) { return exclus.indexOf(x.id) < 0; });
        if (!possibles.length) possibles = cvListe.filter(function (x) { return x.id !== exclus[0]; });
        if (!possibles.length) possibles = cvListe;
        return possibles[Math.floor(Math.random() * possibles.length)];
      };
      var finesJs = function (t) { return t.replace(/ ([!?;])/g, "\u202f$1").replace(/ :/g, "\u00a0:"); };
      var cvCourant = null;
      var cvAfficher = function (x, annoncer) {
        cvCourant = x;
        var vig = $(".cv-vignette", cv);
        vig.href = x.chemin;
        vig.textContent = "";
        if (x.image) {
          var pic = document.createElement("picture");
          if (x.webp) { var so = document.createElement("source"); so.type = "image/webp"; so.srcset = x.image + "-400.webp"; pic.appendChild(so); }
          var im = document.createElement("img"); im.src = x.image + "-400.jpg"; im.alt = ""; im.width = 400; im.height = 400; im.decoding = "async";
          pic.appendChild(im);
          vig.appendChild(pic);
        } else {
          var ini = document.createElement("span"); ini.className = "cv-initiales"; ini.textContent = x.initiales; vig.appendChild(ini);
        }
        var lien = $(".cv-nom a", cv);
        lien.href = x.chemin;
        lien.textContent = x.nom;
        $(".cv-role", cv).textContent = x.role;
        var ph = x.phrases[Math.floor(Math.random() * x.phrases.length)];
        var bq = $(".cv-phrase", cv);
        bq.textContent = "";
        var p = document.createElement("p");
        p.textContent = ph.s ? "\u00ab\u00a0" + finesJs(ph.t) + "\u00a0\u00bb" : finesJs(ph.t);
        bq.appendChild(p);
        if (ph.s) { var src = document.createElement("p"); src.className = "cv-source"; src.textContent = x.nom + ", " + ph.s + (ph.tr ? " · notre traduction" : ""); bq.appendChild(src); }
        var ec = $(".cv-ecouter", cv);
        ec.setAttribute("data-jouer", x.id);
        ec.href = x.chemin;
        ec.setAttribute("aria-label", "Écouter le portrait " + (/^[aeiouyàâéèêîôûœ]/i.test(x.nom) ? "d'" : "de ") + x.nom + " (" + x.duree + ")");
        $(".cv-duree", cv).textContent = x.duree;
        if (annoncer) $(".cv-annonce", cv).textContent = "Connaissez-vous " + x.nom + " ? " + x.role + ".";
        cv.classList.remove("change");
        void cv.offsetWidth; // relance l'animation d'apparition
        cv.classList.add("change", "pret");
        noterVu(x.id);
        majBoutonsJouer();
      };
      if (cvListe.length) {
        cvAfficher(tirer(lireVus()), false);
        var cvAutre = $(".cv-autre", cv);
        if (cvListe.length > 1 && cvAutre) {
          cvAutre.hidden = false;
          cvAutre.addEventListener("click", function () {
            var vus = lireVus();
            if (vus[0] !== cvCourant.id) vus.unshift(cvCourant.id);
            cvAfficher(tirer(vus), true);
          });
        }
      } else cv.classList.add("pret");
    }
  })();

  /* ------------------------------------------------ le quiz (16/10/2026)
     Un quiz par portrait (#donnees-quiz : ouvert par-dessus la page, proposé quand l'écoute arrive à la fin) et le
     grand quiz (page quiz/, quiz.json) qui pioche sans fin dans tous les portraits. Les questions viennent uniquement
     des épisodes (site/quiz.mjs) ; après chaque réponse : l'explication, le passage mot pour mot, et « Réécouter ».
     Scores, série et questions déjà vues restent dans ce navigateur (localStorage), nulle part ailleurs. */
  (function () {
    var lireLS = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
    var ecrireLS = function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} };
    var lireJsonLS = function (k, defaut) { try { return JSON.parse(lireLS(k)) || defaut; } catch (e) { return defaut; } };
    var melanger = function (t) { t = t.slice(); for (var i = t.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), x = t[i]; t[i] = t[j]; t[j] = x; } return t; };
    var el = function (tag, classe, texte) { var n = document.createElement(tag); if (classe) n.className = classe; if (texte != null) n.textContent = texte; return n; };
    var fin = function (t) { return String(t).replace(/ ([!?;])/g, " $1").replace(/ :/g, " :").replace(/« /g, "« ").replace(/ »/g, " »"); };
    var mmss = function (t) { t = Math.max(0, Math.floor(t)); return Math.floor(t / 60) + ":" + (t % 60 < 10 ? "0" : "") + (t % 60); };
    var VOIX = { ada: "Ada", alan: "Alan", lia: "Lia" };
    var LETTRES = ["A", "B", "C", "D"];
    var ICONE_ECOUTE = '<svg class="i-lecture" viewBox="0 0 24 24" aria-hidden="true"><polygon points="6,4 19,12 6,20"/></svg><svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
    var FLECHE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

    /* le passage à réécouter : sur la page du portrait, le lecteur de l'épisode ; sur le grand quiz, un lecteur à
       part, jamais visible. La lecture s'arrête au début de la réplique suivante (tf). */
    var passage = { audio: null, fin: null, bouton: null };
    var etiquette = function (b, joue) { b.classList.toggle("joue", joue); $(".qz-ecoute-txt", b).textContent = joue ? "Pause" : b.getAttribute("data-libelle") || "Réécouter ce passage"; };
    function ecouterPassage(bouton, audio, t, tf) {
      if (passage.bouton === bouton && !audio.paused) { audio.pause(); return; }
      if (passage.bouton && passage.bouton !== bouton) etiquette(passage.bouton, false);
      if (passage.audio && passage.audio !== audio) passage.audio.pause();
      if (lecteurVoix && lecteurVoix !== audio) lecteurVoix.pause();
      var episode = $(".lecteur[data-audio] audio");
      if (episode && episode !== audio && !episode.paused) episode.pause();
      passage.audio = audio; passage.fin = tf; passage.bouton = bouton;
      if (!audio.quizRelie) {
        audio.quizRelie = true;
        audio.addEventListener("timeupdate", function () {
          if (passage.audio === audio && passage.fin && audio.currentTime >= passage.fin + 0.2) { passage.fin = null; audio.pause(); }
        });
        ["play", "pause", "ended"].forEach(function (e) {
          audio.addEventListener(e, function () { if (passage.audio === audio && passage.bouton) etiquette(passage.bouton, !audio.paused && !audio.ended); });
        });
      }
      var aller = function () { audio.currentTime = Math.max(0, t - 0.2); };
      if (audio.readyState >= 1) aller(); else audio.addEventListener("loadedmetadata", aller, { once: true });
      audio.play().catch(function () {});
      etiquette(bouton, true);
    }
    function couperPassage() {
      if (passage.audio && passage.bouton && !passage.audio.paused) passage.audio.pause();
      if (lecteurVoix && !lecteurVoix.paused) lecteurVoix.pause();
      passage.bouton = null; passage.fin = null;
    }
    var lecteurAPart = null;
    // les voix du quiz (16/10/2026) : l'ouverture d'Alexandre et la réponse dite par Ada, Alan ou Lia ; jouées
    // d'elles-mêmes (après un clic, donc permis par les navigateurs) sauf si on les a coupées (gardé dans ce navigateur)
    var lecteurVoix = null;
    var voixActives = function () { return lireLS("quiz-voix") !== "non"; };
    function audioVoix(src) {
      if (!lecteurVoix) { lecteurVoix = new Audio(); lecteurVoix.preload = "auto"; }
      if (lecteurVoix.getAttribute("data-src") !== src) { lecteurVoix.src = src; lecteurVoix.setAttribute("data-src", src); }
      return lecteurVoix;
    }
    var PRENOM = { ada: "Ada", alan: "Alan", lia: "Lia" };
    function audioDe(src) {
      if (!src) return $(".lecteur[data-audio] audio");
      if (!lecteurAPart) { lecteurAPart = new Audio(); lecteurAPart.preload = "none"; }
      if (lecteurAPart.getAttribute("data-src") !== src) { lecteurAPart.src = src; lecteurAPart.setAttribute("data-src", src); }
      return lecteurAPart;
    }

    function vignette(p, classe) {
      var v = el("span", classe);
      if (p.i) { var img = el("img"); img.src = p.i + "-400.jpg"; img.alt = ""; img.width = 44; img.height = 44; img.decoding = "async"; v.appendChild(img); }
      else v.textContent = p.in || "";
      v.setAttribute("aria-hidden", "true");
      return v;
    }

    /* Le moteur, commun aux deux quiz. o.mode : « portrait » (une série de questions, puis le score) ou « grand »
       (sans fin). o.portraitDe(q) : le portrait d'une question (grand quiz). o.surPage : le passage se lit dans la
       page même (lien #replique-N, lecteur de la page). */
    function monterQuiz(scene, o) {
      var liste = [], i = 0, bonnes = 0, ratees = [], courante = null, repondu = false;
      // grand quiz : un mode (« Tout le podcast », « Ils gagnent à être connus », « Difficile ») = une réserve de
      // questions, avec sa série, son record et ses questions déjà vues ; « Tout le podcast » garde les anciennes clés
      var modeCourant = null, pool = o.questions, nbPortraitsPool = o.nbPortraits, cleGq = "quiz-grand", cleVues = "quiz-grand-vues";
      var gq = lireJsonLS(cleGq, { repondues: 0, bonnes: 0, serie: 0, record: 0 });
      function choisirMode(m) {
        modeCourant = m;
        pool = m ? o.questions.filter(function (q) { return garde(m, q); }) : o.questions;
        var vus = {};
        pool.forEach(function (q) { vus[q.p] = 1; });
        nbPortraitsPool = Object.keys(vus).length;
        var suffixe = m && m.id !== "tout" ? ":" + m.id : "";
        cleGq = "quiz-grand" + suffixe;
        cleVues = "quiz-grand-vues" + suffixe;
        gq = lireJsonLS(cleGq, { repondues: 0, bonnes: 0, serie: 0, record: 0 });
        derniersPortraits = [];
        ecrireLS("quiz-grand-mode", m ? m.id : "tout");
      }
      function garde(m, q) {
        if (m.portraits) return m.portraits.indexOf(o.portraitDe(q).id) >= 0;
        if (m.famille) return (o.portraitDe(q).f || []).indexOf(m.famille) >= 0;
        if (m.niveau) return q.n === m.niveau;
        return true;
      }

      function tete() {
        var t = el("div", "qz-tete");
        if (o.mode === "portrait") {
          t.appendChild(el("span", "qz-progres", "Question " + (i + 1) + " sur " + liste.length));
          t.appendChild(el("span", "qz-score", bonnes + (bonnes > 1 ? " bonnes réponses" : " bonne réponse")));
        } else {
          var serie = el("span", "qz-progres");
          serie.innerHTML = "Série <strong>" + gq.serie + "</strong>";
          t.appendChild(serie);
          t.appendChild(el("span", "qz-score", "Record " + gq.record + " · " + gq.bonnes + " sur " + gq.repondues));
        }
        return t;
      }

      function afficher() {
        couperPassage();
        repondu = false;
        scene.innerHTML = "";
        var q = courante;
        var bloc = el("div", "qz");
        bloc.appendChild(tete());
        if (o.mode === "portrait") {
          var barre = el("div", "qz-barre"), plein = el("i");
          plein.style.width = (100 * i / liste.length) + "%";
          barre.appendChild(plein);
          bloc.appendChild(barre);
        } else {
          if (o.modes && o.modes.length > 1) {
            var ligne = el("p", "qz-mode-ligne");
            ligne.appendChild(el("span", "", modeCourant ? modeCourant.nom : "Tout le podcast"));
            var changer = el("button", "qz-lien qz-changer", "Changer de mode");
            changer.type = "button";
            changer.addEventListener("click", function () { couperPassage(); accueil(); });
            ligne.appendChild(changer);
            bloc.insertBefore(ligne, bloc.firstChild);
          }
          var p = o.portraitDe(q), qui = el("p", "qz-qui");
          qui.appendChild(vignette(p, "qz-vignette"));
          qui.appendChild(el("span", "", "Portrait : " + p.n));
          bloc.appendChild(qui);
        }
        var titre = el("h3", "qz-question", fin(q.q));
        titre.tabIndex = -1;
        bloc.appendChild(titre);
        var choix = el("div", "qz-choix");
        choix.setAttribute("role", "group");
        choix.setAttribute("aria-label", "Réponses possibles (touches 1 à 4)");
        melanger([0, 1, 2, 3]).forEach(function (k, rang) {
          var b = el("button", "qz-reponse");
          b.type = "button";
          b.setAttribute("data-k", k);
          b.appendChild(el("span", "qz-lettre", LETTRES[rang]));
          b.appendChild(el("span", "qz-texte", fin(q.c[k])));
          b.addEventListener("click", function () { repondre(k, bloc); });
          choix.appendChild(b);
        });
        bloc.appendChild(choix);
        var retour = el("div", "qz-retour");
        retour.setAttribute("aria-live", "polite");
        bloc.appendChild(retour);
        scene.appendChild(bloc);
        titre.focus({ preventScroll: true });
      }

      function repondre(k, bloc) {
        if (repondu) return;
        repondu = true;
        var q = courante, juste = k === q.b;
        $$(".qz-reponse", bloc).forEach(function (b) {
          var kb = Number(b.getAttribute("data-k"));
          b.disabled = true;
          if (kb === q.b) b.classList.add("juste");
          else if (kb === k) b.classList.add("faux");
          else b.classList.add("autre");
        });
        if (juste) bonnes++; else ratees.push(q);
        if (o.mode === "grand") {
          gq.repondues++;
          if (juste) { gq.bonnes++; gq.serie++; if (gq.serie > gq.record) gq.record = gq.serie; } else gq.serie = 0;
          ecrireLS(cleGq, JSON.stringify(gq));
          var vues = lireJsonLS(cleVues, []);
          vues.unshift(q.id);
          ecrireLS(cleVues, JSON.stringify(vues.slice(0, Math.max(5, Math.floor(pool.length * 0.8)))));
          var ancienne = $(".qz-tete", bloc);
          ancienne.parentNode.replaceChild(tete(), ancienne);
        } else {
          $(".qz-score", bloc).textContent = bonnes + (bonnes > 1 ? " bonnes réponses" : " bonne réponse");
          $(".qz-barre i", bloc).style.width = (100 * (i + 1) / liste.length) + "%";
        }
        bloc.classList.add(juste ? "reussi" : "rate");

        var retour = $(".qz-retour", bloc);
        var verdict = el("p", "qz-verdict");
        if (juste) verdict.textContent = o.mode === "grand" && gq.serie > 1 ? "Bonne réponse ! " + gq.serie + " de suite." : "Bonne réponse !";
        else { verdict.textContent = "Pas tout à fait. La réponse : "; verdict.appendChild(el("strong", "", fin(q.c[q.b]))); }
        retour.appendChild(verdict);
        retour.appendChild(el("p", "qz-explication", fin(q.x)));
        var fig = el("figure", "qz-extrait" + (q.v ? " " + q.v : ""));
        fig.appendChild(el("blockquote", "", "« " + fin(q.e) + " »"));
        var p = o.mode === "grand" ? o.portraitDe(q) : null;
        fig.appendChild(el("figcaption", "", (q.v ? VOIX[q.v] + ", d" : "D") + (p ? "ans le portrait " + (/^[aeiouyàâéèêîôûœh]/i.test(p.n) ? "d'" : "de ") + p.n : "ans l'épisode")));
        retour.appendChild(fig);

        var actions = el("div", "qz-actions");
        if (q.a) {
          var vx = el("button", "qz-ecouter qz-voix");
          vx.type = "button";
          var libelle = (PRENOM[q.av] || "L'IA-nimateur") + " vous donne la réponse";
          vx.setAttribute("data-libelle", libelle);
          vx.innerHTML = ICONE_ECOUTE + '<span class="qz-ecoute-txt"></span>';
          $(".qz-ecoute-txt", vx).textContent = libelle;
          vx.addEventListener("click", function () { ecouterPassage(vx, audioVoix(q.a), 0, null); });
          actions.appendChild(vx);
          if (voixActives()) setTimeout(function () { if (document.body.contains(vx)) ecouterPassage(vx, audioVoix(q.a), 0, null); }, 350);
        }
        var audio = o.mode === "grand" ? (p.s ? audioDe(p.s) : null) : audioDe(null);
        if (audio && q.t !== null && q.t !== undefined) {
          var ec = el("button", "qz-ecouter");
          ec.type = "button";
          ec.innerHTML = ICONE_ECOUTE + '<span class="qz-ecoute-txt">Réécouter ce passage</span><span class="qz-t">' + mmss(q.t) + "</span>";
          ec.addEventListener("click", function () { ecouterPassage(ec, audio, q.t, q.tf); });
          actions.appendChild(ec);
        }
        if (q.r) {
          var lire = el("a", "qz-lien", "Lire le passage");
          lire.href = (p ? p.ch : "") + "#replique-" + q.r;
          if (o.surPage) lire.addEventListener("click", function () { if (o.fermer) o.fermer(); });
          actions.appendChild(lire);
        }
        if (p) {
          var aller = el("a", "qz-lien", "Le quiz " + (/^[aeiouyàâéèêîôûœh]/i.test(p.n) ? "d'" : "de ") + p.n);
          aller.href = p.ch + "#quiz";
          actions.appendChild(aller);
        }
        if (q.a) {
          var couper = el("button", "qz-lien qz-couper", voixActives() ? "Couper les voix" : "Remettre les voix");
          couper.type = "button";
          couper.addEventListener("click", function () {
            var actives = !voixActives();
            ecrireLS("quiz-voix", actives ? "oui" : "non");
            couper.textContent = actives ? "Couper les voix" : "Remettre les voix";
            if (!actives) couperPassage();
          });
          actions.appendChild(couper);
        }
        var suite = el("button", "btn btn-primary qz-suivante");
        suite.type = "button";
        suite.innerHTML = "<span>" + (o.mode === "portrait" && i === liste.length - 1 ? "Voir mon score" : "Question suivante") + "</span>" + FLECHE;
        suite.addEventListener("click", suivante);
        actions.appendChild(suite);
        retour.appendChild(actions);
        suite.focus({ preventScroll: true });
        // sur téléphone, l'explication peut tomber sous l'écran : on la montre, sans sauter
        var r = retour.getBoundingClientRect();
        if (r.bottom > (window.innerHeight || 0) && retour.scrollIntoView) retour.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      function suivante() {
        if (o.mode === "grand") { courante = tirer(); afficher(); return; }
        i++;
        if (i >= liste.length) finPortrait(); else { courante = liste[i]; afficher(); }
      }

      // grand quiz : une question pas encore vue (80 % des questions au plus en mémoire), d'un portrait qui n'est pas
      // parmi les quatre derniers
      var derniersPortraits;
      function tirer() {
        var vues = lireJsonLS(cleVues, []), dejaVu = {};
        vues.forEach(function (id) { dejaVu[id] = 1; });
        var candidats = pool.filter(function (q) { return !dejaVu[q.id] && derniersPortraits.indexOf(q.p) < 0; });
        if (!candidats.length) candidats = pool.filter(function (q) { return !dejaVu[q.id]; });
        if (!candidats.length) { ecrireLS(cleVues, "[]"); candidats = pool; }
        var q = candidats[Math.floor(Math.random() * candidats.length)];
        derniersPortraits.unshift(q.p);
        derniersPortraits = derniersPortraits.slice(0, Math.min(4, Math.floor(nbPortraitsPool / 2)));
        return q;
      }

      function finPortrait() {
        couperPassage();
        scene.innerHTML = "";
        var n = liste.length, cle = "quiz-meilleur:" + o.id;
        var meilleur = Number(lireLS(cle)) || 0;
        if (n === o.questions.length && bonnes > meilleur) ecrireLS(cle, String(bonnes));
        var f = el("div", "qz-fin");
        var note = el("p", "qz-fin-note");
        note.innerHTML = "<strong>" + bonnes + "</strong> / " + n;
        f.appendChild(note);
        var r = bonnes / n;
        var mot = r === 1 ? "Sans faute ! Vous avez tout retenu." : r >= 0.75 ? "Très belle écoute." : r >= 0.5 ? "Pas mal ! Quelques passages à réécouter." : "Une deuxième écoute s'impose ?";
        var titre = el("h3", "qz-fin-mot", mot);
        titre.tabIndex = -1;
        f.appendChild(titre);
        if (n === o.questions.length && meilleur) f.appendChild(el("p", "qz-fin-record", bonnes > meilleur ? "Nouveau record pour ce portrait (avant : " + meilleur + " / " + n + ")." : "Votre meilleur score sur ce portrait : " + meilleur + " / " + n + "."));
        var actions = el("div", "qz-actions qz-fin-actions");
        var erreurs = ratees.slice();
        if (erreurs.length && erreurs.length < n) {
          var revoir = el("button", "btn btn-primary", "Revoir mes erreurs (" + erreurs.length + ")");
          revoir.type = "button";
          revoir.addEventListener("click", function () { demarrer(erreurs); });
          actions.appendChild(revoir);
        }
        var encore = el("button", "btn btn-ghost", "Recommencer");
        encore.type = "button";
        encore.addEventListener("click", function () { demarrer(); });
        actions.appendChild(encore);
        if (o.grand) { var g = el("a", "qz-lien qz-grand"); g.href = o.grand; g.innerHTML = "<span>Le grand quiz : tous les portraits</span>" + FLECHE; actions.appendChild(g); }
        f.appendChild(actions);
        if (ratees.length) {
          f.appendChild(el("p", "qz-fin-sous", "À réécouter"));
          var ul = el("ul", "qz-fin-liste");
          ratees.forEach(function (q) {
            var li = el("li");
            li.appendChild(el("span", "qz-fin-q", fin(q.q)));
            var rep = el("span", "qz-fin-r", "Réponse : ");
            rep.appendChild(el("strong", "", fin(q.c[q.b])));
            li.appendChild(rep);
            if (q.r) { var a = el("a", "qz-lien", "Lire le passage"); a.href = "#replique-" + q.r; a.addEventListener("click", function () { if (o.fermer) o.fermer(); }); li.appendChild(a); }
            ul.appendChild(li);
          });
          f.appendChild(ul);
        }
        scene.appendChild(f);
        titre.focus({ preventScroll: true });
      }

      // portrait : du plus facile au plus difficile, dans un ordre nouveau à chaque fois
      function demarrer(seulement) {
        liste = melanger(seulement || o.questions).sort(function (a, b) { return a.n - b.n; });
        i = 0; bonnes = 0; ratees = [];
        if (o.mode === "grand") courante = tirer(); else courante = liste[0];
        afficher();
      }

      function accueil() {
        scene.innerHTML = "";
        var a = el("div", "qz-accueil");
        if (o.modes && o.modes.length > 1) {
          var groupe = el("div", "qz-modes");
          groupe.setAttribute("role", "group");
          groupe.setAttribute("aria-label", "Choisir un mode de jeu");
          o.modes.forEach(function (m) {
            var b = el("button", "qz-mode-btn");
            b.type = "button";
            b.setAttribute("aria-pressed", modeCourant && modeCourant.id === m.id ? "true" : "false");
            b.appendChild(el("strong", "", m.nom));
            b.appendChild(el("span", "qz-mode-n", m.nombre + " questions"));
            b.appendChild(el("span", "qz-mode-d", m.d));
            b.addEventListener("click", function () {
              choisirMode(m);
              try { history.replaceState(null, "", m.id === "tout" ? location.pathname : "#mode=" + m.id); } catch (e) {}
              accueil();
              var actif = $(".qz-mode-btn[aria-pressed=true]", scene);
              if (actif) actif.focus({ preventScroll: true });
            });
            groupe.appendChild(b);
          });
          a.appendChild(groupe);
        }
        var chiffres = el("ul", "qz-chiffres");
        [[pool.length, "questions"], [nbPortraitsPool, "portraits"]].concat(gq.repondues ? [[gq.record, "votre record de suite"]] : []).forEach(function (x) {
          var li = el("li");
          li.appendChild(el("strong", "", String(x[0])));
          li.appendChild(el("span", "", x[1]));
          chiffres.appendChild(li);
        });
        a.appendChild(chiffres);
        a.appendChild(el("p", "qz-accueil-texte", gq.repondues ? "Dans ce mode, vous avez déjà répondu à " + gq.repondues + " question" + (gq.repondues > 1 ? "s" : "") + ", dont " + gq.bonnes + " bonne" + (gq.bonnes > 1 ? "s" : "") + ". Celles déjà vues ne reviennent pas tout de suite." : "Une question à la fois, tirée au hasard. Enchaînez les bonnes réponses : votre meilleure série est gardée."));
        var go = el("button", "btn btn-primary qz-commencer");
        go.type = "button";
        go.innerHTML = "<span>" + (gq.repondues ? "Reprendre" : "Commencer") + "</span>" + FLECHE;
        go.addEventListener("click", function () { demarrer(); });
        a.appendChild(go);
        scene.appendChild(a);
      }

      // mode d'arrivée : l'adresse (#mode=difficile, à partager), sinon le dernier choisi dans ce navigateur
      if (o.modes && o.modes.length) {
        var voulu = (location.hash.match(/mode=([a-z0-9-]+)/) || [])[1] || lireLS("quiz-grand-mode") || "tout";
        choisirMode(o.modes.filter(function (m) { return m.id === voulu; })[0] || o.modes[0]);
      } else derniersPortraits = [];

      // clavier : 1 à 4 (ou A à D) pour répondre ; Entrée passe à la suite (bouton déjà en focus)
      scene.addEventListener("keydown", function (ev) {
        if (ev.altKey || ev.ctrlKey || ev.metaKey || repondu) return;
        var n = "1234".indexOf(ev.key), l = "abcd".indexOf(String(ev.key).toLowerCase());
        var rang = n >= 0 ? n : l;
        if (rang < 0 || /input|textarea/i.test(ev.target.tagName)) return;
        var b = $$(".qz-reponse", scene)[rang];
        if (b) { ev.preventDefault(); b.click(); }
      });

      return { demarrer: demarrer, accueil: accueil, couper: couperPassage };
    }

    /* -------- page d'un portrait : bouton sous le lecteur, encart après la conversation, fenêtre du quiz */
    var donneesQuiz = $("#donnees-quiz");
    if (donneesQuiz && typeof HTMLDialogElement === "function") {
      var dq = JSON.parse(donneesQuiz.textContent);
      var fenetre = el("dialog", "quiz-fenetre");
      fenetre.setAttribute("aria-labelledby", "qf-titre");
      fenetre.innerHTML = '<div class="qf-dedans"><div class="qf-tete"><h2 id="qf-titre"></h2><button type="button" class="rf-fermer qf-fermer" aria-label="Fermer le quiz"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="quiz-scene"></div></div>';
      $("#qf-titre", fenetre).textContent = "Le quiz · " + dq.nom;
      if (dq.ouverture || dq.questions.some(function (q) { return q.a; })) {
        var mention = el("p", "qf-mention", (dq.ouverture ? "Voix d'Alexandre recréée par IA, avec son accord ; " : "") + "voix d'Ada, d'Alan et de Lia générées par IA.");
        $(".qf-tete", fenetre).insertAdjacentElement("afterend", mention);
      }
      document.body.appendChild(fenetre);
      var moteur = monterQuiz($(".quiz-scene", fenetre), { mode: "portrait", questions: dq.questions, id: dq.id, grand: dq.grand, surPage: true, fermer: function () { fenetre.close(); } });
      var ouvrirQuiz = function () {
        var invit = $(".quiz-invitation");
        if (invit) invit.remove();
        if (fenetre.open) return;
        moteur.demarrer();
        fenetre.showModal();
        doc.classList.add("fenetre-ouverte");
        if (dq.ouverture && voixActives()) {
          var episode = $(".lecteur[data-audio] audio");
          if (episode && !episode.paused) episode.pause();
          var ov = audioVoix(dq.ouverture);
          ov.currentTime = 0;
          ov.play().catch(function () {});
        }
      };
      $(".qf-fermer", fenetre).addEventListener("click", function () { fenetre.close(); });
      fenetre.addEventListener("click", function (ev) { if (ev.target === fenetre) fenetre.close(); });
      fenetre.addEventListener("close", function () { doc.classList.remove("fenetre-ouverte"); moteur.couper(); });
      $$("[data-quiz-ouvrir]").forEach(function (b) { b.addEventListener("click", ouvrirQuiz); });
      $$(".quiz-encart, .pa-quiz[data-quiz-ouvrir]").forEach(function (x) { x.hidden = false; });
      if (location.hash === "#quiz") setTimeout(ouvrirQuiz, 300);
      // à la fin de l'écoute : une invitation discrète, une seule fois
      document.addEventListener("episode:fin", function () {
        if (fenetre.open || $(".quiz-invitation")) return;
        var inv = el("div", "quiz-invitation");
        inv.setAttribute("role", "status");
        inv.innerHTML = '<p><strong>Qu’avez-vous retenu ?</strong><span>' + dq.questions.length + " questions sur l'épisode</span></p>";
        var go = el("button", "btn btn-primary", "Faire le quiz");
        go.type = "button";
        go.addEventListener("click", ouvrirQuiz);
        var non = el("button", "quiz-invitation-fermer");
        non.type = "button";
        non.setAttribute("aria-label", "Plus tard");
        non.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
        non.addEventListener("click", function () { inv.remove(); });
        inv.appendChild(go);
        inv.appendChild(non);
        document.body.appendChild(inv);
        requestAnimationFrame(function () { inv.classList.add("visible"); });
      });
    }

    /* -------- le grand quiz (page quiz/) */
    var grand = $("#grand-quiz[data-quiz-url]");
    if (grand && window.fetch) {
      grand.classList.add("charge");
      fetch(grand.getAttribute("data-quiz-url")).then(function (r) { return r.json(); }).then(function (idx) {
        grand.classList.remove("charge");
        var m = monterQuiz(grand, { mode: "grand", questions: idx.questions, nbPortraits: idx.portraits.length, modes: idx.modes || [], portraitDe: function (q) { return idx.portraits[q.p]; } });
        m.accueil();
      }).catch(function () {
        grand.classList.remove("charge");
        grand.appendChild(el("p", "quiz-sans-js", "Le quiz n'a pas pu se charger. Rechargez la page pour réessayer."));
      });
    }
  })();
})();
