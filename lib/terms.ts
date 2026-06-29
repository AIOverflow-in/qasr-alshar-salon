/**
 * Qasr Alshar Salon — Terms & Conditions (single source of truth).
 * Rendered on /terms, linked from booking + footer, and summarised on the invoice.
 * Plain data so it stays easy to review and edit.
 */

export const TERMS_UPDATED = "June 2026";

export type TermsSection = { heading: string; body: string[] };

export const TERMS: TermsSection[] = [
  {
    heading: "Agreement to Terms",
    body: [
      "By booking an appointment or placing an order with Qasr Alshar Salon — online, by phone, on WhatsApp, or in person — you agree to these Terms & Conditions. Please read them before confirming your booking.",
    ],
  },
  {
    heading: "Bookings & Confirmation",
    body: [
      "An online booking reserves your preferred time and is confirmed by our team. We may contact you on WhatsApp or by phone to confirm details, especially for home and clinic visits.",
      "Prices shown are starting points and may vary with hair length, density, and the exact service performed. Your final price is confirmed at the salon before the service begins.",
    ],
  },
  {
    heading: "Payment",
    body: [
      "Payment is due at the time of service, by cash or card. We do not take online payment at booking.",
      "All prices are in UAE Dirhams (AED) and include 5% VAT. A deposit may be requested during peak periods or for larger bookings; any deposit is applied to your final bill.",
    ],
  },
  {
    heading: "Punctuality & Lateness",
    body: [
      "Please arrive on time so we can give you the full service you booked. A 15-minute grace period applies.",
      "Beyond 15 minutes, a late charge of AED 100 per 30 minutes may apply, and we may need to shorten or reschedule your service so the next guest is not delayed.",
    ],
  },
  {
    heading: "Cancellations & No-Shows",
    body: [
      "If you need to change or cancel, please let us know at least 24 hours in advance.",
      "Cancellations within 24 hours, or no-shows, may be charged, and any deposit may be retained. Repeated no-shows may require a deposit for future bookings.",
    ],
  },
  {
    heading: "Home & Clinic Visits",
    body: [
      "Home and clinic appointments are confirmed by the salon before they are final. Please provide an accurate address and a contactable number.",
      "A minimum order value may apply depending on your area; our team will confirm it with you on WhatsApp when arranging the visit. Any travel or logistics are included in the quoted price and are never charged separately.",
    ],
  },
  {
    heading: "Your Comfort, Health & Results",
    body: [
      "Please tell us about allergies, sensitivities, recent treatments, or any scalp or skin conditions before your service so we can care for you safely.",
      "Results can vary with your natural hair and skin. We will always advise honestly on what is achievable and recommend the right aftercare to protect your results.",
    ],
  },
  {
    heading: "Gift Cards & Packages",
    body: [
      "Gift cards and packages are subject to their own validity and usage terms, shared at the time of purchase. They are non-refundable and cannot be exchanged for cash.",
    ],
  },
  {
    heading: "Privacy & Contact",
    body: [
      "We keep your contact and booking details to manage your appointments and, with your consent, to share offers. We never sell your information.",
      "Questions about these terms? Call or WhatsApp us on +971 4 272 7616, or email hello@qasralshar.ae.",
    ],
  },
];
