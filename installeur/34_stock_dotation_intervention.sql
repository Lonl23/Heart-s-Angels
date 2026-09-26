-- ════════════════════════════════════════════════════════════════════════════
--  Répertoire du Sac intervention (sac ambulance) : types + emplacements.
--  Sans lots ni quantités. Idempotent. Après 33_stock_dotation_paramedic.sql.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public._stock_doter(p_lieu uuid, p_nom text, p_categorie text, p_mode text, p_unite text)
returns void language plpgsql as $$
declare
  a uuid;
begin
  a := public._stock_assurer_article(p_nom, p_categorie, p_mode, p_unite);
  insert into public.stock_dotation (lieu_id, catalogue_id) values (p_lieu, a) on conflict do nothing;
end $$;

do $$
declare
  sac uuid;
  p_sup uuid; p_kit_p uuid;
  p_inf uuid;
  p_gch uuid;
  p_drt uuid; p_intub uuid;
  p_gr_rouge uuid; p_inj1 uuid; p_perf1 uuid; p_perf2 uuid;
  p_pt_rouge uuid;
  p_pt_verte uuid;
  p_gr_med uuid; p_amp uuid;
  p_bleu uuid;
  p_jaune uuid;
  p_mauve uuid;
  p_vrac uuid;
begin
  sac := public._stock_assurer_lieu('Sac intervention', 'sac', null);

  p_sup := public._stock_assurer_lieu('Pochette supérieure extérieure', 'pochette', sac);
  p_kit_p := public._stock_assurer_lieu('Kit paramétrage', 'pochette', p_sup);
  p_inf := public._stock_assurer_lieu('Pochette inférieure extérieure', 'pochette', sac);
  p_gch := public._stock_assurer_lieu('Pochette extérieure gauche', 'pochette', sac);
  p_drt := public._stock_assurer_lieu('Pochette extérieure droite', 'pochette', sac);
  p_intub := public._stock_assurer_lieu('Kit intubation', 'pochette', p_drt);
  p_gr_rouge := public._stock_assurer_lieu('Grande pochette rouge', 'pochette', sac);
  p_inj1 := public._stock_assurer_lieu('Kit injection 1', 'pochette', p_gr_rouge);
  p_perf1 := public._stock_assurer_lieu('Kit perfusion 1', 'pochette', p_gr_rouge);
  p_perf2 := public._stock_assurer_lieu('Kit perfusion 2', 'pochette', p_gr_rouge);
  p_pt_rouge := public._stock_assurer_lieu('Petite pochette rouge', 'pochette', sac);
  p_pt_verte := public._stock_assurer_lieu('Petite pochette verte', 'pochette', sac);
  p_gr_med := public._stock_assurer_lieu('Grande pochette rouge médicaments', 'pochette', sac);
  p_amp := public._stock_assurer_lieu('Ampoularium kaki', 'pochette', p_gr_med);
  p_bleu := public._stock_assurer_lieu('Pochette bleue', 'pochette', sac);
  p_jaune := public._stock_assurer_lieu('Pochette jaune', 'pochette', sac);
  p_mauve := public._stock_assurer_lieu('Pochette mauve', 'pochette', sac);
  p_vrac := public._stock_assurer_lieu('En vrac dans le sac', 'pochette', sac);

  -- Kit paramétrage
  perform public._stock_doter(p_kit_p, 'Tensiomètre', 'matériel', 'durable', 'pièce');
  perform public._stock_doter(p_kit_p, 'Stéthoscope', 'matériel', 'durable', 'pièce');
  perform public._stock_doter(p_kit_p, 'Puls-oxymètre', 'matériel', 'durable', 'pièce');
  perform public._stock_doter(p_kit_p, 'Pile AAA', 'matériel', 'piece', 'pièce');
  perform public._stock_doter(p_kit_p, 'Thermomètre auriculaire', 'matériel', 'durable', 'pièce');
  perform public._stock_doter(p_kit_p, 'Bouchons pour thermomètre', 'matériel', 'piece', 'pièce');
  perform public._stock_doter(p_kit_p, 'Pile CR2032', 'matériel', 'piece', 'pièce');
  perform public._stock_doter(p_kit_p, 'Glucomètre', 'matériel', 'durable', 'pièce');
  perform public._stock_doter(p_kit_p, 'Lancettes', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_kit_p, 'Tigettes glucose', 'injection', 'piece', 'pièce');

  -- Reste pochette supérieure
  perform public._stock_doter(p_sup, 'Sac poubelle', 'hygiène', 'piece', 'pièce');
  perform public._stock_doter(p_sup, 'Lampe Bic AAA', 'matériel', 'durable', 'pièce');
  perform public._stock_doter(p_sup, 'Pile AAA', 'matériel', 'piece', 'pièce');
  perform public._stock_doter(p_sup, 'Paire de gants S', 'protection', 'piece', 'paire');
  perform public._stock_doter(p_sup, 'Paire de gants M', 'protection', 'piece', 'paire');
  perform public._stock_doter(p_sup, 'Paire de gants L', 'protection', 'piece', 'paire');
  perform public._stock_doter(p_sup, 'Paire de gants XL', 'protection', 'piece', 'paire');

  -- Pochette inférieure extérieure
  perform public._stock_doter(p_inf, 'Ballon REA adulte', 'respiration', 'durable', 'pièce');
  perform public._stock_doter(p_inf, 'Jeu de 6 canules', 'respiration', 'piece', 'jeu');
  perform public._stock_doter(p_inf, 'Pocket-mask', 'respiration', 'durable', 'pièce');
  perform public._stock_doter(p_inf, 'Spray silicone', 'matériel', 'piece', 'pièce');
  perform public._stock_doter(p_inf, 'Garrot tourniquet', 'pansement', 'durable', 'pièce');
  perform public._stock_doter(p_inf, 'Pansement israélien', 'pansement', 'piece', 'pièce');

  -- Pochette extérieure gauche (O₂ adulte)
  perform public._stock_doter(p_gch, 'Masque 100 % adulte', 'respiration', 'piece', 'pièce');
  perform public._stock_doter(p_gch, 'Masque aérosol adulte', 'respiration', 'piece', 'pièce');
  perform public._stock_doter(p_gch, 'Masque 60 % adulte', 'respiration', 'piece', 'pièce');
  perform public._stock_doter(p_gch, 'NaCl 100 ml', 'injection', 'piece', 'poche');
  perform public._stock_doter(p_gch, 'NaCl 500 ml', 'injection', 'piece', 'poche');
  perform public._stock_doter(p_gch, 'Lunettes O₂ adulte', 'respiration', 'piece', 'pièce');

  -- Kit intubation
  perform public._stock_doter(p_intub, 'Sonde endotrachéale 3,5', 'respiration', 'piece', 'pièce');
  perform public._stock_doter(p_intub, 'Sonde endotrachéale 4,0', 'respiration', 'piece', 'pièce');
  perform public._stock_doter(p_intub, 'Sonde endotrachéale 5,0', 'respiration', 'piece', 'pièce');
  perform public._stock_doter(p_intub, 'Sonde endotrachéale 6,0', 'respiration', 'piece', 'pièce');
  perform public._stock_doter(p_intub, 'Sonde endotrachéale 7,0', 'respiration', 'piece', 'pièce');
  perform public._stock_doter(p_intub, 'Sonde endotrachéale 8,0', 'respiration', 'piece', 'pièce');
  perform public._stock_doter(p_intub, 'Sonde endotrachéale 8,5', 'respiration', 'piece', 'pièce');
  perform public._stock_doter(p_intub, 'Pince de Magill', 'matériel', 'durable', 'pièce');
  perform public._stock_doter(p_intub, 'Guide tube grand', 'respiration', 'durable', 'pièce');
  perform public._stock_doter(p_intub, 'Guide tube petit', 'respiration', 'durable', 'pièce');
  perform public._stock_doter(p_intub, 'Cale-tube', 'respiration', 'piece', 'pièce');
  perform public._stock_doter(p_intub, 'Laryngoscope', 'matériel', 'durable', 'pièce');
  perform public._stock_doter(p_intub, 'Lame laryngoscope', 'matériel', 'piece', 'pièce');
  perform public._stock_doter(p_intub, 'Seringue 10 ml', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_intub, 'Pince de Péan', 'matériel', 'durable', 'pièce');
  perform public._stock_doter(p_intub, 'Ouvre-bouche', 'matériel', 'durable', 'pièce');

  -- Kit injection 1
  perform public._stock_doter(p_inj1, 'Seringue 10 ml', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_inj1, 'Seringue 5 ml', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_inj1, 'Aiguille 18G rose', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_inj1, 'Aiguille 21G verte', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_inj1, 'Aiguille 23G bleue', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_inj1, 'Aiguille 25G orange', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_inj1, 'Tampon alcool', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_inj1, 'Rustine', 'pansement', 'piece', 'pièce');
  perform public._stock_doter(p_inj1, 'Compresse 5cm x 5cm', 'pansement', 'piece', 'pièce');
  perform public._stock_doter(p_inj1, 'Tampon ouate', 'injection', 'piece', 'pièce');

  -- Kit perfusion 1
  perform public._stock_doter(p_perf1, 'Trousse à perfusion', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_perf1, 'Prolongateur 3 voies', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_perf1, 'Garrot', 'injection', 'durable', 'pièce');
  perform public._stock_doter(p_perf1, 'Tegaderm', 'pansement', 'piece', 'pièce');
  perform public._stock_doter(p_perf1, 'Cathéter 18G', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_perf1, 'Cathéter 20G', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_perf1, 'Cathéter 22G', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_perf1, 'Compresse 5cm x 5cm', 'pansement', 'piece', 'pièce');
  perform public._stock_doter(p_perf1, 'Tampon ouate', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_perf1, 'Bouchons', 'confort', 'piece', 'pièce');
  perform public._stock_doter(p_perf1, 'Tampon alcool', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_perf1, 'NaCl 500 ml', 'injection', 'piece', 'poche');

  -- Kit perfusion 2
  perform public._stock_doter(p_perf2, 'Trousse à perfusion', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_perf2, 'Prolongateur 3 voies', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_perf2, 'Garrot', 'injection', 'durable', 'pièce');
  perform public._stock_doter(p_perf2, 'Tegaderm', 'pansement', 'piece', 'pièce');
  perform public._stock_doter(p_perf2, 'Cathéter 18G', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_perf2, 'Cathéter 20G', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_perf2, 'Cathéter 22G', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_perf2, 'Compresse 5cm x 5cm', 'pansement', 'piece', 'pièce');
  perform public._stock_doter(p_perf2, 'Tampon ouate', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_perf2, 'Bouchons', 'confort', 'piece', 'pièce');
  perform public._stock_doter(p_perf2, 'Tampon alcool', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_perf2, 'Perfusion glucose 500 ml', 'injection', 'piece', 'poche');
  perform public._stock_doter(p_perf2, 'Kit perfusion port-à-cath', 'injection', 'piece', 'kit');

  -- Petite pochette rouge
  perform public._stock_doter(p_pt_rouge, 'Couverture alu', 'matériel', 'durable', 'pièce');
  perform public._stock_doter(p_pt_rouge, 'Triangle tissu', 'pansement', 'piece', 'pièce');
  perform public._stock_doter(p_pt_rouge, 'Compressif', 'pansement', 'piece', 'pièce');

  -- Petite pochette verte
  perform public._stock_doter(p_pt_verte, 'Compresse 5cm x 5cm', 'pansement', 'piece', 'pièce');
  perform public._stock_doter(p_pt_verte, 'Compresse 10cm x 10cm', 'pansement', 'piece', 'pièce');
  perform public._stock_doter(p_pt_verte, 'Chlorhexidine spray', 'hygiène', 'piece', 'pièce');
  perform public._stock_doter(p_pt_verte, 'NaCl 5 ml', 'injection', 'piece', 'ampoule');
  perform public._stock_doter(p_pt_verte, 'Iso-bétadine 5 ml', 'hygiène', 'piece', 'ampoule');
  perform public._stock_doter(p_pt_verte, 'Paracétamol 1 g', 'médicament', 'piece', 'comprimé');
  perform public._stock_doter(p_pt_verte, 'Hibidil 15 ml', 'hygiène', 'piece', 'ampoule');
  perform public._stock_doter(p_pt_verte, 'Crème solaire', 'confort', 'piece', 'pièce');
  perform public._stock_doter(p_pt_verte, 'Calmiderm', 'médicament', 'piece', 'pièce');

  -- Grande pochette rouge médicaments
  perform public._stock_doter(p_gr_med, 'Aqua Stérop 10 ml', 'injection', 'piece', 'ampoule');
  perform public._stock_doter(p_gr_med, 'Midazolam 5 mg / 1 ml', 'médicament', 'piece', 'ampoule');
  perform public._stock_doter(p_gr_med, 'Rinofluix 10 ml', 'médicament', 'piece', 'pièce');
  perform public._stock_doter(p_gr_med, 'Alprazolam 1 mg', 'médicament', 'piece', 'comprimé');
  perform public._stock_doter(p_gr_med, 'Buscopan Forte', 'médicament', 'piece', 'comprimé');
  perform public._stock_doter(p_gr_med, 'Ibuprofène 600 mg', 'médicament', 'piece', 'comprimé');
  perform public._stock_doter(p_gr_med, 'Imodium 2 mg', 'médicament', 'piece', 'comprimé');
  perform public._stock_doter(p_gr_med, 'Litican 50 mg', 'médicament', 'piece', 'comprimé');
  perform public._stock_doter(p_gr_med, 'Oxynorm instant 5 mg', 'médicament', 'piece', 'comprimé');
  perform public._stock_doter(p_gr_med, 'Rcalm 50 mg', 'médicament', 'piece', 'comprimé');
  perform public._stock_doter(p_gr_med, 'Rivotril 2,5 mg/ml gouttes', 'médicament', 'piece', 'flacon');
  perform public._stock_doter(p_gr_med, 'Tradonal Odis 50 mg', 'médicament', 'piece', 'comprimé');
  perform public._stock_doter(p_gr_med, 'MS Direct 10 mg', 'médicament', 'piece', 'comprimé');
  perform public._stock_doter(p_gr_med, 'Crémicort 1 %', 'médicament', 'piece', 'pièce');
  perform public._stock_doter(p_gr_med, 'EpiPen', 'médicament', 'piece', 'pièce');
  perform public._stock_doter(p_gr_med, 'Medrol 32 mg', 'médicament', 'piece', 'comprimé');
  perform public._stock_doter(p_gr_med, 'Dafalgan 1 g', 'médicament', 'piece', 'comprimé');

  -- Ampoularium kaki
  perform public._stock_doter(p_amp, 'Valium 10 mg / 10 ml', 'médicament', 'piece', 'ampoule');
  perform public._stock_doter(p_amp, 'Litican 50 mg / 2 ml', 'médicament', 'piece', 'ampoule');
  perform public._stock_doter(p_amp, 'Buscopan 20 mg / ml', 'médicament', 'piece', 'ampoule');
  perform public._stock_doter(p_amp, 'Scopolamine 0,50 mg / 1 ml', 'médicament', 'piece', 'ampoule');
  perform public._stock_doter(p_amp, 'Morphine 10 mg / 1 ml', 'médicament', 'piece', 'ampoule');

  -- Pochette bleue (pédiatrique)
  perform public._stock_doter(p_bleu, 'Masque pédiatrique 100 %', 'respiration', 'piece', 'pièce');
  perform public._stock_doter(p_bleu, 'Masque aérosol enfant', 'respiration', 'piece', 'pièce');
  perform public._stock_doter(p_bleu, 'Lunettes O₂ enfant', 'respiration', 'piece', 'pièce');
  perform public._stock_doter(p_bleu, 'Perfusion glucose 500 ml', 'injection', 'piece', 'poche');

  -- Pochette jaune
  perform public._stock_doter(p_jaune, 'Bandage auto-adhésif 10 cm', 'pansement', 'piece', 'pièce');
  perform public._stock_doter(p_jaune, 'Bandage auto-adhésif 5 cm', 'pansement', 'piece', 'pièce');
  perform public._stock_doter(p_jaune, 'Mefix 10 cm × 50', 'pansement', 'piece', 'pièce');
  perform public._stock_doter(p_jaune, 'Mefix transparent 10 cm', 'pansement', 'piece', 'pièce');
  perform public._stock_doter(p_jaune, 'Rouleau de sparadrap 2 cm', 'pansement', 'piece', 'pièce');
  perform public._stock_doter(p_jaune, 'Rouleau de sparadrap 1 cm', 'pansement', 'piece', 'pièce');
  perform public._stock_doter(p_jaune, 'Pansements prédécoupés bleu', 'pansement', 'piece', 'pièce');
  perform public._stock_doter(p_jaune, 'Petit ciseaux de brancardier', 'matériel', 'durable', 'pièce');

  -- Pochette mauve
  perform public._stock_doter(p_mauve, 'Bande Velpeau 15 cm', 'pansement', 'piece', 'pièce');
  perform public._stock_doter(p_mauve, 'Bande Velpeau 10 cm', 'pansement', 'piece', 'pièce');
  perform public._stock_doter(p_mauve, 'Bande Velpeau 7 cm', 'pansement', 'piece', 'pièce');
  perform public._stock_doter(p_mauve, 'Bande Velpeau 5 cm', 'pansement', 'piece', 'pièce');

  -- En vrac
  perform public._stock_doter(p_vrac, 'Bac à aiguilles', 'hygiène', 'durable', 'pièce');
  perform public._stock_doter(p_vrac, 'Collier cervical adulte', 'matériel', 'durable', 'pièce');
  perform public._stock_doter(p_vrac, 'Aspi-venin', 'matériel', 'durable', 'pièce');
  perform public._stock_doter(p_vrac, 'Kit sondage urinaire', 'matériel', 'piece', 'kit');
  perform public._stock_doter(p_vrac, 'Gants stériles taille 8,5', 'protection', 'piece', 'paire');
  perform public._stock_doter(p_vrac, 'Seringue 50 ml', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_vrac, 'Iso-bétadine unidose', 'hygiène', 'piece', 'ampoule');
  perform public._stock_doter(p_vrac, 'Kit sondage gastrique', 'matériel', 'piece', 'kit');
  perform public._stock_doter(p_vrac, 'Seringue 60 ml', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_vrac, 'Seringue 10 ml', 'injection', 'piece', 'pièce');
  perform public._stock_doter(p_vrac, 'Adaptateur', 'matériel', 'piece', 'pièce');
end $$;
