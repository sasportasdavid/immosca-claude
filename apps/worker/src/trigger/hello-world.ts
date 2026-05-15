import { logger, task } from "@trigger.dev/sdk/v3";
import { z } from "zod";

const helloPayloadSchema = z.object({
  name: z.string().default("ImmoScan"),
});

/**
 * Task de bootstrap pour valider la connexion Trigger.dev.
 * À supprimer après la PR1.
 */
export const helloWorldTask = task({
  id: "hello-world",
  maxDuration: 30,
  run: async (payload: unknown) => {
    const { name } = helloPayloadSchema.parse(payload);
    logger.info("ImmoScan worker is alive", { name });
    return { greeting: `Salut ${name}, le worker tourne.` };
  },
});
