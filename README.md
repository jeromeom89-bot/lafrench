# La French · Arcade social club

Application web solo et multijoueur avec 7 jeux, salon de discussion, tables à deux joueurs, amis locaux et classement de session. Interface française responsive, thème néon végétal.

## Démarrer

Node.js 24, puis :

```sh
npm ci --cache /tmp/lafrench-npm
npm start
```

Le serveur écoute sur le port 3000 (`PORT` pour changer). Ouvrir l’application dans deux navigateurs avec deux pseudos pour jouer ensemble. Les deux joueurs doivent rejoindre le même serveur. `npm run dev` active le redémarrage du serveur lors des modifications. `npm test` vérifie réellement deux connexions WebSocket, le chat, une partie et le classement.

## Jeux

- Fléchettes : cible à secteurs, 6 lancers par joueur, score total.
- Ping-pong : duel de raquettes, premier à 7.
- Air hockey : variante arcade à palets, premier à 7.
- Billard : prototype simplifié à visée, une bille touchée rapporte un point ; ce n’est pas une simulation des règles du billard.

## Périmètre

Profils invités sans authentification. La liste d’amis est conservée dans le navigateur par pseudo, sans demande réciproque. Présence, salons, messages et classement sont en mémoire et disparaissent au redémarrage. Les égalités aux jeux de score sont départagées en faveur du créateur de table. Aucun joueur fictif ni faux classement.

Avant une ouverture publique : comptes authentifiés, base de données, modération, protections anti-abus, invitations privées et règles/physique complètes pour chaque jeu. Servir derrière HTTPS pour chiffrer les WebSockets. Les polices Google sont facultatives : les polices système prennent le relais hors réseau.

## Déploiement sur Render

Le fichier `render.yaml` prépare un service Node.js unique avec WebSocket et contrôle de santé. Pousser le projet dans GitHub, puis sur Render créer un **Blueprint** à partir du dépôt et appliquer la configuration. Render fournit l’adresse HTTPS du service après un déploiement réussi. Aucune clé n’est à ajouter au code.

Le plan gratuit peut mettre le service en veille : premier chargement plus lent et état en mémoire perdu lors d’un redémarrage. Utiliser une seule instance pour ce prototype. Ne pas remplacer le serveur par un hébergement uniquement statique : le multijoueur dépend de Node.js et des WebSockets.

## Mode solo et nouveaux jeux

Sélectionner **Solo** au-dessus des jeux pour démarrer immédiatement : ping-pong et air hockey contre un robot ; fléchettes en défi de 6 tirs ; billard simplifié en entraînement pour vider la table. Les tables à deux restent disponibles via **Multijoueur**.

Trois cartes supplémentaires lancent toujours une partie solo :

- **Snake** : flèches du clavier ou boutons tactiles, fruits à manger, murs et corps à éviter.
- **Casse-briques** : souris, doigt ou flèches gauche/droite, 40 briques et 3 vies.
- **Memory** : 8 paires à retrouver en le moins d’essais possible.

Les records solo sont conservés dans `localStorage` sur cet appareil : plus de points/fruits pour les jeux à score, moins de coups/essais pour les billard et Memory terminés. Ils ne sont jamais ajoutés au classement multijoueur. Les simulations solo tournent dans le navigateur et continuent si la connexion au salon est interrompue ; elles s’arrêtent en quittant la partie.

Validation : `npm test` couvre les règles et fins de partie des 7 jeux solo ainsi qu’une partie multijoueur complète. L’interface a aussi été vérifiée dans Chromium : lancement des 7 jeux, relance, retour au multijoueur et contrôles mobiles.
