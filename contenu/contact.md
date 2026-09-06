---
titre: "Nous contacter"
titre_seo: "Contacter 3h33, l'agence de l'IA · 3h33"
description: "Un projet, une formation, une question sur l'IA ? Écrivez-nous : nous répondons vite et commençons souvent par une démonstration plutôt que par une réunion."
url: /contact/
type: page
rubrique: "Le site|"
fil: "Contact"
priorite: 0.9
eyebrow: "Contact"
chapo: "Vous avez assez entendu parler d'IA. Dites-nous en trois lignes ce qui vous prend du temps : on répond sous un jour ouvré, souvent par une démonstration plutôt que par une réunion."
duree_lecture: non
---

## Écrivez-nous

<form class="formulaire" id="f-contact" novalidate>
  <div class="champ"><label for="c-nom">Votre nom</label><input id="c-nom" name="nom" type="text" autocomplete="name" required></div>
  <div class="champ"><label for="c-email">Votre adresse électronique</label><input id="c-email" name="email" type="email" autocomplete="email" required></div>
  <div class="champ"><label for="c-orga">Votre organisation <span>facultatif</span></label><input id="c-orga" name="organisation" type="text" autocomplete="organization"></div>
  <div class="champ"><label for="c-sujet">Votre demande</label><select id="c-sujet" name="sujet">
    <option>Une formation pour mes équipes</option>
    <option>Un outil à construire</option>
    <option>Un film, un clip, une musique</option>
    <option>Une intervention ou une conférence</option>
    <option>Autre chose</option>
  </select></div>
  <div class="champ"><label for="c-message">Votre message</label><textarea id="c-message" name="message" rows="6" required placeholder="Votre contexte, votre besoin, et une date si vous en avez une."></textarea></div>
  <div class="piege" aria-hidden="true"><label>Ne remplissez pas ce champ<input type="text" name="site" tabindex="-1" autocomplete="off"></label></div>
  <div class="envoi"><button class="btn" type="submit">Envoyer le message</button><span class="envoi__tourne" hidden aria-hidden="true"><svg class="trotteuse trotteuse--lisse" viewBox="0 0 120 120" role="img" aria-label="Trotteuse, un cran par seconde">
  <circle class="piste" cx="60" cy="60" r="52"/>
  <circle class="crans" cx="60" cy="60" r="46"/>
  <line class="bras" x1="60" y1="66" x2="60" y2="20"/>
  <circle class="contrepoids" cx="60" cy="74" r="5.5"/>
</svg>

<svg class="trotteuse trotteuse--lisse" viewBox="0 0 120 120" role="img" aria-label="Indicateur d'activite">
  <circle class="piste" cx="60" cy="60" r="52"/>
  <circle class="crans" cx="60" cy="60" r="46"/>
  <line class="bras" x1="60" y1="66" x2="60" y2="20"/>
  <circle class="contrepoids" cx="60" cy="74" r="5.5"/>
</svg></span></div>
  <p class="retour" id="c-retour" role="status" aria-live="polite"></p>
</form>

<script>
(function(){
  var f=document.getElementById("f-contact"), r=document.getElementById("c-retour"), ouvert=Date.now();
  f.addEventListener("submit", function(e){
    e.preventDefault();
    var b=f.querySelector("button"), tr=f.querySelector(".envoi__tourne"); b.disabled=true; if(tr) tr.hidden=false; r.textContent="Envoi en cours…"; r.className="retour";
    var d=Object.fromEntries(new FormData(f).entries());
    d.instant=ouvert; d.page=location.pathname;
    fetch("/api/contact",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)})
      .then(function(rep){ return rep.json().then(function(j){ return {st:rep.status,j:j}; }); })
      .then(function(x){
        if(x.st===200){ f.reset(); if(tr) tr.hidden=true; r.className="retour ok"; r.textContent="Merci, votre message est parti. Nous répondons sous un jour ouvré."; }
        else { if(tr) tr.hidden=true; r.className="retour erreur"; r.textContent=(x.j.erreurs||["Envoi impossible pour le moment."]).join(" "); b.disabled=false; }
      })
      .catch(function(){ if(tr) tr.hidden=true; r.className="retour erreur"; r.textContent="L'envoi a échoué. Réessayez, ou écrivez-nous depuis votre messagerie."; b.disabled=false; });
  });
})();
</script>


## Prendre rendez-vous

Pour fixer une date de masterclass, d'atelier ou de session Forge, l'agenda passe par **Frédérique**. Indiquez-le dans votre message : elle vous proposera des créneaux dans la journée.

## Trois lignes suffisent

Pas besoin d'un cahier des charges. Ces trois éléments nous permettent déjà de répondre précisément :

1. **Qui vous êtes.** Votre structure, votre secteur, le nombre de personnes concernées.
2. **Ce qui coince.** La tâche qui prend trop de temps, ou ce que vous aimeriez pouvoir faire et que vous ne savez pas faire.
3. **Quand.** Une date même approximative change complètement la réponse.

Si vous ne savez pas encore, écrivez-le : on commence souvent par une démonstration de vingt minutes qui clarifie tout.

## Nous suivre

- [Choucroute Citron](https://choucroute-citron.com), le podcast
- [alexandre.ai](https://alexandre.ai), les créations visuelles
- [La galaxie 3h33](/galaxie/), tous nos sites et outils
