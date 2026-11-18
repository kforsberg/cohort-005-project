import { data } from "react-router";
import type { Route } from "./+types/api.prototype-notifications.token";
import { signUserToken } from "@knocklabs/node";
import { getCurrentUserId } from "~/lib/session";

export async function loader({ request }: Route.LoaderArgs) {
  if (!import.meta.env.DEV) {
    throw data("Not found", { status: 404 });
  }

  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Select a user from the DevUI panel.", { status: 401 });
  }

  const publicApiKey = process.env.KNOCK_PUBLIC_API_KEY;
  const signingKey = process.env.KNOCK_SIGNING_KEY;
  if (!publicApiKey || !signingKey) {
    throw data("Knock prototype keys are missing from the local environment.", {
      status: 503,
    });
  }

  const knockUserId = `cadence-dev-user-${currentUserId}`;
  const userToken = await signUserToken(knockUserId, {
    signingKey,
    expiresInSeconds: 3600,
  });

  return {
    knockUserId,
    userToken,
    publicApiKey,
    feedChannelId: process.env.KNOCK_FEED_CHANNEL_ID ?? null,
  };
}
