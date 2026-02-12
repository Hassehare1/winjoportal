import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/features/auth/server/constants";
import { readPortalSessionFromToken } from "@/features/auth/server/session";

type RefreshRequestBody = {
  adminKey?: string;
};

function parseRepositoryCoordinates(): { owner: string; repo: string } | null {
  const owner = process.env.GITHUB_REPO_OWNER ?? process.env.VERCEL_GIT_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME ?? process.env.VERCEL_GIT_REPO_SLUG;
  if (!owner || !repo) return null;
  return { owner, repo };
}

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = readPortalSessionFromToken(sessionToken);
  if (!session.authenticated) {
    return NextResponse.json({ error: "Ej inloggad." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as RefreshRequestBody | null;
  const providedAdminKey = body?.adminKey?.trim();
  const expectedAdminKey = process.env.ANALYTICS_REFRESH_ADMIN_KEY?.trim();

  if (!expectedAdminKey) {
    return NextResponse.json(
      { error: "ANALYTICS_REFRESH_ADMIN_KEY saknas i server-konfigurationen." },
      { status: 503 }
    );
  }

  if (!providedAdminKey || providedAdminKey !== expectedAdminKey) {
    return NextResponse.json({ error: "Endast admin far trigga datahamtning." }, { status: 403 });
  }

  const triggerToken = process.env.GITHUB_ACTIONS_TRIGGER_TOKEN?.trim();
  if (!triggerToken) {
    return NextResponse.json(
      { error: "GITHUB_ACTIONS_TRIGGER_TOKEN saknas i server-konfigurationen." },
      { status: 503 }
    );
  }

  const repo = parseRepositoryCoordinates();
  if (!repo) {
    return NextResponse.json(
      { error: "GitHub repo-owner/repo-name saknas i server-konfigurationen." },
      { status: 503 }
    );
  }

  const workflowFile = process.env.GITHUB_ANALYTICS_WORKFLOW_FILE?.trim() || "analytics-refresh.yml";
  const ref = process.env.GITHUB_ANALYTICS_WORKFLOW_REF?.trim() || "main";
  const dispatchUrl = `https://api.github.com/repos/${repo.owner}/${repo.repo}/actions/workflows/${workflowFile}/dispatches`;

  const dispatchResponse = await fetch(dispatchUrl, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${triggerToken}`,
      "Content-Type": "application/json",
      "User-Agent": "winjoportal-analytics-refresh"
    },
    body: JSON.stringify({
      ref,
      inputs: {
        trigger_source: "portal_button"
      }
    }),
    cache: "no-store"
  });

  if (!dispatchResponse.ok) {
    const detail = (await dispatchResponse.text().catch(() => "")).slice(0, 600);
    return NextResponse.json(
      {
        error: "Kunde inte starta GitHub workflow for datahamtning.",
        detail
      },
      { status: 502 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      message: "Datahamtning startad. Uppdatera sidan efter att workflow-korning ar klar."
    },
    { status: 202 }
  );
}

