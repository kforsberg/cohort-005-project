import { data } from "react-router";
import { z } from "zod";
import Knock from "@knocklabs/node";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/api.prototype-notifications.trigger";
import { db } from "~/db";
import { users } from "~/db/schema";
import { getCurrentUserId } from "~/lib/session";
import {
  NOTIFICATION_EXAMPLES,
  PROTOTYPE_WORKFLOW_KEY,
} from "~/lib/notification-prototype";

const triggerSchema = z.object({
  example: z.enum([
    "enrollment_ready",
    "refund_review",
    "question_attention",
    "seat_claimed",
  ]),
});

export async function action({ request }: Route.ActionArgs) {
  if (!import.meta.env.DEV) {
    throw data("Not found", { status: 404 });
  }

  const currentUserId = await getCurrentUserId(request);
  if (!currentUserId) {
    throw data("Select a user from the DevUI panel.", { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = triggerSchema.safeParse(body);
  if (!parsed.success) {
    throw data("Choose a sample Notification from the agreed catalogue.", {
      status: 400,
    });
  }

  const apiKey = process.env.KNOCK_API_KEY;
  if (!apiKey) {
    throw data("KNOCK_API_KEY is missing from the local environment.", {
      status: 503,
    });
  }

  const user = db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, currentUserId))
    .get();
  if (!user) {
    throw data("The selected DevUI user no longer exists.", { status: 404 });
  }

  const example = NOTIFICATION_EXAMPLES[parsed.data.example];
  const knock = new Knock({ apiKey });

  try {
    const result = await knock.workflows.trigger(PROTOTYPE_WORKFLOW_KEY, {
      recipients: [
        {
          id: `cadence-dev-user-${currentUserId}`,
          name: user.name,
        },
      ],
      data: {
        title: example.title,
        body: example.body,
        href: example.href,
        category: example.category,
      },
    });

    return { workflowRunId: result.workflow_run_id };
  } catch (error) {
    console.error("Knock notification prototype trigger failed:", error);
    throw data(
      "Knock could not queue this sample. Check the development workflow setup and try again.",
      { status: 502 }
    );
  }
}
