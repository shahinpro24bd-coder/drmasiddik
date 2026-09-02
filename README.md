# Site Weaver

এই zip-এ একটা static HTML/CSS/JS website আছে। এটাকে ঠিক এই প্রজেক্টের মতো একটা visual-edit CMS সহ dynamic website বানাও — ডিজাইন, লেআউট, টেক্সট, ছবি কিছুই পরিবর্তন করবে না, শুধু editing capability যোগ করবে।

যা যা করতে হবে:

zip-এর সব ফাইল public/-এ রাখো, static পেজগুলো আগের মতোই serve হবে।

প্রতিটা পেজের একটা করে edit-copy বানাও (index.html → index2.html, about.html → about2.html, ইত্যাদি)। *2.html পেজে cms-content.js + cms-editor.js লোড হবে, মূল পেজে শুধু cms-content.js।

*2.html পেজে লগইন করলে প্রতিটা text, image, background-image, placeholder-এর উপরে পেন্সিল আইকন আসবে — ক্লিক করে ইনলাইন এডিট করা যাবে, নিচে save bar থাকবে।

সেভ করলে (ক) Lovable Cloud ডাটাবেসে সেভ হবে, (খ) একই সাথে মূল HTML ফাইল + edit-copy দুটোই surgical string-patch করে আপডেট হবে (পুরো ফাইল re-serialize করবে না)।

Backend সব TanStack server routes-এ src/routes/api/public/cms/* (login, logout, content, save, upload, image) — Supabase edge function ব্যবহার করবে না।

Vercel free plan-এ ১০০% চলতে হবে: কোনো service-role key ব্যবহার করা যাবে না। শুধু publishable key + একটা CMS_DB_SECRET দিয়ে Postgres SECURITY DEFINER function (cms_save_content, cms_save_image) দিয়ে write হবে। ছবি base64 আকারে site_images টেবিলে রাখবে (private bucket নয়)। env var না থাকলে বা ভুল/markdown-format হলে hardcoded valid fallback ব্যবহার করবে, যাতে কখনো Invalid supabaseUrl টাইপ error না আসে।

Content API-তে no-store header + fetch-এ cache-busting; আর localStorage cache দিয়ে reload-এ পুরোনো টেক্সট এক সেকেন্ডের জন্যও flash করবে না।

Admin login: HMAC-signed HttpOnly cookie session, CMS_ADMIN_USER / CMS_ADMIN_PASSWORD env (default fallback সহ)।

শেষে VERCEL.md লিখে দাও — Vercel-এ কী কী env দিতে হবে (NITRO_PRESET=vercel বাধ্যতামূলক, বাকিগুলো optional), build command, আর কীভাবে /index2.html-এ গিয়ে এডিট করব।

কাজ শেষে Playwright দিয়ে নিজে যাচাই করো: লগইন → টেক্সট এডিট → ছবি আপলোড → সেভ → মূল পেজে reload করে পরিবর্তন দেখা যাচ্ছে কিনা, console error আছে কিনা। কোনো error থাকলে ফিক্স করে তারপর রিপোর্ট করবে।

  ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,.................................................................amar screenshot e dewa site er moto editable text box open hobe

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0ad1e686-9491-47c2-9ffd-8898cf243b4f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
