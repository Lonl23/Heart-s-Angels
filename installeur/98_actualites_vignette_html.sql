-- La vignette d’une actualité peut être un bloc HTML
-- (image, titre, chapô). Vide : la photo, le titre et le chapô habituels restent affichés.

alter table public.actualites
  add column if not exists vignette_html text;

comment on column public.actualites.vignette_html is
  'HTML de la vignette. S’il est rempli, il remplace la photo, le titre et le chapô sur la carte.';

notify pgrst, 'reload schema';
