-- Corps HTML en plus des blocs. Le collage Word est nettoyé avant l'enregistrement.

alter table public.actualites
  add column if not exists format text not null default 'blocs',
  add column if not exists html text;

do $$ begin
  alter table public.actualites
    add constraint actualites_format_check check (format in ('blocs', 'html'));
exception when duplicate_object then null;
end $$;

comment on table public.actualites is
  'Nouvelles de l’ASBL. format=blocs : suite de blocs. format=html : corps HTML (code ou collage Word nettoyé).';

notify pgrst, 'reload schema';
