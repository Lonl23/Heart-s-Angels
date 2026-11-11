import { prompt } from "@grok/agent-sdk";
import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";

type Brief = {
  app: string;
  goal: string;
  stage: string;
  agents: string[];
  notes: string;
  updatedAt: string;
};

export default defineTool({
  description: prompt`
    Enregistre ou met à jour le brief projet de la session
    (app, objectif, étape du circuit, agents prévus, notes).
    À appeler après clarification avec Laurent, avant de déléguer.
  `,
  effect: "idempotent",
  inputSchema: z.object({
    app: z.string().describe("Nom de l'appli ou du repo concerné"),
    goal: z.string().describe("Objectif en une phrase"),
    stage: z
      .string()
      .describe(
        "Étape circuit : intake | product | design | build | control | await-go | deploy | docs | done",
      ),
    agents: z
      .array(z.string())
      .describe("Subagents prévus pour ce passage"),
    notes: z.string().optional().describe("Contraintes ou contexte court"),
  }),
  async execute({ app, goal, stage, agents, notes }, ctx) {
    const key = `brief:${ctx.session.id}`;
    const brief: Brief = {
      app,
      goal,
      stage,
      agents,
      notes: notes ?? "",
      updatedAt: new Date().toISOString(),
    };
    await ctx.host.kv.put(key, brief);
    return { ok: true as const, key, brief };
  },
});
