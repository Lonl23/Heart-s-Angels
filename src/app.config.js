// © 2026 Heart's Angels ASBL & Laurent Noulin — Tous droits réservés.
// Logiciel propriétaire. Voir LICENSE. Mention à ne pas retirer.
// ────────────────────────────────────────────────────────────────────────────
// La configuration réelle est dans /public/config.js (chargé à l'exécution),
// pour rester modifiable APRÈS compilation, sans toucher au code. Ce module
// se contente de la lire et de fournir des valeurs de repli.
const runtime = (typeof window !== 'undefined' && window.__APP_CONFIG__) || {}
const d = {
  organisation: { nom: "Application", forme: "", pays: "BE", langue: "fr", devise: "EUR", tauxKm: 0.4201, accent: "#1BB0CE", logoUrl: "/icons/ha-logo-512-v4.png" },
  domaine: "",
  supabase: { url: "https://vppmvjqbzdeftrhdoert.supabase.co", anonKey: "sb_publishable_A_Bu4P4-Fn-sy3xF58U4Cg_kJ_aLSIH" },
  bases: [
    {
      nom: 'Solumob Jemeppe-sur-Meuse',
      adresse: { rue: 'Rue sous les vignes', numero: '8', cp: '4101', localite: 'Seraing', pays: 'Belgique' },
    },
  ],
}
export default {
  ...d, ...runtime,
  organisation: { ...d.organisation, ...(runtime.organisation || {}) },
  supabase:     { ...d.supabase,     ...(runtime.supabase || {}) },
  bases:        (runtime.bases && runtime.bases.length) ? runtime.bases : d.bases,
}
