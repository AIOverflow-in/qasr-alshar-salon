// Owner/salon notification recipients — booking alerts, shop-order alerts, the
// daily takings digest and payment reminders all go to these. A FIXED list (not
// an env var) so a stale/misconfigured env can never leak them to a personal
// inbox. Customer-facing emails still go to the customer's own address.
// Pure (no server-only/resend) so it can be unit-tested.
export const NOTIFY_EMAILS = [
  "admin@qasralsharsalon.com",
  "aioverflow.ml@gmail.com",
];
