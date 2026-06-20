import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { Emblem } from "@/components/Logo";

export const metadata = { title: "Admin Login", robots: { index: false } };

export default async function AdminLoginPage() {
  const session = await getSession();
  if (session) redirect("/admin");

  return (
    <div className="grid min-h-svh place-items-center bg-ink px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Emblem className="mx-auto h-14 w-14" />
          <h1 className="mt-4 font-display text-2xl text-cream">Qasr Alshar Admin</h1>
          <p className="text-sm text-muted">Sign in to manage your salon</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
