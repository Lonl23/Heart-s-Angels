/* ════════════════════════════════════════════════════════════════════════════
 *  ⚙️  CONFIGURATION — LE SEUL FICHIER À MODIFIER (éditable sans recompiler)
 *  Ce fichier est déployé À CÔTÉ de l'application compilée. Renseignez ici les
 *  informations propres à l'organisation et à son serveur, puis rechargez la page.
 * ════════════════════════════════════════════════════════════════════════════ */
window.__APP_CONFIG__ = {
  organisation: {
    nom:     "Heart's Angels ASBL",
    forme:   "ASBL",              // "ASBL" (BE) | "Association loi 1901" (FR)…
    pays:    "BE",
    langue:  "fr",
    devise:  "EUR",
    tauxKm:  0.4201,              // barème kilométrique (BE 2026 : 0.4201 €/km)
    accent:  "#1BB0CE",
    logoUrl: "/icons/ha-logo-512-v4.png",
  },
  domaine: "https://heart-s-angels.web.app",
  supabase: {
    url:     "https://vppmvjqbzdeftrhdoert.supabase.co",
    anonKey: "sb_publishable_A_Bu4P4-Fn-sy3xF58U4Cg_kJ_aLSIH",
  },
}
