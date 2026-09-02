import { createFileRoute } from "@tanstack/react-router";
import { json, restHeaders, supabaseUrl } from "@/lib/cms-shared";

export const Route = createFileRoute("/api/public/cms/content")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const page = new URL(request.url).searchParams.get("page") || "index";
        try {
          const res = await fetch(
            `${supabaseUrl()}/rest/v1/site_content?select=cms_id,kind,value&page=eq.${encodeURIComponent(page)}`,
            { headers: restHeaders() },
          );
          if (!res.ok) return json({ page, items: [], error: await res.text() });
          return json({ page, items: await res.json() });
        } catch (e) {
          return json({ page, items: [], error: String(e) });
        }
      },
    },
  },
});
