# BoxSight — web

React + TypeScript (Vite) frontend for the BoxSight packaging-defect inspection app.

## Run

Cara tercepat dari root project:

```bash
docker compose up -d --build
```

Buka `http://localhost:8080`. Nginx akan serve  hasil build frontend dan meneruskan transaksi  `/api`
ke service `api`.

Untuk development, frontend membutuhkan backend di `../backend`. Jalankan backend dulu,
lalu:

```bash
cd frontend
npm install
npm run dev      # http://127.0.0.1:5173, proxy /api -> 127.0.0.1:8000
npm run build
npm run preview
```

Kalau backend berada di host lain, set `VITE_API_BASE_URL` (misalnya
`http://192.168.1.10:8000`). Tanpa variabel itu, semua request memakai path relatif `/api`
dan diteruskan oleh proxy Vite saat development.

## Routes

| Route | What it does |
| --- | --- |
| `/login` | Login screen with all five wireframe states |
| `/dashboard` | Session-guarded dashboard: period filter, KPIs, donut, defect bars, daily trend |
| `/detection` | Operator-only detection flow: upload/camera, processing, result, manual review |
| `/history` | Operator/Manajemen history: filters, table/cards, pagination, export modal |
| `/history/:id` | Read-only inspection detail reached by clicking a history row |
| `/settings` | Admin-only confidence threshold settings; other roles see access denied |
| `/users` | Admin-only user management: list, add, edit, delete; other roles see access denied |
| `*` | Redirects to `/dashboard` when a session is valid, otherwise `/login` |

## Demo accounts

Autentikasi memakai `POST /api/auth/login` di backend (`src/lib/auth.ts`). 
password dan role berasal dari seed database. Password default semua akun: `gudang04`.

| Username | Role | Name |
| --- | --- | --- |
| `budi` | Operator | Budi Santoso |
| `rina` | Operator | Rina Wulandari |
| `siti` | Manajemen | Siti Rahma |
| `dewi` | Manajemen | Dewi Lestari |
| `andi` | Admin | Andi Pratama |
| `agus` | Admin | Agus Setiawan |

Kredensial salah menghasilkan banner “Username atau password salah” yang sama untuk user tidak ada
maupun password salah. Token JWT disimpan bersama profil di `localStorage` selama 30 menit;
request yang dijawab `401` menghapus sesi dan mengarahkan ke `/login?expired=1`.

## Login states

- **Default** — username focused on desktop, `contoh: budi` placeholder.
- **Field kosong** — both labels/rules rust, inline “wajib diisi” errors, focus moves to the first invalid field.
- **Kredensial salah** — rust banner, filled values, both field rules rust, password focused.
- **Memproses** — fields dimmed to 55%, button disabled with spinner and `Memproses…`.
- **Sesi berakhir** — amber info banner above the default form.
- **Password reveal** — drawn eye toggle with `aria-pressed` and a changing accessible label.

## Dashboard

`/dashboard` mengikuti `../docs/Wireframe/Wireframe 2 - Dashboard.html`: role-aware navigation,
period filter, four KPI cards, result-share donut, defect-type bars, and a daily trend
chart. Semua angka diambil dari `GET /api/dashboard`; tidak ada lagi data statis. Periode
default 1–29 Oktober 2026, dan KPI-nya konsisten dengan daftar riwayat karena memakai
sumber data yang sama.

Style dari referensi project dribble di directory `../design/main-dashboard-reference.webp`: near-black `#282727` 
sidebar, cool `#f6f7f8` canvas, white cards, `#626262` secondary text, and `#413dfa` for primary actions,
active indicators, and the defect series. The password/account session role changes the
sidebar and mobile bottom navigation:

- **Operator** — Dashboard, Deteksi, Riwayat
- **Manajemen** — Dashboard, Riwayat
- **Admin** — Dashboard, Pengaturan, Kelola User

Dashboard states:

- **Default** — periode 1–29 Okt 2026 dengan kartu terisi dari API.
- **Memuat** — initial mount and every apply/reset run show skeleton KPIs and chart panels.
- **Data kosong** — applying a period outside 1–29 Okt 2026 zeroes the KPIs and shows the
  empty panel; Operator gets “Buka Deteksi →”.
- **Periode tidak valid** — start after end (or an empty date) shows an inline error,
  disables Terapkan, and dims the existing data to 45%.
- **Profile** — the header profile chip is read-only; Keluar lives only in the sidebar.

## Detection

`/detection` mengikuti `../docs/Wireframe/Wireframe 3 – Deteksi.html`. Hanya role operator yang dapat
membuka menu tersebut; role lainnya akan diredirect ke `/dashboard`. Halamannya menggunakan shell yang sama,
palette, and Reddit Mono pada dashboard.

Flow:

1. **Upload file** — drag/drop or pick a PNG/JPEG up to 5 MB. Dropzone is keyboard
   accessible; invalid type and oversize files show the wireframe error copy.
2. **Kamera** — requests `getUserMedia` with the rear camera. The live preview has a
   framing overlay and shutter; captured photos can be retaken or used for detection.
   Denied/unavailable cameras show recovery actions and the “Pakai upload” switch.
3. **Deteksi** — shows the source preview with a scan line and the YOLOv8 skeleton panel
   for 1.6 s. The result plate adds a bounding box, status, label, confidence, and
   threshold. Results are treated as auto-saved to history.
4. **Perlu review** — confidence below the active threshold (default 75%) renders the amber
   warning, status pill, and the manual review form (Cacat / Tidak cacat + optional note).
   Saving requires a decision and produces the “Review tersimpan” state. Above-threshold
   results go straight to final.
5. **Inspeksi baru** resets back to the upload state.

Karena deteksi berhalan pada server, angka confidence diambil dari backend (untuk sekarang sebagai
deterministic stup dari model YOLOv8s). Hasil akan disimpan otomatis, dan untuk hasil low-confidence
perlu review manual yang diolah oleh api `POST /api/deteksi/{id}/review`. Untuk threshold yang tampil
pada halaman diambil dari api `GET /api/settings/threshold` jadi perubahan pada pengaturan akan mempengaruhi
bagaimana klasifikasi deteksi nantinya

## Riwayat inspeksi

`/history` mengikuti `../docs/Wireframe/Wireframe 4 – Riwayat Inspeksi.html`. Operator and
Manajemen dapat membuka halaman ini; Admin sama seperti sebelumnya diredirect ke halaman `/dashboard` langsung.

- **Filter** — date range (Indonesian display), status (`Final`, `Perlu review`,
  `Sudah direview`), and defect label (`Penyok`, `Robek`, `Label rusak`). Invalid ranges
  show the wireframe error and disable Terapkan. On mobile the panel collapses behind a
  Filter bar and active status/label filters appear as removable chips.
- **Data** — diambil dari `GET /api/riwayat` dengan pagination server, 5 per halaman.
  Seed backend menyediakan 128 inspeksi 1–29 Oktober 2026, dan empat record terakhir
  (id 125–128) sengaja dibuat agar cocok dengan wireframe. Filter tanggal, status, dan
  label dikirim sebagai query params, bukan difilter di browser.
- **Rows** — desktop table and mobile cards are clickable and keyboard-operable; both lead
  to the matching detail screen. Applied filters and page are kept in `sessionStorage`, so
  returning from detail restores the list exactly where it was.
- **States** — loading skeleton, populated, filtered, empty result, invalid period.
- **Export** — modal on desktop, bottom sheet on mobile; PDF/Excel options, processing,
  success toast, and failure/retry. Export is disabled while loading and refuses to open
  with zero results, showing the “Tidak ada data” toast. Tombol Export memanggil
  `POST /api/riwayat/export` dan mengunduh file PDF/XLSX yang benar-benar dibuat backend
  sesuai filter aktif.

## Detail inspeksi

`/history/:id` follows `../docs/Wireframe/Wireframe 5 – Detail Inspeksi.html`. Operator and
Manajemen dapat membuka halaman ini; Admin akan otomatis teredirect.

- **Header** — back to Riwayat, `Inspeksi #N`, status badge, profile chip.
- **Plate** — authored vector carton with optional bounding box/label; clean inspections
  show no box plus “Tidak ada cacat terdeteksi”.
- **Info inspeksi** — Waktu, Operator, Sumber, File.
- **Hasil deteksi** — Hasil, Label, Confidence. Reviewed results show “(hasil review)”;
  pending results show “Belum diputuskan”.
- **Review manual** — decision and note, only for `Sudah direview`.
- **Warning** — amber notice for `Perlu review`, explaining review happens on Deteksi.
- **States** — loading skeleton saat `GET /api/riwayat/{id}` berjalan, found states
  (final, clean, pending, reviewed), dan “Inspeksi tidak ditemukan” untuk ID yang tidak ada
  atau sudah dihapus. `/history/128` dan `/history/INS-128` sama-sama dikenali.
- **Back to list** — returns to `/history` with filters and page restored.

## Pengaturan

`/settings` mengikuti `../docs/Wireframe/Wireframe 6 – Pengaturan.html`. Hanya Admin yang dapat mengakses;
semuar roles secara eksplisit akan mendapat feedback "akses Ditolak" pada saat mengaksesnya menggunakan URL secara langsung.

- **Nilai saat ini** — threshold aktif (default `0.75`) dan waktu terakhir diperbarui,
  dibaca dari `GET /api/settings/threshold`.
- **Nilai baru** — text/number input plus a slider preview. Below the threshold is “Perlu
  review manual” (amber); above it is “Hasil final” (green). The value is validated as
  `0.0–1.0`; invalid values disable Simpan and dim the slider.
- **States** — loading skeleton, default, changed (`Belum disimpan` chip), invalid, saving,
  saved success, failure (offline save), and access denied.
- **Simpan** mengirim `PUT /api/settings/threshold`; **Batalkan** mengembalikan nilai
  tersimpan. Kalau backend menolak (403 atau jaringan gagal), banner error tampil dan
  nilai lama tidak berubah.
- Threshold dibaca ulang oleh halaman Deteksi saat dibuka, jadi deteksi berikutnya memakai
  nilai terbaru (default 75%). Data riwayat lama tidak dihitung ulang.

## Kelola user

`/users` mengikuti `../docs/Wireframe/Wireframe 7 – Kelola User.html`. Hanya Admin; 
semuar roles secara eksplisit akan mendapat feedback "akses Ditolak" pada saat mengaksesnya menggunakan URL secara langsung.

- **List** — desktop table and mobile cards, six seeded users, “Anda” marker on the current
  admin, and Edit/Hapus actions per row.
- **Add user** — modal/bottom sheet with Nama, Username, Role, Password. Empty fields,
  duplicate usernames (case-insensitive), and passwords under 8 characters show inline
  errors. Saving shows the processing state; offline saves show the retryable failure
  banner.
- **Edit user** — prefilled form; password is optional and only changes when filled.
  Success updates the row, highlights it briefly, and shows a toast.
- **Delete user** — confirmation dialog with the user name; success removes the row and
  shows a toast. Deleting the current account is blocked with an error toast.
- **States** — loading skeleton, default, add empty/duplicate, saving, failed, added,
  edited, delete confirmation, self-delete rejection, and deleted.
- Data user berasal dari `GET /api/users` dan setiap perubahan memanggil endpoint yang
  sama, jadi daftar akun login selalu identik dengan yang terlihat di halaman ini.

## Layout

Login is a full-bleed `Manifest/new-login-background.svg` scene with a floating dark-glass
panel anchored on the right: `rgba(20, 20, 20, 0.6)` plus a 12 px backdrop blur, 20 px radius,
centred logo/header, and the warehouse lot tag (`BOX-LGN-0427 · GUDANG · GATE 04`) on the
bottom left. Below 960 px the panel centres, the tag hides, and the backdrop darkens for
contrast. The `Manifest/new-boxsight_logo_blue.svg` mark is used as the login logo and
favicon.

Dashboard desktop is a full-bleed near-black rail with the light workspace floating on it
(12 px inset, 16 px radius); below 900 px the sidebar gives way to a fixed bottom navigation
and the KPI grid becomes 2×2. Login, dashboard, and detection now share the reference
palette: near-black `#282727`, cool `#f6f7f8`, secondary `#626262`, and blue `#413dfa`.
All colour tokens live in `src/styles/tokens.css`.

## Type

Self-hosted Reddit family (`src/styles/fonts.css`, files in `public/fonts/`):

- `--font` — **Reddit Mono**, default UI face; the dashboard uses it exclusively.
- `--font-sans` — **Reddit Sans**, proportional companion, used by the login headings/body.
- `--font-narrow` — **Reddit Sans Condensed**, reserved for dense/narrow contexts.

## Structure

```
src/
  components/TextField.tsx        label + control + registration error row
  components/icons.tsx            eye, status, and lot-code barcode SVGs (login)
  components/DashboardIcons.tsx   nav, KPI, brand, camera, upload, and utility icons
  components/InspectionPlate.tsx  authored carton plate + detection bounding box
  lib/api.ts                      request/requestBlob, ApiError, auto-logout saat 401
  lib/session.ts                  penyimpanan sesi (localStorage) dan flag kedaluwarsa
  lib/auth.ts                     sign-in ke API, baca sesi, sign-out
  lib/inspections.ts              tipe, konversi DTO, fetch riwayat/detail, formatter
  lib/detections.ts               upload deteksi dan simpan review
  lib/dashboard.ts                fetch data dashboard
  lib/settings.ts                 fetch/update threshold
  lib/users.ts                    CRUD user
  lib/format.ts                   format byte dan konversi waktu WIB
  pages/Login.tsx/.css            login screen and state styling
  pages/Dashboard.tsx/.css        dashboard shell, filters, KPIs, charts, skeleton states
  pages/Detection.tsx/.css        upload/camera source, detection run, result + review
  pages/History.tsx/.css          filters, table/cards, pagination, export modal
  pages/Detail.tsx/.css           read-only inspection detail and state skeleton
  pages/Settings.tsx/.css         threshold form, slider, validation, and access denied
  pages/Users.tsx/.css            user table/cards, add/edit/delete modals, validation
  styles/fonts.css                @font-face declarations
  styles/tokens.css               colour, type, shape tokens (login + dashboard)
  styles/global.css               resets, selection, focus, reduced motion
public/
  assets/                         copies of the two latest Manifest brand assets (SVG)
  fonts/                          Reddit variable woff2 files
```

## Integrasi backend (2026-11-13)

Semua halaman sudah memakai API di `../backend`, bukan mock lokal. Verifikasi otomatis memakai
Playwright headless dengan Chromium:

- Login 6 akun, kredensial salah, sesi kedaluwarsa, dan redirect saat server menjawab `401`.
- Deteksi upload dan kamera (fake media device), termasuk hasil final dan alur review manual.
- Riwayat dengan pagination server, detail `INS-128`, dan state tidak ditemukan.
- Dashboard: KPI dan grafik cocok dengan `/api/dashboard`, termasuk periode kosong.
- Pengaturan: simpan `0.80`, reload, nilai tetap; Manajemen ditolak.
- Kelola user: tambah, edit, hapus, dan data bertahan setelah reload.
- Export PDF dan XLSX benar-benar terunduh dari `POST /api/riwayat/export`.

Skrip E2E disimpan di `../backend/.test-artifacts/` (`f6-ui-check.js`,
`f7-dashboard-check.js`, `f8-export-check.js`, `f9-users-check.js`) agar bisa diulang.

## Verified

- `npm run build` — TypeScript passes, 63 modules, no warnings.
- Headless Chromium: login at 1440×900 and 390×844; dashboard at 1440×900 (exactly one
  viewport), 1280, 1024, and 390×844. Login dark-glass panel verified at both sizes; no
  horizontal overflow, no console errors, Reddit Mono reports loaded.
- Login states exercised end-to-end: empty submit (2 errors, focus on username), wrong
  credentials (banner, both fields invalid, password focused), submitting
  (`Memproses…`, disabled), successful sign-in → `/dashboard`, expired session banner,
  password reveal.
- Dashboard states exercised: initial skeleton → populated, invalid period (error,
  disabled Terapkan, dimmed data), empty period (zero KPIs + CTA), reset, role-aware nav
  for Operator/Manajemen/Admin, and sign-out from the sidebar.
- Detection states exercised: initial, invalid file, file selected, processing, final
  result, review, saved review (with note), camera denied, and camera live/captured/result
  with Chromium's fake media device. 1440×900 and 390×844; no console errors or overflow.
- History states exercised: initial loading, populated (128), pagination page 2, filtered
  Robek + Perlu review (3), invalid range, empty range, export modal, processing, success
  toast, offline failure/retry, empty-export toast, collapsed/expanded mobile filters, and
  mobile table cards. Operator/Manajemen navigation and the Admin redirect were checked.
- Detail states exercised: loading skeleton, final #128, reviewed #127 (decision + note),
  clean #126 (no bounding box), pending #125 (warning + belum diputuskan), missing ID, direct
  `/history/128` resolution, and filter/page restoration after back. Desktop 1440×900 and
  mobile 390×844; no console errors.
- Settings states exercised: loading, default, changed, invalid, saving, saved/persisted,
  offline failure, mobile, and Manajemen access denied. Detection was checked against the
  saved threshold.
- User management states exercised: loading, default list, empty add form, duplicate
  username, saving, added/highlighted, edit, offline failure, self-delete rejection, delete
  confirmation, deleted, mobile cards/bottom sheet, and Manajemen access denied.
