---
name: Video Walls
description: Mur d'écrans en grille rows×cols. Une seule source découpée via WallTile (scale + translate). Création génère N écrans dédiés liés via wall_id/wall_row/wall_col.
type: feature
---
- Table `video_walls` (rows, cols 1-10, establishment_id, user_id).
- Colonnes ajoutées sur `screens` : wall_id, wall_row, wall_col.
- Création via `VideoWallDialog` génère automatiquement rows×cols écrans nommés `[r-c]`.
- Chaque écran joue le MÊME média/playlist mais le composant `WallTile` dans Player.tsx scale par (cols, rows) et translate par (-col, -row) pour afficher uniquement sa tuile.
- Quota établissement vérifié à la création (rows*cols).
- Suppression du mur détache les écrans (wall_id → NULL) sans les supprimer.
