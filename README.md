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

- **Billard 9-ball** : rack en losange avec la 1 devant et la 9 au centre. Premier contact sur la plus petite bille, puis au moins une bande ou une bille empochée. Empocher légalement la 9 gagne la partie ; la 9 empochée sur faute est replacée. Faute = blanche en main, à placer avec un clic dans une zone libre. Puissance dosée, rétro/coulé et effet latéral simplifiés, décélération de roulement, collisions, mâchoires de poches et animation d’empochage. Guide de visée jusqu’au premier contact. Les règles particulières de casse, le push-out et les coups sautés ne sont pas implémentés.
- **Fléchettes 301** : secteurs dans l’ordre standard, anneaux aux proportions réglementaires, bull 25/50, trois fléchettes par volée, animation de vol et interdiction de relancer avant l’impact. Double final par défaut (bull 50 valable) ; laisser 1, dépasser zéro ou atteindre zéro sans double annule la volée. Une option permet la sortie libre. Dix volées maximum par joueur ; au terme du défi, le score restant le plus bas gagne. Visée légèrement mobile et stabilisation au maintien.
- **Air hockey** : saisie du maillet à la souris ou au doigt, suivi direct en 2D sans inertie pour les humains, déplacement progressif pour le robot, collision selon la vitesse du maillet, restitution et faible friction du palet. Poteaux physiques, validation du passage complet dans le but, remise en jeu après un point. Un palet bloqué contre une paroi ou entre les deux maillets arrête les maillets au contact. Premier à 7, robot en solo.
- **Ping-pong arcade** : raquettes verticales, angle selon le point de contact, accélération plafonnée, compteur d’échanges et robot en solo. Premier à 7 ; vue arcade de dessus.
- **Snake** : directions mises en file, clavier, balayage ou boutons tactiles, vitesse progressive, fruits, collisions avec murs et corps.
- **Casse-briques** : service manuel, trois niveaux, briques renforcées, combos, trois vies, bonus raquette large et balle lente. Souris, doigt ou clavier.
- **Memory** : aperçu initial, cartes à retourner, huit paires, nombre d’essais, durée et séries de bonnes réponses.

## Contrôles et confort

Pause solo (bouton ou P), suspension temporaire quand l’onglet devient masqué avec reprise automatique au retour, relance, plein écran si le navigateur le permet, sons synthétisés facultatifs. Les flèches servent aussi au multijoueur. Espace maintenu/relâché permet de charger et tirer au billard et aux fléchettes ; Espace sert la balle au casse-briques. Les niveaux de difficulté changent la visée des fléchettes, la vitesse de Snake et celle du robot.

Records solo conservés sur cet appareil par jeu et difficulté (`localStorage`), distincts des victoires multijoueurs. Les records de versions antérieures ne sont pas réutilisés pour ces nouvelles règles.

## Architecture et limites

`public/solo.js` contient le moteur partagé, utilisé dans le navigateur en solo et sur le serveur en multijoueur. `public/renderer.js` dessine les terrains. La physique utilise un pas fixe de 1/120 seconde, indépendamment de la fréquence d’affichage. Le serveur contrôle les tours et les scores multijoueurs ; les clients envoient mouvements, effets, placements et tirs. `public/network.js` interpole les positions entre les états reçus avec un tampon de 65 ms et réinitialise le tampon lors des buts et des nouvelles manches. Les décors de billard, hockey et fléchettes sont mis en cache pour éviter de les recalculer à chaque image.

Profils invités sans authentification. Amis locaux par pseudo, sans demande réciproque. Présence, salons, messages et classement sont en mémoire et disparaissent au redémarrage. Une seule instance serveur pour ce prototype. Avant ouverture publique à grande échelle : comptes, base de données, modération et protections anti-abus.

## Déploiement Render

`render.yaml` déclare le serveur Node avec WebSockets et contrôle de santé `/health`. Créer un Blueprint sur le dépôt GitHub, branche `main`, puis appliquer la configuration. Les mises à jour de `main` peuvent être déployées automatiquement ; sinon sélectionner **Manual Deploy → Deploy latest commit**.

Le plan gratuit peut mettre le service en veille ; premier chargement plus lent et état perdu au redémarrage. Utiliser HTTPS pour chiffrer le trafic. Un hébergement statique seul ne fait pas tourner le multijoueur. Les polices Google sont facultatives, avec repli système.

## Validation

Tests : vol et doubles de fléchettes, bust, rack et premier contact, poches/faute/placement de blanche, remise en place de la 9, victoire, conservation des tours, poteaux et palets coincés de hockey, anti-traversée à haute vitesse. Comparaison de simulations à 30, 60 et 144 FPS et interpolation de paquets irréguliers. Régressions sur les quatre autres jeux et pause. Test WebSocket : deux joueurs, tchat, défi 301 complet avec double final et classement. Vérifications Chromium sur PC, paramètres d’effet, placement, animation de fléchette, contrôles clavier en butée, hockey à deux navigateurs et absence de débordement mobile.

La vérification de fluidité a été répétée dans Chromium avec deux clients et un délai réseau variable de 45 à 90 ms dans chaque sens : médiane et 95e percentile d’intervalle de rendu de 16,7 ms sur cette machine. Les effets de flou de la fenêtre ont été supprimés et le canvas isolé pour limiter le coût de composition. Cette mesure décrit le test local, pas les performances de tous les PC ou du service Render.

## Mises à jour automatiques

Le Blueprint cible explicitement `main` et active `autoDeploy`. Si le service a été créé manuellement ou si un réglage a été changé dans Render, vérifier une fois **Settings → Build & Deploy → Auto-Deploy → On Commit** et la branche `main`. Un push déclenche alors le déploiement ; le nouveau site devient accessible à la même adresse après réussite du déploiement. Un déploiement en échec laisse l’ancienne version active. Le HTML est servi sans stockage en cache ; scripts et styles sont revalidés à chaque chargement. Les pages déjà ouvertes doivent être rechargées pour récupérer le nouveau code.

## Contrôle du hockey sur téléphone et PC

Maintenir le maillet puis glisser : capture du pointeur, conservation du point de saisie et trajectoire directe. Le maillet reste posé après relâchement ; le survol seul ne le déplace plus. Une zone de saisie tactile plus large facilite la prise du maillet sur un petit écran. Le mouvement rapide est balayé par segments de 4 unités maximum pour garder les collisions fiables. Les frontières de la moitié de table et les contacts solides restent contraignants. Les flèches permettent toujours de jouer sur PC.

Une simple perte de focus (clavier virtuel, focus du navigateur) ne déclenche plus une pause. Un véritable masquage d’onglet suspend la partie solo ; elle reprend au retour si la pause était automatique. Une pause manuelle reste active. En multijoueur, les positions restent contrôlées par le serveur : la latence réseau peut toujours retarder légèrement le retour visuel.

Vérification Chromium : événements tactiles natifs via émulation mobile, prise hors centre, changements de direction, relâchement, perte de focus, masquage et retour, pause manuelle, souris sur PC et maillet du joueur droit à deux navigateurs. Aucun test sur un téléphone physique dans cet environnement.
