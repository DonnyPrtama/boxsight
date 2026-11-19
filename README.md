# BoxSight

Sistem inspeksi cacat kemasan. Operator melakukan deteksi melalui foto pada camera,
model YOLOv8s akan menandai penyok, robek, dan label rusak, hasil dengan confidence rendah masuk
review manual, lalu semua inspeksi tersimpan untuk riwayat dan laporan.

## Status

Backend memakai FastAPI & Frontend menggunakan React TypeScript. Model YOLOv8s sudah terpasang di
`model/weights/best.pt` dengan kelas saat ini `penyok`, `robek`, dan `label_rusak`.

Model masih belum proper karena masih kekurang dataset yang bisa dijiadiin bahan training.

## Struktur

```
backend/            FastAPI, PostgreSQL, JWT, upload, inferensi, laporan
  app/              app code
  tests/            pytest
  storage/          gambar hasil upload (local only)
frontend/           React + TypeScript + Vite
  src/              halaman, komponen, lib API
  public/           aset dan font
model/              bobot dan catatan model
  data/             dataset lokal (dev only)
  weights/best.pt   bobot YOLOv8s yang dipakai backend
  training/         skrip atau konfigurasi training
  notebooks/        eksperimen
docs/               PRODUCT, DESIGN, PUML, Wireframe, Manifest
design/             colorway, referensi visual, file figcraft, ekspor desain
```

## Deployment

Req :
- Docker
- Docker Compose

```bash
cp .env.example .env
# isi JWT_SECRET minimal 32 karakter dan POSTGRES_PASSWORD
docker compose up -d --build
```

Buka `http://localhost:8080`. password default : `gudang04`. Daftar

Postgres jalan di `127.0.0.1:5433` untuk keperluan development. Database dan gambar
upload disimpan di volume `boxsight_pgdata` dan `boxsight_uploads`, jadi tetap ada setelah
container restart. Untuk reset total:

```bash
docker compose down -v
docker compose up -d --build
```

Untuk proses development aplikasi bisa berjalan tanpa Docker untuk backend dan frontend akan tetapi Postgres harus teteap berjalan:

```bash
docker compose up -d postgres

cd backend
python3 -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# isi JWT_SECRET dan DB_URL sesuai .env di root
uvicorn app.main:app --reload --port 8000

# frontend, di terminal lain
cd frontend
npm install
npm run dev
```

Buka `http://127.0.0.1:5173`.

## Tes

```bash
# semua tes backend di dalam container
docker compose run --rm api pytest -q

# atau dari host, dengan Postgres yang sedang jalan
cd backend
.venv/bin/python -m pytest -q

cd ../frontend
npm run build
```

Tes backend butuh Postgres. `TEST_DATABASE_URL` menunjuk ke database `boxsight_test`,
terpisah dari database aplikasi.

Bukti dan skrip E2E tersimpan di `backend/.test-artifacts/`.

## Model

Kontrak inferensi ada di `backend/app/services/inference.py`:

```python
detect(image_path) -> list[Detection]
```

Backend memilih implementasi lewat `INFERENCE_BACKEND`. Nilai `yolo` memakai bobot di
`MODEL_PATH` (default `model/weights/best.pt`), nilai `stub` dipakai tes. Urutan kelas :
`penyok`, `robek`, `label_rusak`.

Model dilatih dengan imgsz 960 dan confidence floor 0.25 (karena dataset masih belum proper). 
Hasil di bawah threshold pengaturan (default 0.75) sementara masuk review manual. 
Detail metrik dan batasannya ada di `model/README.md`.

## Dokumen

- `docs/PRODUCT.md`: tujuan produk dan batasan.
- `docs/DESIGN.md`: sistem visual.
- `docs/PUML/`: diagram use case, activity, sequence, class, state, deployment.
- `docs/Wireframe/`: wireframe asli.
- `backend/README.md` dan `frontend/README.md`: detail masing-masing bagian.
