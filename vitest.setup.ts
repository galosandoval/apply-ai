/**
 * The integration tests read `TEST_DATABASE_URL`, and importing the tRPC router
 * pulls in `~/env`, which validates `DATABASE_URL` and friends. Next loads
 * `.env` for the app; vitest runs outside Next, so it loads it here.
 */
import "dotenv/config"
