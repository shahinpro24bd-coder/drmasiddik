
CREATE TABLE public.site_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page text NOT NULL,
  cms_id text NOT NULL,
  kind text NOT NULL DEFAULT 'text',
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page, cms_id)
);

CREATE TABLE public.site_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mime text NOT NULL,
  data text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cms_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

INSERT INTO public.cms_config (key, value) VALUES ('db_secret', 'lovable-cms-db-secret-2026');

GRANT SELECT ON public.site_content TO anon, authenticated;
GRANT SELECT ON public.site_images TO anon, authenticated;
GRANT ALL ON public.site_content TO service_role;
GRANT ALL ON public.site_images TO service_role;
GRANT ALL ON public.cms_config TO service_role;

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read site content" ON public.site_content FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public can read site images" ON public.site_images FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.cms_save_content(p_secret text, p_page text, p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
  v_item jsonb;
  v_count integer := 0;
BEGIN
  SELECT value INTO v_secret FROM public.cms_config WHERE key = 'db_secret';
  IF v_secret IS NULL OR p_secret IS NULL OR p_secret <> v_secret THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.site_content (page, cms_id, kind, value, updated_at)
    VALUES (p_page, v_item->>'cms_id', COALESCE(v_item->>'kind', 'text'), COALESCE(v_item->>'value', ''), now())
    ON CONFLICT (page, cms_id)
    DO UPDATE SET value = EXCLUDED.value, kind = EXCLUDED.kind, updated_at = now();
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.cms_save_image(p_secret text, p_mime text, p_data text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secret text;
  v_id uuid;
BEGIN
  SELECT value INTO v_secret FROM public.cms_config WHERE key = 'db_secret';
  IF v_secret IS NULL OR p_secret IS NULL OR p_secret <> v_secret THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  INSERT INTO public.site_images (mime, data) VALUES (p_mime, p_data) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cms_save_content(text, text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cms_save_image(text, text, text) TO anon, authenticated, service_role;
