type AuthEventType = "login_success" | "login_failure" | "login_blocked" | "logout";

type AuthLogMeta = {
  ip: string;
  detail?: string;
};

export function logAuthEvent(event: AuthEventType, meta: AuthLogMeta) {
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      scope: "auth",
      event,
      ...meta
    })
  );
}
