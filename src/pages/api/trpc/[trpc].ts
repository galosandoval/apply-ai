import { createNextApiHandler } from "@trpc/server/adapters/next";

import { env } from "~/env.mjs";
import { appRouter } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";

export const config = {
  // Parsing a resume means a PDF read plus an OpenAI round trip, which runs
  // past the default serverless timeout on a long resume.
  maxDuration: 60,
  api: {
    // The resume import posts a base64-encoded PDF: 8MB of file inflates to
    // ~10.7MB of base64, well past the 1mb default.
    bodyParser: { sizeLimit: "12mb" }
  }
};

// export API handler
export default createNextApiHandler({
  router: appRouter,
  createContext: createTRPCContext,
  onError:
    env.NODE_ENV === "development"
      ? ({ path, error }) => {
          console.error(
            `❌ tRPC failed on ${path ?? "<no-path>"}: ${error.message}`
          );
        }
      : undefined,
});
