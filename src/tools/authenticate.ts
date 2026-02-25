import { authenticateInteractive, isGoogleLoggedIn } from "../browser/google-auth.js";
import { browserManager } from "../browser/browser-manager.js";
import { logger } from "../utils/logger.js";

export async function authenticate() {
  logger.info("authenticate tool called");

  // Check if already logged in
  const context = await browserManager.launchPersistentContext({ headed: true });
  const page = context.pages()[0] || (await context.newPage());
  const loggedIn = await isGoogleLoggedIn(page);

  if (loggedIn) {
    await context.close();
    return {
      status: "already_authenticated",
      message: "Google account is already logged in via persistent profile.",
    };
  }

  await context.close();

  // Open headed browser for interactive login
  const newContext = await authenticateInteractive();
  await newContext.close();

  return {
    status: "authenticated",
    message: "Google login successful. Credentials saved in persistent Chrome profile.",
  };
}
