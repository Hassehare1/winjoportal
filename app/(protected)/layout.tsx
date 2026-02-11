import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/ui/portal-shell";
import { SESSION_COOKIE_NAME } from "@/features/auth/server/constants";
import { readPortalSessionFromToken } from "@/features/auth/server/session";

export default async function ProtectedLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = readPortalSessionFromToken(token);

  if (!session.authenticated) {
    redirect("/login");
  }

  return <PortalShell>{children}</PortalShell>;
}
