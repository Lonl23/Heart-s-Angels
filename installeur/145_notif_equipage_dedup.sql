-- © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
-- Ne plus empiler « Équipage incomplet » chaque matin.
-- Cause : dedup_minutes=1200 (20 h) < 24 h entre deux digests → nouvelle alerte
-- alors que l’ancienne non traitée restait visible.
-- Fix : pour les alertes d’équipe (partagées) avec ref, ne pas recréer tant
-- qu’une notification existe encore (Traitée la supprime → rappel possible ensuite).
-- Idempotent.

create or replace function public.notifier_evenement(
  p_type text,
  p_titre text,
  p_message text,
  p_lien text default '/app',
  p_priorite text default 'normale',
  p_cibles uuid[] default null,
  p_ref uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns int
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  ids uuid[] := '{}';
  n int := 0;
  dest uuid;
  nid uuid;
  partage boolean;
  gid uuid;
  minutes int;
  sans boolean;
begin
  partage := public.notification_est_partagee(p_type);
  sans := coalesce((p_payload->>'sans_dedup')::boolean, false);
  minutes := coalesce((p_payload->>'dedup_minutes')::int, 7 * 24 * 60);
  if partage then gid := gen_random_uuid(); end if;

  for dest in select d.id from public.destinataires_notification(p_type, p_cibles) d
  loop
    if not sans and p_ref is null and exists (
      select 1 from public.notifications x
      where x.destinataire_id = dest and x.type = p_type
        and x.created_at::date = current_date
    ) then
      continue;
    end if;
    -- Alerte d’équipe encore présente (non « Traitée ») → pas de doublon.
    if not sans and p_ref is not null and partage and exists (
      select 1 from public.notifications x
      where x.destinataire_id = dest and x.type = p_type and x.ref_id = p_ref
        and coalesce(x.payload->>'creneau', '') = coalesce(p_payload->>'creneau', '')
    ) then
      continue;
    end if;
    -- Alerte personnelle : fenêtre de dédup inchangée.
    if not sans and p_ref is not null and not partage and exists (
      select 1 from public.notifications x
      where x.destinataire_id = dest and x.type = p_type and x.ref_id = p_ref
        and coalesce(x.payload->>'creneau', '') = coalesce(p_payload->>'creneau', '')
        and x.created_at > now() - make_interval(mins => minutes)
    ) then
      continue;
    end if;

    insert into public.notifications(destinataire_id, type, titre, message, lien, priorite, ref_id, payload, groupe_id, dans_appli)
      values (
        dest, p_type, p_titre, p_message, p_lien, p_priorite, p_ref, coalesce(p_payload, '{}'::jsonb), gid,
        not (
          public.notification_push_seulement(p_type)
          or coalesce((p_payload->>'push_seulement')::boolean, false)
        )
      )
      returning id into nid;

    ids := ids || nid;
    n := n + 1;
  end loop;

  perform public._declencher_push(ids);
  return n;
end
$$;

revoke all on function public.notifier_evenement(text, text, text, text, text, uuid[], uuid, jsonb) from public, anon;
grant execute on function public.notifier_evenement(text, text, text, text, text, uuid[], uuid, jsonb) to authenticated, service_role;

-- Nettoyage : une seule alerte « équipage incomplet » par destinataire / souhait.
with ranked as (
  select id,
    row_number() over (
      partition by destinataire_id, type, ref_id
      order by created_at desc, id desc
    ) as rn
  from public.notifications
  where type = 'equipage_incomplet'
    and ref_id is not null
)
delete from public.notifications n
using ranked r
where n.id = r.id and r.rn > 1;

notify pgrst, 'reload schema';
