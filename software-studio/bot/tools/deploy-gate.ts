import { prompt } from "@grok/agent-sdk";
import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";

type Gate = {
  status: "pending" | "approved" | "rejected";
  app: string;
  summary: string;
  humanPhrase: string;
  updatedAt: string;
};

export default defineTool({
  description: prompt`
    Lit ou met à jour le gate de publication prod.
    status=approved uniquement si Laurent a dit clairement go / déploie / en prod.
    status=get pour lire l'état. Sans approved, le CEO ne doit pas déléguer
    une publication au subagent deployer.
  `,
  effect: "idempotent",
  inputSchema: z.object({
    action: z.enum(["get", "approve", "reject", "reset"]),
    app: z.string().describe("Appli ou environnement cible"),
    summary: z
      .string()
      .optional()
      .describe("Ce qui serait publié (migrations, functions, hosting)"),
    humanPhrase: z
      .string()
      .optional()
      .describe("Citation courte du go / refus de Laurent"),
  }),
  async execute({ action, app, summary, humanPhrase }, ctx) {
    const key = `deploy-gate:${ctx.session.id}:${app}`;
    if (action === "get") {
      const current = (await ctx.host.kv.get(key)) as Gate | null;
      return {
        ok: true as const,
        key,
        gate: current,
        mayDeploy: current?.status === "approved",
      };
    }

    if (action === "reset") {
      await ctx.host.kv.delete(key);
      return { ok: true as const, key, gate: null, mayDeploy: false };
    }

    if (action === "approve" && !humanPhrase?.trim()) {
      return {
        ok: false as const,
        error:
          "approve exige humanPhrase : la citation du go explicite de Laurent.",
        mayDeploy: false,
      };
    }

    const gate: Gate = {
      status: action === "approve" ? "approved" : "rejected",
      app,
      summary: summary ?? "",
      humanPhrase: humanPhrase ?? "",
      updatedAt: new Date().toISOString(),
    };
    await ctx.host.kv.put(key, gate);
    return {
      ok: true as const,
      key,
      gate,
      mayDeploy: gate.status === "approved",
    };
  },
});
