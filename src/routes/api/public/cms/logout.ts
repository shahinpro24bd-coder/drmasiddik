import { createFileRoute } from "@tanstack/react-router";
import { SESSION_COOKIE, json } from "@/lib/cms-shared";

export const Route = createFileRoute("/api/public/cms/logout")({
  server: {
    handlers: {
      POST: async () =>
        json(
          { ok: true },
          { headers: { "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` } },
        ),
    },
  },
});
