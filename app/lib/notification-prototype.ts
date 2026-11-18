export const PROTOTYPE_WORKFLOW_KEY = "cadence-prototype-feed";

export const NOTIFICATION_EXAMPLES = {
  enrollment_ready: {
    label: "Enrollment ready · Student",
    title: "Your enrollment is ready",
    body: "Your course is ready to start. Pick up where you left off in your dashboard.",
    href: "/dashboard",
    category: "Enrollment",
  },
  refund_review: {
    label: "Refund request · Platform Admin",
    title: "A refund request needs review",
    body: "A learner submitted a refund request. Review the request and record an outcome.",
    href: "/admin/refunds",
    category: "Refunds",
  },
  question_attention: {
    label: "New question · Instructor",
    title: "A student has a question",
    body: "A learner asked a question on one of your courses. Open the question to reply.",
    href: "/instructor/questions",
    category: "Questions",
  },
  seat_claimed: {
    label: "Seat claimed · Team Admin",
    title: "A seat was claimed",
    body: "A learner claimed a seat on your Team Licence.",
    href: "/team",
    category: "Team Licence",
  },
} as const;

export type NotificationExampleKey = keyof typeof NOTIFICATION_EXAMPLES;
