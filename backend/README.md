# BoxSight API

Backend FastAPI untuk sistem deteksi cacat kemasan. Menangani autentikasi, upload gambar,
inferensi (stub YOLOv8s), penyimpanan hasil, riwayat, dashboard agregat, export laporan,
dan pengelolaan user.

## Stack

- FastAPI + Uvicorn
- PostgreSQL 16
- JWT HS256 + bcrypt
- ReportLab (PDF) + openpyxl (Excel)
- Pillow untuk validasi gambar
- Ultralytics YOLOv8 dengan PyTorch CPU

## Deployment

Cara tercepat dari root project:

```bash
docker compose up -d --build
```

API bisa diakses lewat proxy web di `http://localhost:8080/api`, dan dokumentasi
interaktif di `http://localhost:8080/docs`.

Untuk proses development lokal, jalankan container Postgres dari root project (lihat README
root), lalu dari folder `backend/`:

```bash
python3 -m venv .venv
. .venv/bin/activate
# torch CPU dulu supaya pip tidak menarik wheel CUDA (karena proses dev di laptop CPU only)
pip install --index-url https://download.pytorch.org/whl/cpu torch torchvision
pip install -r requirements.txt
cp .env.example .env
# isi JWT_SECRET dan DB_URL sesuai container Postgres
uvicorn app.main:app --reload --port 8000
```

Bobot model default ada di `../model/weights/best.pt`. Kalau file itu tidak ada, backend akan
menolak start saat `INFERENCE_BACKEND=yolo`.

Quick Check: `curl http://127.0.0.1:8000/api/health` → `{"status":"ok"}`.

Dokumentasi interaktif: `http://127.0.0.1:8000/docs` saat backend dijalankan langsung.

Frontend memakai proxy Vite, jadi cukup jalankan keduanya:

```bash
# terminal 1
cd backend && .venv/bin/uvicorn app.main:app --port 8000

# terminal 2
cd frontend && npm run dev
```

## Konfigurasi

Semua lewat environment atau `backend/.env` (contoh di `.env.example`).

| Variabel | Default | Catatan |
| --- | --- | --- |
| `JWT_SECRET` | wajib | Minimal 32 karakter. Aplikasi akan menolak start kalau kosong |
| `JWT_TTL_MINUTES` | `30` | Sama dengan masa sesi frontend |
| `DB_URL` | wajib | URL Postgres, misalnya `postgresql+psycopg://boxsight:password@127.0.0.1:5433/boxsight` |
| `TEST_DATABASE_URL` | wajib untuk tes | Database terpisah untuk pytest, jangan arahkan ke DB aplikasi |
| `STORAGE_DIR` | `./storage/images` | Folder gambar upload |
| `MAX_UPLOAD_BYTES` | `5242880` | 5 MB, sama dengan validasi frontend |
| `CORS_ORIGINS` | `http://127.0.0.1:5173,...` | Origin yang diizinkan |
| `INFERENCE_BACKEND` | `yolo` | `yolo` memakai bobot, `stub` dipakai tes |
| `MODEL_PATH` | `../model/weights/best.pt` | Lokasi bobot YOLO. Di Compose: `/models/best.pt` |
| `STUB_SEED` | `boxsight-stub` | Seed stub inferensi agar hasil deterministik |

## Akun seed

Dibuat otomatis saat startup pertama. Password default: `gudang04`.

| Username | Role | Nama |
| --- | --- | --- |
| `budi` | Operator | Budi Santoso |
| `rina` | Operator | Rina Wulandari |
| `siti` | Manajemen | Siti Rahma |
| `dewi` | Manajemen | Dewi Lestari |
| `andi` | Admin | Andi Pratama |
| `agus` | Admin | Agus Setiawan |

## Endpoint

| Method | Path | Role |
| --- | --- | --- |
| GET | `/api/health` | publik |
| POST | `/api/auth/login` | publik |
| GET | `/api/auth/me` | semua |
| POST | `/api/auth/logout` | semua |
| GET | `/api/settings/threshold` | semua |
| PUT | `/api/settings/threshold` | Admin |
| POST | `/api/deteksi/upload` | Operator |
| GET | `/api/deteksi/{id}` | semua |
| POST | `/api/deteksi/{id}/review` | Operator |
| GET | `/api/files/{path}` | publik (di dalam folder storage) |
| GET | `/api/riwayat` | Operator, Manajemen |
| GET | `/api/riwayat/{id}` | Operator, Manajemen |
| POST | `/api/riwayat/export` | Operator, Manajemen |
| GET | `/api/dashboard` | semua |
| GET/POST | `/api/users` | Admin |
| PUT/DELETE | `/api/users/{id}` | Admin |

## Rules penting

- `confidence` disimpan dan dikirim sebagai float `0.0–1.0`. Frontend yang mengubahnya
  menjadi persen.
- `confidence < threshold` → `perlu_review = 1`, status inspeksi `PERLU_REVIEW_MANUAL`,
  hasil belum diputuskan. Review manual mengubah status jadi `TERSIMPAN`.
- Threshold dibaca dari DB per request, jadi perubahan Admin langsung berlaku untuk
  deteksi berikutnya tanpa restart.
- Waktu disimpan UTC naive di Postgres (`TIMESTAMP WITHOUT TIME ZONE`) dan dikirim sebagai
  ISO 8601 `+07:00`.
- Nama file upload = hash isi, disimpan di `storage/images/<YYYY>/<MM>/`.
- Inferensi memakai YOLOv8s di `model/weights/best.pt`. Stub deterministik tetap ada dan
  dipakai tes lewat `INFERENCE_BACKEND=stub`.
- Model mengembalikan bbox piksel. Adapter di `app/services/inference.py` mengubahnya ke
  koordinat ternormalisasi 0..1 sebelum disimpan.

## Tes

```bash
# di dalam container, Postgres ikut dinyalakan
docker compose run --rm api pytest -q

# atau dari host, dengan Postgres yang sedang jalan
.venv/bin/python -m pytest -q
```

Tes memakai database Postgres `boxsight_test` dari `TEST_DATABASE_URL`. Skema database itu
dibangun ulang setiap kali pytest dijalankan, jadi jangan arahkan ke database aplikasi.
`conftest.py` memaksa `INFERENCE_BACKEND=stub`, jadi tes tidak memuat torch atau bobot model.

Untuk mereset data demo, hapus database `boxsight` lalu restart API. Seed akan membuat
ulang 6 akun dan 128 inspeksi:

```bash
docker compose exec postgres psql -U boxsight -d postgres \
  -c 'DROP DATABASE boxsight WITH (FORCE)' \
  -c 'CREATE DATABASE boxsight OWNER boxsight'
docker compose restart api
```
