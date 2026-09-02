import { createFileRoute } from "@tanstack/react-router";
import {
  SESSION_COOKIE,
  adminPassword,
  adminUser,
  createSessionToken,
  json,
  requireSession,
} from "@/lib/cms-shared";

export const Route = createFileRoute("/api/public/cms/login")({
  server: {
    handlers: {
      GET: async ({ request }) => json({ authenticated: await requireSession(request) }),
      POST: async ({ request }) => {
        let body: { username?: string; password?: string } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "invalid body" }, { status: 400 });
        }
        if ((body.username || "") !== adminUser() || (body.password || "") !== adminPassword()) {
          return json({ error: "ভুল ইউজারনেম বা পাসওয়ার্ড" }, { status: 401 });
        }
        const token = await createSessionToken();
        return json(
          { ok: true },
          {
            headers: {
              "Set-Cookie": `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`,
            },
          },
        );
      },
    },
  },
});
