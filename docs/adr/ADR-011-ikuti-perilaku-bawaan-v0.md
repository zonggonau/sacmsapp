# ADR-011 — Mengikuti Perilaku Bawaan v0 (Hasil Sama dengan v0.app)

**Status:** Accepted
**Tanggal:** 2026-09-16
**Disetujui:** pemilik sistem
**Menggantikan sebagian:** [09 §9.5 & §9.6](../09-AI-BUILDER-PIPELINE.md) (system prompt SaCMS dan
template prompt per tipe website)

## Konteks

Sejak Fase 3, SaCMS membungkus setiap permintaan ke v0 dengan lapisan buatan sendiri:

- `system` berisi aturan SaCMS (bahasa, shadcn/ui, SEO, aksesibilitas) yang bisa diubah dari
  `/admin/ai`;
- `instructions` project v0 berisi system prompt yang sama;
- planner mengubah prompt menjadi SPESIFIKASI JSON dari template tipe website, dan pesan build
  awal diganti menjadi "Bangun aplikasinya sekarang sesuai SPESIFIKASI";
- model dipilih per paket (Free `v0-mini`, dst.).

Akibatnya hasil SaCMS **berbeda** dari hasil prompt yang sama di v0.app. Pemilik sistem
menginginkan hasil yang sama dengan v0.app: kemampuan dan "skill" mengikuti v0, bukan dibuat
sendiri.

## Keputusan

1. **Prompt pengguna dikirim apa adanya** sebagai `message` — untuk build awal maupun edit.
2. **Tidak ada `system`** pada `chats.create` / `chats.sendMessage`, dan **tidak ada
   `instructions`** saat membuat project v0.
3. **Model semua build: `v0-auto`** (pilihan "Auto" di v0.app), konstanta `V0_APP_MODEL`.
4. **Skills bawaan v0** — parameter `skills` / `attachedSkillIds` tidak dikirim.
5. Tetap dipertahankan karena tidak mengubah isi permintaan: pembuangan karakter tak terlihat,
   batas 4.000 karakter, penandaan pola mencurigakan untuk log, dan pencatatan `sentMessage`
   serta `model` per job.

## Alternatif yang Dipertimbangkan

| Alternatif                          | Kelebihan                                | Kekurangan                                             | Alasan ditolak                        |
| ----------------------------------- | ---------------------------------------- | ------------------------------------------------------ | ------------------------------------- |
| Pertahankan system prompt SaCMS     | Hasil seragam, bahasa Indonesia terjamin | Hasil berbeda dari v0.app                              | Bertentangan dengan keinginan pemilik |
| Murni + satu baris bahasa Indonesia | Teks UI hampir selalu Indonesia          | Masih bukan perilaku v0.app                            | Pemilik memilih murni                 |
| Model per paket                     | Biaya per build lebih terkendali         | Hasil berbeda dari v0.app bila paket memakai `v0-mini` | Pemilik memilih `v0-auto`             |
| Skills tim dari v0.app              | Perilaku sama dengan akun v0.app pemilik | Butuh nama skill; SDK tidak menyediakan daftar skills  | Pemilik memilih bawaan v0             |

## Konsekuensi

**Positif:** hasil website sama dengan v0.app untuk prompt yang sama; pengurangan kode dan
kendali yang harus dirawat.

**Negatif:**

- Bahasa hasil mengikuti bahasa prompt pengguna — prompt berbahasa Indonesia menghasilkan situs
  berbahasa Indonesia, tetapi tidak dijamin.
- Tidak ada lagi pagar teknologi (misalnya "hanya shadcn/ui") dan template kebutuhan per tipe
  website; pengguna awam yang menulis satu kalimat mendapat hasil seperti di v0.app.
- Biaya per build mengikuti `v0-auto` dan bisa lebih mahal daripada `v0-mini` di paket Free.
  Kredit SaCMS per build tidak berubah, jadi margin paket Free perlu dipantau di `/admin`.
- Pertahanan prompt injection lewat pembatas + label DATA (docs/12 ancaman A3) tidak lagi
  berlaku; yang tersisa sama dengan v0.app: pratinjau di iframe sandbox origin berbeda,
  keluaran AI tidak dirender sebagai HTML di SaCMS, dan tidak ada rahasia SaCMS di prompt.

**Yang menjadi lebih sulit:** mengembalikan konsistensi hasil lintas pengguna tanpa menyimpang
dari v0.app.

## Kapan Keputusan Ini Perlu Ditinjau Ulang

- Biaya v0 rata-rata per website jadi di paket Free melebihi harga kredit yang dibayar pengguna.
- Lebih dari 20% website hasil penguji beta tidak berbahasa Indonesia padahal prompt-nya
  berbahasa Indonesia.
- v0 menyediakan API untuk menyalin skills akun v0.app, sehingga pilihan "skills tim" bisa
  diterapkan tanpa nama manual.
