import { createFileRoute } from "@tanstack/react-router";
import {
  type CmsItem,
  dbSecret,
  json,
  patchFiles,
  patchSettingsFiles,
  requireSession,
  restHeaders,
  supabaseUrl,
} from "@/lib/cms-shared";

export const Route = createFileRoute("/api/public/cms/save")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await requireSession(request))) return json({ error: "unauthorized" }, { status: 401 });

        let body: { page?: string; items?: CmsItem[] } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "invalid body" }, { status: 400 });
        }
        const page = (body.page || "").replace(/[^a-z0-9-]/gi, "");
        const items = (body.items || []).filter((i) => i && typeof i.cms_id === "string");
        if (!page || items.length === 0) return json({ error: "nothing to save" }, { status: 400 });

        const res = await fetch(`${supabaseUrl()}/rest/v1/rpc/cms_save_content`, {
          method: "POST",
          headers: restHeaders(),
          body: JSON.stringify({
            p_secret: dbSecret(),
            p_page: page,
            p_items: items.map((i) => ({ cms_id: i.cms_id, kind: i.kind || "text", value: i.value ?? "" })),
          }),
        });
        if (!res.ok) return json({ error: await res.text() }, { status: 500 });

        if (page === "site-settings") {
          // merge with what is already stored so a font-only save keeps the colour
          let merged = items;
          try {
            const cur = await fetch(
              `${supabaseUrl()}/rest/v1/site_content?select=cms_id,kind,value&page=eq.site-settings`,
              { headers: restHeaders() },
            );
            if (cur.ok) {
              const rows = (await cur.json()) as CmsItem[];
              const byId: Record<string, CmsItem> = {};
              for (const r of rows) byId[r.cms_id] = r;
              for (const i of items) byId[i.cms_id] = i;
              merged = Object.values(byId);
            }
          } catch {
            /* fall back to just the new items */
          }
          const patchedSettings = await patchSettingsFiles(merged);
          return json({ ok: true, saved: items.length, patched: patchedSettings });
        }

        const patched = await patchFiles(page, items);
        return json({ ok: true, saved: items.length, patched });
      },
    },
  },
});
