# Suivi fiable des mises à jour d’écran

## Objectif
- Ne plus considérer le simple passage hors ligne comme une modification.
- Marquer explicitement une modification de configuration comme en attente.
- Effacer automatiquement l’attente lorsque le player reçoit et applique la mise à jour.

## Mise en œuvre
1. Ajouter un suivi côté base qui place une action de resynchronisation uniquement lorsqu’un champ de configuration ou de contenu de l’écran change, sans réagir aux battements de connexion.
2. Conserver l’acquittement existant du player : dès qu’il traite la resynchronisation, l’attente est supprimée.
3. Mettre à jour « Écrans connectés » :
   - écran hors ligne sans action : « À jour » ;
   - écran hors ligne avec modification : « En attente de connexion » ;
   - écran connecté pendant traitement : « Synchronisation en cours » ;
   - après traitement : « À jour ».
4. Vérifier les états avec les contrôles automatisés ciblés.

## Détails techniques
- Le déclencheur ignore les champs d’exécution comme le statut, le heartbeat, la session player et les adresses réseau.
- Les commandes d’alimentation existantes restent distinctes et conservent leur libellé.
