# verif-nom : combien de personnes peuvent l'utiliser en même temps ? (01/11/2026)

*Question d'Alexandre : avant d'offrir https://3h33.com/verif-nom/ aux startups qui jouent au jeu de la Startup, les
limites gratuites sont-elles un problème ? Ni Notion ni GitHub ne l'expliquaient. Réponse vérifiée en lisant le code de
la page (`site/verif-nom/index.html`) et la documentation de chaque service.*

## La réponse courte

**Il n'y a aucune limite pour 3h33, ni par jour ni en nombre de personnes.** La page est un simple fichier, sans serveur
à nous : c'est le navigateur de chaque visiteur qui interroge lui-même les bases publiques. Chaque limite s'applique donc
**à l'adresse internet du visiteur**, pas à 3h33. Cent personnes chez elles peuvent chercher en même temps sans se gêner,
et cela ne coûte rien.

**Le seul vrai risque : une salle entière sur le même Wi-Fi**, par exemple un atelier en incubateur ou une soirée. Tout le
monde sort alors par la même adresse internet et partage les limites ci-dessous.

## Comment ça marche, point par point

Quand on tape un nom, la page interroge en même temps des **annuaires publics et gratuits**, ouverts à tous, sans clé
ni compte. On appelle ces services des « API » : des guichets automatiques où un programme pose une question et reçoit une
réponse. Personne ne paie et rien ne passe par 3h33.

| Ce qu'on vérifie | À qui on le demande | Comment on lit la réponse |
|---|---|---|
| **Le nom de domaine** en .com, .fr, .app, .dev, .net, .org et .xyz | **rdap.org**, qui renvoie vers l'annuaire officiel de chaque extension (Verisign pour le .com, l'Afnic pour le .fr, Google pour le .app…) | « Pas de fiche » : personne n'a déposé le nom, il est **libre**. Une fiche : il est **pris**. |
| **Le nom de domaine** en .io, .co et .ai | Ces extensions n'ont pas d'annuaire public : on interroge **dns.google**, le carnet d'adresses d'internet | Aucune adresse : **probablement libre**. C'est moins sûr que la ligne du dessus, et l'outil le dit. |
| **Une entreprise française** qui porte déjà ce nom | **recherche-entreprises.api.gouv.fr**, l'annuaire des entreprises de l'État (le registre RNE, tenu par l'INPI) | La liste des sociétés trouvées, avec leur SIREN et leur adresse. |
| **Un compte GitHub** à ce nom | **GitHub** (le site où les développeurs rangent leur code) | Le compte existe-t-il ? C'est utile pour réserver le nom d'un projet. |
| **Une bibliothèque de code** à ce nom | Les registres **npm** (JavaScript), **PyPI** (Python), **crates.io** (Rust) et **RubyGems** (Ruby) | Le nom est-il déjà pris par un programme publié ? |
| **Une œuvre ou une chose connue** à ce nom | **Wikipedia** (français et anglais), **Wikidata** (la base de faits de Wikipedia), **Open Library** (les livres), la **Bibliothèque du Congrès** (États-Unis) | Un film, un jeu, un livre ou une entreprise célèbre du même nom ? C'est là qu'on a trouvé le jeu « Wildkeepers Rising ». |
| **Les marques déposées** (INPI, EUIPO/TMview, USPTO, OMPI) et **les brevets** | **Pas de guichet automatique gratuit** : ces bases demandent une clé ou bloquent les programmes | L'outil ouvre la bonne recherche sur le site officiel en un clic, et **on la fait à la main**. C'est ce qu'on a fait pour Vivakeeper et Vivaclock. |

Les 20 dernières recherches restent dans le navigateur du visiteur. Elles ne sont envoyées nulle part.

## Les limites, base par base

| Base interrogée | Limite (par adresse internet) | Ce que ça donne |
|---|---|---|
| rdap.org (domaines .com, .fr, .app, .dev, .net, .org, .xyz) | **10 requêtes en 10 secondes** ([about.rdap.org](https://about.rdap.org/), « Rate Limits ») | Une recherche teste 7 extensions par rdap.org : **environ une recherche toutes les 10 secondes** par réseau. Au-delà, les extensions s'affichent « Incertain » (réponse 429), puis tout revient en quelques secondes. |
| GitHub (le nom est-il pris ?) | **60 requêtes par heure** sans compte (annoncé dans « Limites » de la page) | **60 recherches par heure** par réseau ; au-delà, la ligne GitHub échoue jusqu'à l'heure suivante. |
| Entreprises françaises (recherche-entreprises.api.gouv.fr) | **7 requêtes par seconde** ([documentation officielle](https://recherche-entreprises.api.gouv.fr/docs/), « Limite des requêtes ») | Jamais un problème : une recherche n'en fait qu'une. |
| dns.google (.io, .co, .ai), npm, PyPI, crates.io, Wikipedia, Wikidata, Open Library | larges, non chiffrées pour un usage normal | Pas de souci constaté. |
| INPI, USPTO, EUIPO, OMPI (marques) | aucune : ce sont des liens à cliquer | La recherche de marque se fait à la main, sur le site officiel. |

## En pratique

- **Chacun chez soi ou sur son téléphone (4G)** : autant de monde qu'on veut, en même temps.
- **Une salle de 20 personnes sur le même Wi-Fi** : environ une recherche toutes les 10 secondes pour toute la salle,
  et 60 par heure pour la ligne GitHub. Si tout le monde lance sa recherche à la même seconde, beaucoup verront
  « Incertain ». Conseils à donner : chercher depuis son téléphone en 4G, ou attendre 10 secondes et relancer.
- **Rien ne casse et rien n'est facturé** : un dépassement donne seulement « Incertain » pendant quelques secondes.

## Si on veut faire mieux plus tard (pas fait)

Un petit relais sur notre serveur, avec une mémoire des réponses du jour, éviterait les « Incertain » en atelier. Mais
toutes les recherches sortiraient alors par l'adresse de 3h33, et les limites deviendraient celles de 3h33 : il faudrait
cette mémoire, et la demande d'un accès plus large à rdap.org.
- **Complexité : 35 %**.
- **Temps de programmation estimé : 3 à 4 h**.
- À ne faire que si les ateliers le demandent.
