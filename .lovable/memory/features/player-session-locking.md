---
name: Session Locking
description: Verrouillage session unique par écran (15s) + option admin global allow_multi_session pour partager un lien player sur plusieurs écrans
type: feature
---
- Par défaut, un seul player peut lire un lien `/player/:key` : verrou via `player_session_id` + heartbeat 5s, expiration 15s, reprise auto.
- Colonne `screens.allow_multi_session` (bool, défaut false) : si true, le player ignore le verrou (pas d'état `sessionBlocked`, heartbeat sans filtre de session) et le trigger `screens_anon_update_guard` laisse passer.
- L'option est exposée uniquement à l'admin global, bouton icône `Copy` sur la carte écran (onglet Écrans).
- `resolve_player_screen` renvoie `allow_multi_session`; anon a un GRANT SELECT sur cette colonne.
