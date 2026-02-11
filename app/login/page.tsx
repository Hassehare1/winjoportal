import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/components/login-form";
import { SESSION_COOKIE_NAME } from "@/features/auth/server/constants";
import { readPortalSessionFromToken } from "@/features/auth/server/session";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = readPortalSessionFromToken(token);

  if (session.authenticated) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center p-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-sky-700">
          Client Portal
        </p>
        <h1 className="font-heading text-3xl font-bold text-slate-900">
          Logga in
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Ange delat lösenord för att komma åt dashboarden.
        </p>
        <div className="mt-8">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
