# Déployer la fonction « admin-users » (une seule fois par serveur)

Cette fonction permet à l'admin de créer/gérer les comptes depuis l'app.
Elle se pose UNE fois, après l'installeur. Deux méthodes — la plus simple d'abord.

## Méthode A — via l'interface Supabase (sans rien installer)
1. Ouvrez le tableau de bord Supabase du serveur → menu **Edge Functions**.
2. **Create a new function**, nommez-la exactement : `admin-users`.
3. Ouvrez le fichier `supabase/functions/admin-users/index.ts` du projet,
   copiez tout son contenu, collez-le dans l'éditeur, puis **Deploy**.
4. C'est tout : les clés (URL, service_role, anon) sont fournies automatiquement
   à la fonction par Supabase — rien à configurer.

## Méthode B — via le Supabase CLI (si vous l'avez déjà)
```
supabase link --project-ref <ref-du-projet>
supabase functions deploy admin-users
```

## Vérification
Dans l'app, connectez-vous en admin → Administration → « + Nouveau membre ».
Si le compte se crée sans erreur, la fonction est bien en place.

Tant que la fonction n'est pas déployée, la création de comptes affiche une
erreur, mais le reste de l'application fonctionne normalement.
