"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    try {
      setPending(true);
      setError(null);
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (!response.ok) {
        throw new Error("Kunde inte logga ut.");
      }

      router.push("/login");
      router.refresh();
    } catch (logoutError) {
      const message = logoutError instanceof Error ? logoutError.message : "Okänt fel vid utloggning.";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {error ? (
        <p className="text-xs text-danger" role="status">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={handleLogout}
        disabled={pending}
        className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Loggar ut..." : "Logga ut"}
      </button>
    </div>
  );
}
