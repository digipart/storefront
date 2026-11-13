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

Ne jamais commiter `.env`.

## Lancer

```bash
npm install
npm run build
npm run start
```

Le moteur écoute sur `127.0.0.1:3100`.

## En local avec MAMP

Ce dossier est aussi la racine du sous-domaine MAMP. `.htaccess` envoie toute requête à `proxy.php`, qui la passe au moteur : aucun fichier du dossier n'est servi tel quel. Si Digipart est en HTTPS avec un certificat local, Node doit l'accepter : lancer avec `NODE_TLS_REJECT_UNAUTHORIZED=0 npm run start` (en local uniquement).

## En production

Le moteur vit hors de la racine web ; le serveur web fait suivre les requêtes vers son port. `.htaccess` et `proxy.php` ne servent pas.
