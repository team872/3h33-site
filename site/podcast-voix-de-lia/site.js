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
        var el = e.target;
        if (!el.style.getPropertyValue("--d")) el.style.setProperty("--d", Math.min(k++ * 0.07, 0.42) + "s");
        el.classList.add("visible");
        vus.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
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
    var miniN = mini && $(".mini-n", mini), miniCh = mini && $(".mini-chapitre", mini);
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
      if (c !== kCh) {
        kCh = c;
        var h = titres[c];
        liensCh.forEach(function (a) { a.classList.toggle("ecoute", !!h && a.getAttribute("href") === "#" + h.id); });
        if (mini) {
          var titre = h ? h.getAttribute("data-titre") : nom;
          var num = /^(\d+) · (.*)$/.exec(titre); // « 03 · Le début de sa vie » : le numéro à part, en or
          miniN.textContent = num ? num[1] : "";
          miniCh.textContent = num ? num[2] : titre;
          mini.classList.toggle("avec-chapitre", !!h);
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

    // le mini-lecteur, sous la barre du haut : visible dès que le grand lecteur est passé au-dessus de l'écran,
    // et toute la suite de la page ; un clic sur le chapitre ramène au passage entendu
    if (mini) {
      var hautBarre = 56;
      var mesurer = function () {
        hautBarre = barre ? Math.round(barre.getBoundingClientRect().height) : 0;
        doc.style.setProperty("--haut-barre", hautBarre + "px");
        doc.style.setProperty("--haut-mini", Math.round(mini.getBoundingClientRect().height) + "px");
      };
      var visible = null;
      var majMini = function () { // un seul getBoundingClientRect : assez léger pour chaque événement de défilement
        var v = lecteur.getBoundingClientRect().bottom < hautBarre + 8;
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
      $(".mini-aller", mini).addEventListener("click", function () {
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
    var marquerCartes = function () {
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
    $$("[data-jouer]").forEach(function (b) {
      b.addEventListener("click", function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        var id = b.getAttribute("data-jouer");
        for (var i = 0; i < episodes.length; i++) if (episodes[i].id === id) return charger(i, true);
      });
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
      if (!player.classList.contains("active") || e.target.closest("input,textarea")) return;
      if (e.key === "Escape") $("#closeBtn").click();
    });
  }
})();
