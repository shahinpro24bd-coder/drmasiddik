import { createFileRoute } from "@tanstack/react-router";
import { dbSecret, json, requireSession, restHeaders, supabaseUrl } from "@/lib/cms-shared";

export const Route = createFileRoute("/api/public/cms/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await requireSession(request))) return json({ error: "unauthorized" }, { status: 401 });

        let body: { mime?: string; data?: string } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "invalid body" }, { status: 400 });
        }
        const mime = (body.mime || "image/png").split(";")[0]!;
        const data = (body.data || "").replace(/^data:[^,]+,/, "");
        if (!/^image\//.test(mime) || !data) return json({ error: "invalid image" }, { status: 400 });
        if (data.length > 8_000_000) return json({ error: "image too large (max ~6MB)" }, { status: 413 });

        const res = await fetch(`${supabaseUrl()}/rest/v1/rpc/cms_save_image`, {
          method: "POST",
          headers: restHeaders(),
          body: JSON.stringify({ p_secret: dbSecret(), p_mime: mime, p_data: data }),
        });
        if (!res.ok) return json({ error: await res.text() }, { status: 500 });
        const id = String(await res.json()).replace(/"/g, "");
        return json({ ok: true, id, url: `/api/public/cms/image/${id}` });
      },
    },
  },
});
