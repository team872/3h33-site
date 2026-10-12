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

  function duree(s) {
    if (!isFinite(s) || s < 0) s = 0;
    s = Math.round(s);
    var m = Math.floor(s / 60), r = s % 60;
    return m + ":" + (r < 10 ? "0" : "") + r;
  }

  /* ------------------------------------------------ barre du haut qui se densifie au défilement, bouton « remonter » */
  var barre = $(".barre");
  var haut = $(".remonter");
  var liensNav = $$(".barre nav a[href^='#']");
  var majDefile = function () {
    var y = window.scrollY;
    if (barre) barre.classList.toggle("defile", y > 40);
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

  /* ------------------------------------------------ bandeau : le mur de vignettes s'arrête quand on ne le voit plus */
  var mur = $(".mur");
  if (mur && "IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { mur.classList.toggle("arret", !e[0].isIntersecting); }).observe(mur);
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
      lire.textContent = "Lire tout";
      lire.setAttribute("aria-expanded", "false");
      citation.parentNode.insertBefore(lire, citation.nextSibling);
      var texteLia = $("p", citation) || citation;
      var majLire = function () { lire.hidden = lia.classList.contains("deplie") || texteLia.scrollHeight <= texteLia.clientHeight + 2; };
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
    var vitesses = [1, 1.25, 1.5, 0.85], iv = 0;
    var bv = $("[data-vitesse]", lecteur);
    if (bv) bv.addEventListener("click", function () {
      iv = (iv + 1) % vitesses.length;
      audio.playbackRate = vitesses[iv];
      bv.textContent = String(vitesses[iv]).replace(".", ",") + "×";
      bv.setAttribute("aria-label", "Vitesse de lecture : " + bv.textContent);
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
          var titre = h ? h.getAttribute("data-titre") : actif ? nom : "Écouter le portrait";
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
    var majEcoute = function () { doc.classList.toggle("en-ecoute", !audio.paused && !audio.ended); };
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
      var majMini = function () { // un seul getBoundingClientRect : assez léger pour chaque événement de défilement
        // visible aussi quand le grand lecteur est encore plus bas que l'écran (téléphone : la vignette prend
        // tout le premier écran) ; caché seulement quand le grand lecteur lui-même est à l'écran
        var r = lecteur.getBoundingClientRect();
        var v = r.bottom < hautBarre + 8 || r.top > window.innerHeight - 24;
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
      if (!actuel) return;
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
    });
    pAudio.addEventListener("ended", function () { voisin(1); });
    document.addEventListener("keydown", function (e) {
      if (!player.classList.contains("active") || e.target.closest("input,textarea,dialog")) return;
      if (e.key === "Escape") $("#closeBtn").click();
    });
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
    function motsDe(requete) {
      var tous = norm(requete).split(new RegExp("[^" + LETTRE + "]+")).filter(Boolean);
      var utiles = tous.filter(function (m) { return !VIDES[m] && (m.length > 1 || /\d/.test(m)); });
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
            { poids: 4, n: norm((p.f || []).map(function (f) { return nomsFam[f] || ""; }).join(" · ")) }
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

    /* ------------------------------------------------ page de l'émission : recherche et familles sur la grille */
    var outils = $(".outils[data-recherche]");
    var grille = $("#grille-portraits");
    if (outils && grille) {
      var urlIndex = outils.getAttribute("data-recherche");
      var cartes = $$(".episode-card", grille);
      var ordre = cartes.slice();
      var champ = $(".cherche-champ", outils);
      var effacer = $(".cherche-effacer", outils);
      var puces = $$(".puce[data-famille]", outils);
      var compte = $(".compte", outils);
      var toutVoirHaut = $(".tout-voir", outils);
      var aucun = $(".aucun");
      var exemples = $(".exemples", outils);
      aideCourte(champ);
      var famillesDe = {}, nomsFamilles = {};
      cartes.forEach(function (c) { famillesDe[c.getAttribute("data-id")] = (c.getAttribute("data-familles") || "").split(" ").filter(Boolean); });
      puces.forEach(function (b) { nomsFamilles[b.getAttribute("data-famille")] = $(".puce-nom", b).textContent; });
      var total = cartes.length;
      var etat = { q: "", familles: [] };
      var index = null, chargement = false, echec = false, resultat = null;
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
          if (etat.q) rechercher();
        }, function () { chargement = false; echec = true; appliquer(); });
      };
      var rechercher = function () {
        resultat = index && etat.q ? chercher(index, etat.q) : null;
        appliquer();
      };
      var passe = function (id) {
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
        var ex = blocExtrait(index, P, r, etat.q, "card-extrait", 150);
        l.setAttribute("href", ex.url);
        l.setAttribute("aria-label", c._nom + (ex.bloc ? " : passage trouvé" + (ex.libelle ? " (" + ex.libelle + ")" : "") : ""));
        if (ex.bloc) {
          ex.bloc.setAttribute("aria-hidden", "true");
          $(".card-inner", c).insertBefore(ex.bloc, $(".card-footer", c));
          c.classList.add("avec-extrait");
        }
      };
      var guillemets = function (q) { return "\u00ab\u00a0" + q.trim() + "\u00a0\u00bb"; };
      var appliquer = function () {
        var res = resultat && resultat.res, actif = etat.familles.length || (etat.q.trim() && (resultat || !index));
        var n = 0;
        cartes.forEach(function (c) {
          var id = c.getAttribute("data-id"), ok = passe(id);
          c.hidden = !ok;
          if (ok) n++;
          if (actif) c.classList.add("visible");
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
          var k = on ? n : cartes.filter(function (c) { var id = c.getAttribute("data-id"); return famillesDe[id].indexOf(f) >= 0 && passe(id); }).length;
          b.setAttribute("aria-pressed", on ? "true" : "false");
          b.classList.toggle("vide", !on && k === 0);
          b.disabled = !on && k === 0;
          var pn = $(".puce-n", b);
          pn.textContent = String(k);
          pn.setAttribute("aria-label", k + (k > 1 ? " portraits" : " portrait"));
        });
        // compteur
        var q = etat.q.trim();
        compte.textContent = "";
        if (q && !index && !echec) compte.appendChild(document.createTextNode("Recherche…"));
        else if (q && echec) compte.appendChild(document.createTextNode("La recherche n'a pas pu se charger. Vérifiez la connexion, puis réessayez."));
        else {
          var fort = document.createElement("strong");
          fort.textContent = String(n);
          compte.appendChild(fort);
          var suite = " portrait" + (n > 1 ? "s" : "");
          if (n !== total) suite += " sur " + total;
          if (q && resultat) suite += " pour " + guillemets(q);
          if (etat.familles.length) suite += " · " + etat.familles.map(function (f) { return nomsFamilles[f]; }).join(" + ");
          compte.appendChild(document.createTextNode(suite));
        }
        var filtre = !!(etat.familles.length || q);
        toutVoirHaut.hidden = !filtre;
        if (exemples) exemples.hidden = filtre;
        effacer.hidden = !champ.value;
        aucun.hidden = !(filtre && n === 0 && (!q || resultat || !index));
        if (!aucun.hidden) $(".aucun-quoi", aucun).textContent = q ? " à " + guillemets(q) + (etat.familles.length > 1 ? " dans ces familles" : etat.familles.length ? " dans cette famille" : "") : " à toutes ces familles à la fois";
        outils.classList.toggle("filtre", filtre);
      };

      // l'adresse garde l'état (#famille=chine,robots&q=huawei) : on peut la partager
      var minuteurAdresse = null;
      var ecrireAdresse = function () {
        clearTimeout(minuteurAdresse);
        minuteurAdresse = setTimeout(function () {
          var h = [];
          if (etat.familles.length) h.push("famille=" + etat.familles.map(encodeURIComponent).join(","));
          if (etat.q.trim()) h.push("q=" + encodeURIComponent(etat.q.trim()));
          var cible = h.length ? "#" + h.join("&") : location.pathname + location.search;
          if ((h.length ? "#" + h.join("&") : "") === location.hash) return;
          try { history.replaceState(null, "", cible); } catch (e) {}
        }, 350);
      };
      var lireAdresse = function () {
        var h = location.hash, mf = /[#&]famille=([^&]*)/.exec(h), mq = /[#&]q=([^&]*)/.exec(h);
        if (!mf && !mq) return false;
        var dec = function (s) { try { return decodeURIComponent(s.replace(/\+/g, " ")); } catch (e) { return ""; } };
        etat.familles = mf ? dec(mf[1]).split(",").filter(function (f) { return nomsFamilles[f]; }) : [];
        etat.q = mq ? dec(mq[1]).slice(0, 80) : "";
        champ.value = etat.q;
        if (etat.q) chargerRecherche();
        rechercher();
        return true;
      };

      var minuteur = null;
      champ.addEventListener("input", function () {
        etat.q = champ.value;
        effacer.hidden = !champ.value;
        chargerRecherche();
        clearTimeout(minuteur);
        minuteur = setTimeout(rechercher, index ? 90 : 0);
        ecrireAdresse();
      });
      ["focus", "pointerenter"].forEach(function (e) { champ.addEventListener(e, chargerRecherche); });
      // sur téléphone, le clavier cache la moitié de l'écran : le champ remonte sous la barre, les résultats juste dessous
      champ.addEventListener("focus", function () {
        if (window.innerWidth < 700 && outils.getBoundingClientRect().top > window.innerHeight * 0.3) {
          setTimeout(function () { outils.scrollIntoView({ block: "start", behavior: calme ? "auto" : "smooth" }); }, 250);
        }
      });
      champ.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && champ.value) { ev.preventDefault(); vider(true); }
        if (ev.key === "Enter") {
          ev.preventDefault();
          clearTimeout(minuteur);
          rechercher();
          if (window.matchMedia("(pointer:coarse)").matches) champ.blur(); // range le clavier : on voit les résultats
        }
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
        b.addEventListener("click", function () { vider(false); champ.focus({ preventScroll: true }); });
      });
      puces.forEach(function (b) {
        b.addEventListener("click", function () {
          var f = b.getAttribute("data-famille"), i = etat.familles.indexOf(f);
          if (i >= 0) etat.familles.splice(i, 1); else etat.familles.push(f);
          appliquer();
          ecrireAdresse();
        });
      });
      $$("[data-exemple]", outils).forEach(function (b) {
        b.addEventListener("click", function () {
          champ.value = b.getAttribute("data-exemple");
          etat.q = champ.value;
          chargerRecherche();
          rechercher();
          ecrireAdresse();
        });
      });
      // sur téléphone, les puces défilent de côté : on amène la première famille choisie en vue
      var montrerPuces = function () {
        var rang = $(".puces", outils), on = $(".puce[aria-pressed=\"true\"]", outils);
        if (on && rang.scrollWidth > rang.clientWidth) rang.scrollLeft += on.getBoundingClientRect().left - rang.getBoundingClientRect().left - 20;
      };
      var arriver = function () { aller(outils, "start"); montrerPuces(); };
      window.addEventListener("hashchange", function () { if (lireAdresse()) arriver(); });
      ouvrirRecherche = function () {
        try { champ.focus({ preventScroll: true }); } catch (e) { champ.focus(); }
        outils.scrollIntoView({ block: "start", behavior: calme ? "auto" : "smooth" }); // après le focus, qui couperait le défilement
        chargerRecherche();
      };
      // arrivée avec un état dans l'adresse (lien partagé) : on l'applique et on amène la grille à l'écran
      if (lireAdresse()) setTimeout(arriver, 30);
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
      rfChamp.addEventListener("input", function () {
        clearTimeout(rfMinuteur);
        rfMinuteur = setTimeout(rfAfficher, rfIndex ? 90 : 0);
        if (!rfIndex) rfCharger();
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
})();
