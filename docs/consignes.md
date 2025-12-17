séparée  par workpace avec la même gestion des droits
done la possibilté d'avoir un arbre des taches exatement comem l'abre de dorcuementation perend le même avec les mêmes fontionnalité sauf que ce nesot pas des markdonw mais des taches donc a gauche l'arbre et à droire la vue de la tache avec les onglets comem tu a décrit dans test question 
il fut un onglet fichiers et i lfaut utilsie le markdown pour les des criptio neti il faut un onglet time line il faut en dessosu de la descritpiton pouvoir faire es comemntaire 
i lfaut reste r dans l''esprit markd comme pour l'arbrde de documentation 
il faut que loutils ce soit simple et fonctionnel, facile à lire et à comprendre 
il faut pour voir avoir des tache noramle puis d'autre soumises à validation ou à production il faut donc trouverune maléabilité 
on peut iamgeiner partir dune epic vers ues stories vers des tache vers sdesous taches 
mai on peu très  bien comemncer avec des stories ou juste des taches mais comme on a garder l'arbre de documantation comme principee naviagation drag and drop renomer etc ... ça nous permet une fleixiblité dynamiqeu en fonction des evenemnt 
donc prévoir des template de process du simple à celui qu'on veut du simple todo doing done àa todo doing validating done ou tout autre iamgination il faut que e soit dynamique on peux iamgeiner que les taches herite de chose de leur tache mere mais on peut très bien chager de tyoe deoricerr en cour de route  enfin surout c'est que ça oit dynalyque et que ça s'adapte aux situtation e la vie de tous les jours 
donc in garde une oganistion par workspace 
tout en websocket socketio si je change une status et qy'un autre user est connété sur la mee tache il vois le statut changer en même temps 

Page dédiée /tasks (comme le vault

Notifications temps réel (WebSocket
Emails pour les échéances 
Par workspace (comme les documents
Fonctionnalités souhaitées :
✅ Créer / Éditer / Supprimer des tâches
✅ Marquer comme complété / en cours / à faire
✅ Priorité (haute, moyenne, basse) ?
✅ Date d'échéance ?
✅ Tags / catégories ?
✅ Assignation à des users ?
✅ Commentaires sur les tâches ?
oui !
une tache peut être assigné à un tulsisateur ou à plusieur mas il y a facutltativent un responsable qui mene la danse 


Templates de workflow : Pour la v1, on commence avec quels templates pré-définis ?
a) Juste 2 templates : "Todo/Doing/Done" et "Todo/Doing/Validating/Done" (simple, on pourra ajouter la config admin plus tard) oui

Types de tâches : Epic/Story/Task/Subtask/subsubtask/subsubsubtask ...
b) Types configurables par l'admin dès le début avec champs personnalisables
Héritage des propriétés : 
c) Tout est hérité (assignés, responsable, tags, workflow, même dates d'échéance) mais peu être changé par la suite ou on peux dire appliquer au taches filles 
