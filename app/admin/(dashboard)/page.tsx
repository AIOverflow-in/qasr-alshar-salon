import { redirect } from "next/navigation";

// The full ERP at /erp is the single back-office now. The old /admin overview
// is retired — send anyone landing here straight to the ERP dashboard.
export default function AdminIndex() {
  redirect("/erp");
}
