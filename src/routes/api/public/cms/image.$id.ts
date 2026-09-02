import { createFileRoute } from "@tanstack/react-router";
import { restHeaders, supabaseUrl } from "@/lib/cms-shared";

export const Route = createFileRoute("/api/public/cms/image/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = String(params.id).replace(/[^a-f0-9-]/gi, "");
        const res = await fetch(
          `${supabaseUrl()}/rest/v1/site_images?select=mime,data&id=eq.${id}&limit=1`,
          { headers: restHeaders() },
        );
        if (!res.ok) return new Response("not found", { status: 404 });
        const rows = (await res.json()) as { mime: string; data: string }[];
        const row = rows[0];
        if (!row) return new Response("not found", { status: 404 });

        const binary = atob(row.data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        return new Response(bytes, {
          headers: {
            "Content-Type": row.mime,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
