# La French · Arcade social club

Arcade française responsive : 7 jeux, solo et tables multijoueurs à deux, tchat, présence, amis locaux et classement de session.

## Développement

Node.js 24 :

```sh
npm ci --cache /tmp/lafrench-npm
npm start
```

Port 3000, variable `PORT` pour changer. `npm run dev` redémarre le serveur après modification. `npm test` vérifie le moteur et les échanges multijoueurs. Ouvrir deux navigateurs avec deux pseudos, sur le même serveur, pour jouer à deux.

## Jeux

- **Billard arcade à 9 billes** : physique avec impulsion, collisions, friction, bandes, six poches et faute de la blanche. Maintenir pour doser puis relâcher pour frapper dans la direction visée. Une bille empochée rapporte un point et conserve le tour ; sinon le tour change. La blanche revient à une position libre après une faute. En solo, vider la table en le moins de coups possible. Il s’agit de règles arcade, pas des règles officielles du 9-ball.
- **Fléchettes 301** : score exact à atteindre, trois tirs par volée, dépassement annulant la volée, dix volées maximum par joueur. La barre verte stabilise la visée au relâchement. En multijoueur, le premier à zéro gagne ; au bout des dix volées, le score restant le plus bas gagne, ou égalité. Sortie simple, pas de double obligatoire.
- **Air hockey** : maillets mobiles en 2D, collisions selon la vitesse du maillet, buts dans les ouvertures latérales, murs et friction. Premier à 7, robot en solo.
- **Ping-pong arcade** : raquettes verticales, angle selon le point de contact, accélération plafonnée, compteur d’échanges et robot en solo. Premier à 7 ; vue arcade de dessus, pas une simulation 3D de tennis de table.
- **Snake** : directions mises en file, clavier, balayage ou boutons tactiles, vitesse progressive, fruits, collisions avec murs et corps.
- **Casse-briques** : service manuel, trois niveaux, briques renforcées, combos, trois vies, bonus raquette large et balle lente. Souris, doigt ou clavier.
- **Memory** : aperçu initial, cartes à retourner, huit paires, nombre d’essais, durée et séries de bonnes réponses.

## Contrôles et confort

Pause solo (bouton ou P), pause automatique au changement d’onglet, relance, plein écran si le navigateur le permet, sons synthétisés facultatifs. Les flèches servent aussi au multijoueur. Espace maintenu/relâché permet de charger et tirer au billard et aux fléchettes ; Espace sert la balle au casse-briques. Les niveaux de difficulté changent la visée des fléchettes, la vitesse de Snake et celle du robot.

Records solo conservés sur cet appareil par jeu et difficulté (`localStorage`), distincts des victoires multijoueurs. Les anciens records du premier prototype ne sont pas réutilisés car les règles ont changé.

## Architecture et limites

`public/solo.js` contient le moteur partagé, utilisé dans le navigateur en solo et sur le serveur en multijoueur. `public/renderer.js` dessine les terrains. Le serveur contrôle la physique, les tours et les scores multijoueurs ; les clients envoient leurs mouvements et leurs tirs.

Profils invités sans authentification. Amis locaux par pseudo, sans demande réciproque. Présence, salons, messages et classement sont en mémoire et disparaissent au redémarrage. Une seule instance serveur pour ce prototype. Avant ouverture publique à grande échelle : comptes, base de données, modération et protections anti-abus.

## Déploiement Render

`render.yaml` déclare le serveur Node avec WebSockets et contrôle de santé `/health`. Créer un Blueprint sur le dépôt GitHub, branche `main`, puis appliquer la configuration. Les mises à jour de `main` peuvent être déployées automatiquement ; sinon sélectionner **Manual Deploy → Deploy latest commit**.

Le plan gratuit peut mettre le service en veille ; premier chargement plus lent et état perdu au redémarrage. Utiliser HTTPS pour chiffrer le trafic. Un hébergement statique seul ne fait pas tourner le multijoueur. Les polices Google sont facultatives, avec repli système.

## Validation

Tests de règles : 301/bust, collisions et poches de billard, faute, alternance des tours, angles de raquette, buts de hockey, Snake, bonus/niveaux/vies de casse-briques, aperçu et paires de Memory, pause. Test WebSocket : deux joueurs, tchat, défi 301 complet et classement. Vérifications Chromium sur les sept jeux, interactions souris/clavier, pause, difficulté, mobile et hockey à deux navigateurs.
