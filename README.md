# Moteur de site Digipart Commerce

Le site d'une boutique en ligne construite dans Digipart (onglets de la boutique, éditeur du site, bibliothèque de thèmes). Un seul moteur pour toutes les boutiques : celle qu'il affiche est le canal de vente nommé dans son environnement. Tout ce qu'il montre est lu dans Digipart par `api/storefront`.

## Ce qu'il sait faire aujourd'hui

- Page d'accueil et pages de contenu (onglet Pages), en-tête, pied de page, réglages du thème (couleurs, formes, largeur).
- Sections : bannière, carrousel, groupe de bannières, image et texte, texte, newsletter (formulaire dessiné), formulaire de contact (dessiné), contenu de page.
- Langues : la langue est dans l'adresse (`/en/...`), selon le réglage de la boutique.
- Site fermé : la page « Maintenance » ou « Bientôt disponible » réglée dans Digipart (Configuration > Paramètres > Site), avec son image, son logo, sa date et ses adresses autorisées. Un lien d'aperçu passe outre.
- Aperçu d'un thème : le lien « Prévisualiser sur le site » de la bibliothèque de thèmes (`?preview=<jeton>`, valable une semaine), avec une barre en bas de page.

## Ce qu'il ne fait pas encore

Menu Digipart dans l'en-tête et le pied de page, produits (sélections, catalogue, fiche produit), panier, commande, compte client, lookbooks, stories, réseaux sociaux, envoi des formulaires, polices du thème servies par le site, cache vidé à la publication.

## Configuration

Copier `.env.example` en `.env` et renseigner :

| Variable | Rôle |
|---|---|
| `DIGIPART_URL` | L'adresse du back-office Digipart de la boutique |
| `ID_MARKET_PLACE` | Le canal de vente du site |
| `CLIENT_ID`, `CLIENT_SECRET` | La clé du site (Configuration > Interface). Elle reste sur ce serveur, le navigateur ne la voit jamais |
| `CACHE_SECONDS` | Durée de garde d'une réponse de Digipart, en secondes (300 par défaut ; vidée dès que la boutique publie) |
| `WARM_PAGES` | Réchauffement des pages après un démarrage ou une publication : `0` pour le couper, `1` pour l'avoir aussi en local |

Ne jamais commiter `.env`.

## Lancer en local (sur la machine où Digipart est installé)

Aucune clé n'est nécessaire : le moteur lit directement le Digipart local (`dev/bridge.php`), pour le canal de vente n° 1 par défaut. Le site répond sur `https://storefront.digipart.fr` (MAMP fait suivre vers le moteur, voir plus bas) et sur `http://127.0.0.1:3100`.

| Besoin | Commande |
|---|---|
| Première fois, ou après un `git pull` | `npm install` |
| Construire puis lancer le site (le plus rapide à l'usage) | `npm run local` |
| Relancer sans reconstruire | `npm run local:start` |
| Travailler sur le code du moteur (rechargement à chaud, plus lent) | `npm run local:dev` |
| Arrêter le site | `npm run local:stop` |

À savoir :

- `npm run dev` seul ne suffit pas en local : il lance bien Nuxt, mais sans dire où est Digipart. Utiliser `npm run local:dev`, qui fait la même chose avec les bons réglages.
- Après une modification du code (`app/`, `server/`), il faut reconstruire : `npm run local:stop` puis `npm run local`. En mode `local:dev`, ce n'est pas nécessaire.
- Un autre canal de vente : `sh dev/start-local.sh 3` (ou `sh dev/dev-local.sh 3`).
- Digipart ailleurs que dans `../app/local.digipart.fr/app.digipart.fr` : `DIGIPART_APP=/chemin/vers/app.digipart.fr npm run local:start`.
- Le port 3100 est déjà pris : le site tourne déjà ; `npm run local:stop` l'arrête.
- Le site ne montre pas un changement fait dans Digipart : une publication dans l'éditeur, un logo ou une mise en scène se voient en quelques secondes ; un produit ou un menu, sous 30 secondes. La liste des produits d'une catégorie est en plus gardée en cache par Digipart lui-même.
- Le terminal doit rester ouvert tant que le site tourne (Ctrl+C l'arrête).

## Lancer avec une clé (comme en production)

Remplir `.env` à partir de `.env.example` (voir « Configuration »), puis :

```bash
npm install
npm run build
npm run start
```

Le moteur écoute sur `127.0.0.1:3100`.

## En local avec MAMP

Ce dossier est aussi la racine du sous-domaine MAMP `storefront.digipart.fr`. `.htaccess` envoie toute requête à `proxy.php`, qui la passe au moteur (port 3100) : aucun fichier du dossier n'est servi tel quel. Si le moteur est arrêté, le sous-domaine répond une erreur : lancer `npm run local`.

## Docker (Coolify ou tout hôte Docker)

Le `Dockerfile` construit le moteur en deux étapes (construction, puis une image légère qui ne garde que `.output`), tourne sans droits particuliers et écoute sur le port 3000. **Aucun secret dans l'image** : on les donne au conteneur au démarrage, avec le préfixe `NUXT_` (le moteur les relit à ce moment-là) :

| Variable | Rôle |
|---|---|
| `NUXT_DIGIPART_URL` | L'adresse du back-office Digipart de production |
| `NUXT_ID_MARKET_PLACE` | Le canal de vente du site |
| `NUXT_CLIENT_ID`, `NUXT_CLIENT_SECRET` | La clé du front |
| `NUXT_CACHE_SECONDS` | Durée de garde d'une réponse de Digipart (300) |
| `NUXT_WARM_PAGES` | `0` coupe le réchauffement des pages (actif par défaut) |
| `NUXT_GOOGLE_PLACES_KEY`, `NUXT_RETURN_PORTAL_URL` | Facultatives |

Sur Coolify : méthode de construction « Dockerfile », port exposé 3000, domaine du site, variables ci-dessus **sans** « disponible à la construction ». Le contrôle de santé du Dockerfile vérifie seulement que le port répond (un site fermé ou un Digipart arrêté ne rend pas le conteneur « mort »).

```bash
docker build -t storefront .
docker run --rm -p 3000:3000 -e NUXT_DIGIPART_URL=... -e NUXT_ID_MARKET_PLACE=... -e NUXT_CLIENT_ID=... -e NUXT_CLIENT_SECRET=... storefront
```

`package-lock.json` doit rester à jour (`npm install` après tout changement de `package.json`) : la construction utilise `npm ci`, qui refuse un fichier de verrouillage en retard.

## En production

Le moteur vit hors de la racine web ; le serveur web fait suivre les requêtes vers son port. `.htaccess` et `proxy.php` ne servent pas.
