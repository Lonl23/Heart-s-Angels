import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";

const ZONES = ["coque", "ecrans", "terrain", "revue"] as const;

const ecrans = [
  { chemin: "/login", zone: "coque", role: "Connexion du personnel et des partenaires." },
  { chemin: "/inscription", zone: "coque", role: "Création de compte avec un code d'invitation." },
  { chemin: "/demande", zone: "ecrans", role: "Formulaire public de demande de souhait." },
  { chemin: "/app", zone: "ecrans", role: "Tableau de bord et accès rapides." },
  { chemin: "/app/souhaits", zone: "ecrans", role: "Tableau des souhaits et demandes reçues." },
  { chemin: "/app/souhaits/nouveau", zone: "ecrans", role: "Encodage d'un souhait." },
  { chemin: "/app/souhaits/:id", zone: "ecrans", role: "Dossier et préparation." },
  { chemin: "/app/missions", zone: "terrain", role: "Liste des missions affectées." },
  { chemin: "/app/missions/:id", zone: "terrain", role: "Exécution terrain. La barre du bas est masquée." },
  { chemin: "/app/disponibilites", zone: "ecrans", role: "Agenda. Sur téléphone, la vue du jour est la vue de départ." },
  { chemin: "/app/stock", zone: "ecrans", role: "Lieux, articles, pièces. Les pièces sont des cartes sur téléphone." },
  { chemin: "/app/annuaire", zone: "ecrans", role: "Contacts, institutions, accompagnants." },
  { chemin: "/app/admin", zone: "ecrans", role: "Membres, partenaires, matrice d'accès." },
  { chemin: "/app/profil", zone: "ecrans", role: "Fiche du volontaire." },
  { chemin: "/app/defraiements", zone: "ecrans", role: "Écran encore vide." },
  { chemin: "/partenaire", zone: "ecrans", role: "Portail des partenaires." },
] as const;

const agents = {
  coque: "Barre du bas, feuille Plus, retour, zones sûres, connexion.",
  ecrans: "Pages, formulaires, listes et agenda, sans le déroulé terrain.",
  terrain: "Mission affectée : checklists, photos, médicaments, bouton d'action.",
  revue: "Relecture. Aucune modification.",
} as const;

export default defineTool({
  description: "Carte des parcours Heart's Angels et de l'agent du studio qui en est responsable. Appelle-la avant de modifier l'application.",
  inputSchema: z.object({
    zone: z.enum(ZONES).optional().describe("Limiter la carte à un agent. Omettre pour tout voir."),
  }),
  effect: "read",
  execute({ zone }) {
    if (!zone) return { agents, ecrans: [...ecrans] };
    return {
      zone,
      agent: agents[zone],
      ecrans: ecrans.filter((e) => e.zone === zone),
    };
  },
});
