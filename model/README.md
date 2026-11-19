# Model

Bobot YOLOv8s ada di `weights/best.pt` (22,5 MB) dan dipakai backend saat
`INFERENCE_BACKEND=yolo`.

## Spesifikasi

| Item | Nilai |
| --- | --- |
| Arsitektur | YOLOv8s, task detect |
| Input | imgsz 960, confidence floor 0.25 |
| Kelas | `0 penyok`, `1 robek`, `2 label_rusak` |
| Tanpa anotasi | dianggap normal |
| Format keluaran | bbox `xyxy` piksel, dikonversi backend ke `x, y, lebar, tinggi` (0..1) |

## Performa

Diukur pada split val 546 gambar, 421 instance:

| Kelas | Presisi | Recall | mAP50 | mAP50-95 |
| --- | --- | --- | --- | --- |
| penyok | 0,380 | 0,272 | 0,192 | 0,066 |
| robek | 0,173 | 0,151 | 0,084 | 0,022 |
| label_rusak | 0,983 | 0,995 | 0,994 | 0,937 |
| semua | 0,512 | 0,473 | 0,423 | 0,342 |

`label_rusak` dilatih dengan data sintetis, jadi angka tingginya belum tentu bertahan pada
label rusak asli di lapangan. `penyok` dan `robek` masih lemah karena jumlah instance
defect di dataset terbatas.

Karena itu model dipakai sebagai penanda kandidat untuk diperiksa manual untuk sekarang. Dengan threshold
aplikasi default 0.75, sebagian besar temuan `penyok` dan `robek` untuk sekarang pasti akan masuk review manual.

## Cara backend memakai model

- `backend/app/services/inference.py` memuat model sekali, lalu memanggil
  `predict(path, conf=0.25, imgsz=960)`.
- Semua kotak dikembalikan sebagai `Detection`. Backend mengambil satu deteksi dengan
  confidence tertinggi untuk disimpan.
- `INFERENCE_BACKEND=stub` memakai stub deterministik untuk tes.
- `MODEL_PATH` bisa diarahkan ke bobot lain. Di Docker Compose, folder `model/weights`
  di-mount ke `/models` dan `MODEL_PATH=/models/best.pt`.

## Batasan

- Model menerima satu box per foto.
- Orientasi foto dari EXIF tidak diperbaiki sebelum inferensi.
- Belum ada versi model yang disimpan per inspeksi. Jejak audit hanya confidence dan bbox.
- Inferensi berjalan di CPU. Di mesin pengembangan sekitar 0,2 detik per gambar setelah warming model.

## Retraining model

Untuk dataset dan notebook training ada di project terpisah, bukan di repo ini. Ringkasan
eksperimen, dataset card, dan aturan anotasi ada di docs project dataset tersebut.

Weight/model baru bisa menggantikan `weights/best.pt` tanpa mengubah kode, selama urutan kelas
tetap `penyok`, `robek`, `label_rusak`.

## Lisensi

Ultralytics berlisensi AGPL-3.0. Data latih berasal dari Roboflow (CC BY 4.0), Kaggle, dan
gambar sintetis.
