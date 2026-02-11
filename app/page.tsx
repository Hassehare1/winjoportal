import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME } from "@/features/auth/server/constants";
import { readPortalSessionFromToken } from "@/features/auth/server/session";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = readPortalSessionFromToken(token);

  if (session.authenticated) {
    redirect("/dashboard");
  }

  redirect("/login");
}
