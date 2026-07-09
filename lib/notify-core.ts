// Owner/salon notification recipients — booking alerts, shop-order alerts, the
// daily takings digest and payment reminders all go to these. A FIXED list (not
// an env var) so a stale/misconfigured env can never leak them to a personal
// inbox. Customer-facing emails still go to the customer's own address.
// Pure (no server-only/resend) so it can be unit-tested.
export const NOTIFY_EMAILS = [
  "jacquelineekumba2010@gmail.com",
  "aioverflow.ml@gmail.com",
  "admin@qasralsharsalon.com",
];
