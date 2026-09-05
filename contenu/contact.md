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
chapo: "Décrivez votre besoin en quelques lignes. Nous répondons sous un jour ouvré, et nous commençons volontiers par une démonstration."
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
  <button class="btn" type="submit">Envoyer le message</button>
  <p class="retour" id="c-retour" role="status" aria-live="polite"></p>
</form>

<script>
(function(){
  var f=document.getElementById("f-contact"), r=document.getElementById("c-retour"), ouvert=Date.now();
  f.addEventListener("submit", function(e){
    e.preventDefault();
    var b=f.querySelector("button"); b.disabled=true; r.textContent="Envoi en cours…"; r.className="retour";
    var d=Object.fromEntries(new FormData(f).entries());
    d.instant=ouvert; d.page=location.pathname;
    fetch("/api/contact",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)})
      .then(function(rep){ return rep.json().then(function(j){ return {st:rep.status,j:j}; }); })
      .then(function(x){
        if(x.st===200){ f.reset(); r.className="retour ok"; r.textContent="Merci, votre message est parti. Nous répondons sous un jour ouvré."; }
        else { r.className="retour erreur"; r.textContent=(x.j.erreurs||["Envoi impossible pour le moment."]).join(" "); b.disabled=false; }
      })
      .catch(function(){ r.className="retour erreur"; r.textContent="L'envoi a échoué. Réessayez, ou écrivez-nous depuis votre messagerie."; b.disabled=false; });
  });
})();
</script>


## Prendre rendez-vous

Pour convenir d'une date de masterclass, d'atelier ou de session Forge, l'organisation passe par **Frédérique**, qui tient l'agenda et vous proposera les créneaux disponibles.

## Ce qu'on vous demandera

Pour répondre utilement, trois éléments suffisent :

1. **Le contexte.** Votre structure, la taille de l'équipe concernée, votre secteur.
2. **Le besoin.** Ce qui prend trop de temps aujourd'hui, ou ce que vous aimeriez pouvoir faire.
3. **L'horizon.** Une date, même approximative, change beaucoup la réponse.

## Nous suivre

- [Choucroute Citron](https://choucroute-citron.com), le podcast
- [alexandre.ai](https://alexandre.ai), les créations visuelles
- [La galaxie 3h33](/galaxie/), tous nos sites et outils
