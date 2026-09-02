# Vercel Deployment Guide

This site is a static HTML/CSS/JS website (served from `public/`) with a small
TanStack Start backend that powers the visual-edit CMS.

## 1. Build settings

| Setting | Value |
| --- | --- |
| Framework preset | Other |
| Install command | `bun install` (or `npm install`) |
| Build command | `npm run build` |
| Output | handled automatically by the Nitro Vercel preset |

## 2. Environment variables

### Required

| Name | Value |
| --- | --- |
| `NITRO_PRESET` | `vercel` |

Without `NITRO_PRESET=vercel` the build produces a non-Vercel server bundle and
the `/api/public/cms/*` routes will not work.

### Optional (safe defaults are built in)

| Name | Default | Purpose |
| --- | --- | --- |
| `CMS_ADMIN_USER` | `admin` | Editor login username |
| `CMS_ADMIN_PASSWORD` | `admin123` | Editor login password (change this!) |
| `CMS_SESSION_SECRET` | derived from `CMS_DB_SECRET` | HMAC key for the login cookie |
| `CMS_DB_SECRET` | `lovable-cms-db-secret-2026` | Secret passed to the database save functions |
| `SUPABASE_URL` | built-in project URL | Database REST URL |
| `SUPABASE_PUBLISHABLE_KEY` | built-in publishable key | Public API key |

No service-role key is used anywhere. All writes go through the
`cms_save_content` / `cms_save_image` SECURITY DEFINER database functions, which
require `CMS_DB_SECRET`. If an env var is missing, blank, or accidentally pasted
with backticks/markdown, the code falls back to a known-valid value, so you will
never see an `Invalid supabaseUrl` error.

Images are stored base64-encoded in the `site_images` table (no storage bucket)
and served from `/api/public/cms/image/<id>`.

## 3. How to edit the site

1. Open the live page normally: `https://your-site.vercel.app/index.html`
2. Open the **edit copy** of the same page: `https://your-site.vercel.app/index2.html`
   (`about2.html`, `service2.html`, `gallery2.html`, `contact2.html`)
3. Click **⚙ সেটিংস** at the bottom-left and log in with `CMS_ADMIN_USER` /
   `CMS_ADMIN_PASSWORD`.
4. Every text, image, background image and placeholder now shows a pencil
   button. Click it to edit inline (images open a file picker).
5. The bottom-right bar shows the number of pending changes — press
   **সেভ করুন**.
6. Reload `index.html` — the change is live. Saving writes to the database and,
   when the filesystem is writable, also patches `index.html` and `index2.html`
   in place with a surgical string replacement.

> On Vercel the filesystem is read-only, so the database is the source of
> truth there; the file patching happens in local/dev environments.

## 4. Notes

- Content API responses are sent with `no-store` and fetched with a
  cache-busting query string; a `localStorage` cache is applied before first
  paint, so reloads never flash outdated text.
- Sessions are HMAC-signed, HttpOnly cookies valid for 12 hours.
