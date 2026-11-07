/* Où cliquent les visiteurs de 3h33.com (21/10/2026, Alexandre : « qu'est-ce qu'ils font depuis la home page,
   où est-ce qu'ils cliquent ? »). Envoie à Umami (stats.3h33.com, sans cookie) un événement par clic :
     clic        { texte, vers, zone }   lien ou bouton de la page (zone = la section où il se trouve)
     sortie      { vers }                lien vers un autre site
     contact     { vers }                e-mail, téléphone, WhatsApp, page Contact
     video       { fichier }             lecture d'une vidéo ou d'un son (une fois par fichier)
   Rien n'est envoyé quand l'adresse finit par « #apercu ». Umami ne compte rien sur un navigateur où
   localStorage « umami.disabled » vaut 1 (Alexandre). Les pages vues et leur enchaînement, Umami les a déjà. */
(function () {
  function envoi(n, d) { try { if (location.hash === "#apercu") return; if (window.umami && umami.track) umami.track(n, d); } catch (e) {} }
  function zone(el) {
    var s = el.closest("section[id],header,footer,nav,dialog,[id]");
    if (!s) return "page";
    if (s.tagName === "HEADER" || s.tagName === "NAV") return "menu";
    if (s.tagName === "FOOTER") return "pied";
    return s.id || s.tagName.toLowerCase();
  }
  document.addEventListener("click", function (ev) {
    var c = ev.target.closest && ev.target.closest("a,button,summary");
    if (!c) return;
    var texte = (c.getAttribute("aria-label") || c.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60);
    var h = c.tagName === "A" ? c.getAttribute("href") || "" : "";
    var z = zone(c);
    if (/^(mailto:|tel:|sms:)|wa\.me|api\.whatsapp|^\/contact/i.test(h)) envoi("contact", { vers: h.split("?")[0].slice(0, 80), zone: z });
    if (/^https?:/i.test(h)) {
      try { var u = new URL(h, location.href); if (u.host !== location.host) { envoi("sortie", { vers: (u.host + u.pathname).slice(0, 80), zone: z }); return; } } catch (e) {}
    }
    envoi("clic", { texte: texte || "?", vers: h ? h.slice(0, 80) : c.tagName.toLowerCase() + (c.id ? "#" + c.id : ""), zone: z });
  }, true);
  var vus = new WeakSet();
  document.addEventListener("play", function (ev) {
    var m = ev.target; if (vus.has(m)) return; vus.add(m);
    var f = (m.currentSrc || m.src || "").split("?")[0].split("/").pop();
    if (m.muted && m.autoplay) return; /* vidéos de décor qui tournent seules */
    envoi("video", { fichier: f || "?" });
  }, true);
})();
