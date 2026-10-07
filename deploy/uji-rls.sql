-- Uji isolasi data di produksi SETIAP deploy (dijalankan superuser, semua di dalam
-- transaksi yang DIBATALKAN: tidak ada yang tersimpan). Gagal satu = deploy berhenti
-- sebelum web baru menyala. Juga dijalankan di tes (tests/integrasi/uji-rls.test.ts)
-- dan CI terhadap Postgres 16 sungguhan. Tambah baris uji setiap ada tabel milik pemilik baru.
BEGIN;

INSERT INTO pengguna (id, agentbuff_sub, email) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'uji_rls_a', 'a@uji.internal'),
  ('00000000-0000-4000-8000-0000000000b2', 'uji_rls_b', 'b@uji.internal');
INSERT INTO token_mcp (pengguna_id, label, hash, awalan, sumber) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'uji', repeat('c', 64), 'antikebo_uji1', 'manual');
INSERT INTO audit (pengguna_id, sumber, jenis, ringkasan) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'web', 'lainnya', 'audit uji A');
INSERT INTO alarm (id, pengguna_id, jam, zona, pengulangan, agenda_judul, karakter, bunyi, soal, tunda, spam, masih_bangun) VALUES
  ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000a1', '05:00', 'Asia/Jakarta', '{"jenis":"harian"}', 'Bangun', 'ibu_galak', 'klasik',
   '{"jenis":"hitungan","tingkat":"sedang","benar":2,"kodeQr":[]}', '{"jatah":2,"menit":5}', '{"kanal":[],"jedaDtk":null,"batasMenit":null}', '{"aktif":true,"menit":5,"batasDtk":60}');
INSERT INTO lewati_alarm (pengguna_id, alarm_id, tanggal) VALUES
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c3', '2030-01-01');
INSERT INTO template_alarm (pengguna_id, nama, isi) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'Template A', '{}');
INSERT INTO kejadian_alarm (id, pengguna_id, alarm_id, jadwal_utc, tanggal_lokal, jam_lokal, judul) VALUES
  ('00000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c3', '2030-01-01 22:00+00', '2030-01-02', '05:00', 'Bangun');
INSERT INTO langkah_kejadian (pengguna_id, kejadian_id, jenis, jatuh_tempo_utc) VALUES
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000d4', 'uji', '2030-01-01 22:00+00');
INSERT INTO perangkat_siaga (pengguna_id, jenis, nama, token_hash) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'pc', 'PC A', repeat('e', 64));
INSERT INTO soal_kejadian (pengguna_id, kejadian_id, tujuan, jenis, tingkat, target, tampil, hash_jawaban, garam) VALUES
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000d4', 'bangun', 'hitungan', 'sedang', 2, '{"teks":"7 × 8 + 13"}', repeat('f', 64), 'garam');
INSERT INTO kode_qr (pengguna_id, nama, isi_hash, isi_tersandi) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'kamar mandi', repeat('9', 64), 'AK1uji');
INSERT INTO naskah_suara (pengguna_id, hash, teks, bahasa, gaya) VALUES
  ('00000000-0000-4000-8000-0000000000a1', repeat('8', 64), 'Bangun, A!', 'id', 'galak');
INSERT INTO klip_suara (pengguna_id, hash, audio, mime, durasi_ms, penyedia, suara) VALUES
  ('00000000-0000-4000-8000-0000000000a1', repeat('8', 64), '\x494433'::bytea, 'audio/mpeg', 1000, 'uji', 'v1');
INSERT INTO kiriman_kanal (pengguna_id, kejadian_id, kanal_id, jenis, status, kunci) VALUES
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000d4', 'k_uji', 'spam', 'terkirim', 'uji:rls:1');
INSERT INTO langganan_push (pengguna_id, endpoint_hash, data) VALUES
  ('00000000-0000-4000-8000-0000000000a1', repeat('6', 64), 'AK1uji');
INSERT INTO sambungan_tuya (pengguna_id, kunci_sandi, kunci_samar, wilayah) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'AK1uji', 'sk-SG••••uji1', 'SG');
INSERT INTO perangkat_tuya (pengguna_id, device_id, nama, kategori) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'lampu-uji', 'Lampu A', 'dj');
INSERT INTO potret_tuya (pengguna_id, kejadian_id, device_id, properti) VALUES
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000d4', 'lampu-uji', '{"switch_led":false}');

DO $$
DECLARE n int;
BEGIN
  SET LOCAL ROLE antikebo_app;

  -- Tanpa konteks: nol baris di semua tabel milik pemilik.
  PERFORM set_config('app.pengguna_id', '', true);
  PERFORM set_config('app.token_hash', '', true);
  SELECT count(*) INTO n FROM token_mcp;  IF n <> 0 THEN RAISE EXCEPTION 'RLS: token terbaca tanpa konteks'; END IF;
  SELECT count(*) INTO n FROM audit;      IF n <> 0 THEN RAISE EXCEPTION 'RLS: audit terbaca tanpa konteks'; END IF;
  SELECT (SELECT count(*) FROM alarm) + (SELECT count(*) FROM lewati_alarm) + (SELECT count(*) FROM template_alarm)
       + (SELECT count(*) FROM kejadian_alarm) + (SELECT count(*) FROM langkah_kejadian) INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'RLS: data alarm terbaca tanpa konteks'; END IF;
  SELECT count(*) INTO n FROM perangkat_siaga; IF n <> 0 THEN RAISE EXCEPTION 'RLS: perangkat terbaca tanpa konteks'; END IF;
  SELECT (SELECT count(*) FROM soal_kejadian) + (SELECT count(*) FROM kode_qr) INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'RLS: soal atau kode QR terbaca tanpa konteks'; END IF;
  SELECT (SELECT count(*) FROM naskah_suara) + (SELECT count(*) FROM klip_suara) INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'RLS: naskah atau klip suara terbaca tanpa konteks'; END IF;
  SELECT (SELECT count(*) FROM kiriman_kanal) + (SELECT count(*) FROM langganan_push) INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'RLS: kiriman kanal atau langganan push terbaca tanpa konteks'; END IF;
  SELECT (SELECT count(*) FROM sambungan_tuya) + (SELECT count(*) FROM perangkat_tuya) + (SELECT count(*) FROM potret_tuya) INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'RLS: data rumah pintar terbaca tanpa konteks'; END IF;

  -- Konteks B: tidak melihat, mengubah, atau menghapus milik A.
  PERFORM set_config('app.pengguna_id', '00000000-0000-4000-8000-0000000000b2', true);
  SELECT count(*) INTO n FROM token_mcp;  IF n <> 0 THEN RAISE EXCEPTION 'RLS: B melihat token A'; END IF;
  SELECT count(*) INTO n FROM audit;      IF n <> 0 THEN RAISE EXCEPTION 'RLS: B melihat audit A'; END IF;
  UPDATE token_mcp SET dicabut_pada = now();
  GET DIAGNOSTICS n = ROW_COUNT;          IF n <> 0 THEN RAISE EXCEPTION 'RLS: B mencabut token A'; END IF;
  DELETE FROM audit;
  GET DIAGNOSTICS n = ROW_COUNT;          IF n <> 0 THEN RAISE EXCEPTION 'RLS: B menghapus audit A'; END IF;
  BEGIN
    INSERT INTO audit (pengguna_id, sumber, jenis, ringkasan) VALUES ('00000000-0000-4000-8000-0000000000a1', 'web', 'lainnya', 'palsu');
    RAISE EXCEPTION 'RLS: B menulis audit atas nama A';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  SELECT (SELECT count(*) FROM alarm) + (SELECT count(*) FROM lewati_alarm) + (SELECT count(*) FROM template_alarm)
       + (SELECT count(*) FROM kejadian_alarm) + (SELECT count(*) FROM langkah_kejadian) INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'RLS: B melihat data alarm A'; END IF;
  UPDATE perangkat_siaga SET dicabut_pada = now();
  GET DIAGNOSTICS n = ROW_COUNT;          IF n <> 0 THEN RAISE EXCEPTION 'RLS: B mencabut perangkat A'; END IF;
  SELECT (SELECT count(*) FROM soal_kejadian) + (SELECT count(*) FROM kode_qr) INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'RLS: B melihat soal atau kode QR A'; END IF;
  SELECT (SELECT count(*) FROM naskah_suara) + (SELECT count(*) FROM klip_suara) INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'RLS: B melihat naskah atau klip suara A'; END IF;
  UPDATE klip_suara SET dipakai_terakhir = now();
  GET DIAGNOSTICS n = ROW_COUNT;          IF n <> 0 THEN RAISE EXCEPTION 'RLS: B mengubah klip suara A'; END IF;
  BEGIN
    INSERT INTO naskah_suara (pengguna_id, hash, teks, bahasa, gaya) VALUES ('00000000-0000-4000-8000-0000000000a1', repeat('7', 64), 'palsu', 'id', 'galak');
    RAISE EXCEPTION 'RLS: B menulis naskah suara atas nama A';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  SELECT (SELECT count(*) FROM kiriman_kanal) + (SELECT count(*) FROM langganan_push) INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'RLS: B melihat kiriman kanal atau langganan push A'; END IF;
  DELETE FROM langganan_push;
  GET DIAGNOSTICS n = ROW_COUNT;          IF n <> 0 THEN RAISE EXCEPTION 'RLS: B melepas langganan push A'; END IF;
  BEGIN
    INSERT INTO langganan_push (pengguna_id, endpoint_hash, data) VALUES ('00000000-0000-4000-8000-0000000000a1', repeat('5', 64), 'palsu');
    RAISE EXCEPTION 'RLS: B menambah langganan push atas nama A';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  SELECT (SELECT count(*) FROM sambungan_tuya) + (SELECT count(*) FROM perangkat_tuya) + (SELECT count(*) FROM potret_tuya) INTO n;
  IF n <> 0 THEN RAISE EXCEPTION 'RLS: B melihat data rumah pintar A'; END IF;
  UPDATE sambungan_tuya SET status = 'aktif';
  GET DIAGNOSTICS n = ROW_COUNT;          IF n <> 0 THEN RAISE EXCEPTION 'RLS: B mengubah sambungan Tuya A'; END IF;
  DELETE FROM perangkat_tuya;
  GET DIAGNOSTICS n = ROW_COUNT;          IF n <> 0 THEN RAISE EXCEPTION 'RLS: B menghapus perangkat Tuya A'; END IF;
  BEGIN
    INSERT INTO sambungan_tuya (pengguna_id, kunci_sandi, kunci_samar, wilayah) VALUES ('00000000-0000-4000-8000-0000000000a1', 'palsu', 'palsu', 'SG');
    RAISE EXCEPTION 'RLS: B menulis sambungan Tuya atas nama A';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE soal_kejadian SET status = 'benar';
  GET DIAGNOSTICS n = ROW_COUNT;          IF n <> 0 THEN RAISE EXCEPTION 'RLS: B menandai soal A benar'; END IF;
  UPDATE alarm SET aktif = false;
  GET DIAGNOSTICS n = ROW_COUNT;          IF n <> 0 THEN RAISE EXCEPTION 'RLS: B mematikan alarm A'; END IF;
  DELETE FROM kejadian_alarm;
  GET DIAGNOSTICS n = ROW_COUNT;          IF n <> 0 THEN RAISE EXCEPTION 'RLS: B menghapus kejadian A'; END IF;
  DELETE FROM lewati_alarm;
  GET DIAGNOSTICS n = ROW_COUNT;          IF n <> 0 THEN RAISE EXCEPTION 'RLS: B menghapus lewati A'; END IF;
  BEGIN
    INSERT INTO template_alarm (pengguna_id, nama, isi) VALUES ('00000000-0000-4000-8000-0000000000a1', 'palsu', '{}');
    RAISE EXCEPTION 'RLS: B menulis template atas nama A';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- Konteks A: melihat miliknya.
  PERFORM set_config('app.pengguna_id', '00000000-0000-4000-8000-0000000000a1', true);
  SELECT count(*) INTO n FROM token_mcp;  IF n <> 1 THEN RAISE EXCEPTION 'RLS: A tidak melihat tokennya'; END IF;
  SELECT count(*) INTO n FROM audit;      IF n <> 1 THEN RAISE EXCEPTION 'RLS: A tidak melihat auditnya'; END IF;
  SELECT (SELECT count(*) FROM alarm) + (SELECT count(*) FROM lewati_alarm) + (SELECT count(*) FROM template_alarm)
       + (SELECT count(*) FROM kejadian_alarm) + (SELECT count(*) FROM langkah_kejadian) INTO n;
  IF n <> 5 THEN RAISE EXCEPTION 'RLS: A tidak melihat data alarmnya'; END IF;
  SELECT count(*) INTO n FROM perangkat_siaga; IF n <> 1 THEN RAISE EXCEPTION 'RLS: A tidak melihat perangkatnya'; END IF;
  SELECT (SELECT count(*) FROM soal_kejadian) + (SELECT count(*) FROM kode_qr) INTO n;
  IF n <> 2 THEN RAISE EXCEPTION 'RLS: A tidak melihat soal dan kode QR-nya'; END IF;
  SELECT (SELECT count(*) FROM naskah_suara) + (SELECT count(*) FROM klip_suara) INTO n;
  IF n <> 2 THEN RAISE EXCEPTION 'RLS: A tidak melihat naskah dan klip suaranya'; END IF;
  SELECT (SELECT count(*) FROM kiriman_kanal) + (SELECT count(*) FROM langganan_push) INTO n;
  IF n <> 2 THEN RAISE EXCEPTION 'RLS: A tidak melihat kiriman dan langganan push-nya'; END IF;
  SELECT (SELECT count(*) FROM sambungan_tuya) + (SELECT count(*) FROM perangkat_tuya) + (SELECT count(*) FROM potret_tuya) INTO n;
  IF n <> 3 THEN RAISE EXCEPTION 'RLS: A tidak melihat data rumah pintarnya'; END IF;

  -- Hash token: tepat satu baris terlihat tanpa konteks pemilik; hash lain nol.
  PERFORM set_config('app.pengguna_id', '', true);
  PERFORM set_config('app.token_hash', repeat('c', 64), true);
  SELECT count(*) INTO n FROM token_mcp;  IF n <> 1 THEN RAISE EXCEPTION 'RLS: pencarian token lewat hash gagal'; END IF;
  SELECT count(*) INTO n FROM perangkat_siaga; IF n <> 0 THEN RAISE EXCEPTION 'RLS: hash token MCP membuka perangkat'; END IF;
  PERFORM set_config('app.token_hash', repeat('e', 64), true);
  SELECT count(*) INTO n FROM perangkat_siaga; IF n <> 1 THEN RAISE EXCEPTION 'RLS: pencarian perangkat lewat hash gagal'; END IF;
  PERFORM set_config('app.token_hash', repeat('d', 64), true);
  SELECT count(*) INTO n FROM token_mcp;  IF n <> 0 THEN RAISE EXCEPTION 'RLS: hash salah tetap membuka token'; END IF;
  SELECT count(*) INTO n FROM perangkat_siaga; IF n <> 0 THEN RAISE EXCEPTION 'RLS: hash salah tetap membuka perangkat'; END IF;
  PERFORM set_config('app.token_hash', '', true);
  RESET ROLE;

  -- Worker melayani semua pemilik.
  SET LOCAL ROLE antikebo_worker;
  SELECT count(*) INTO n FROM token_mcp;  IF n < 1 THEN RAISE EXCEPTION 'RLS: worker tidak melihat token'; END IF;
  SELECT count(*) INTO n FROM kejadian_alarm WHERE status = 'menunggu';
  IF n < 1 THEN RAISE EXCEPTION 'RLS: worker tidak melihat kejadian'; END IF;
  SELECT count(*) INTO n FROM naskah_suara WHERE status = 'menunggu';
  IF n < 1 THEN RAISE EXCEPTION 'RLS: worker tidak melihat antrean suara'; END IF;
  SELECT count(*) INTO n FROM langganan_push;
  IF n < 1 THEN RAISE EXCEPTION 'RLS: worker tidak melihat langganan push'; END IF;
  SELECT count(*) INTO n FROM sambungan_tuya;
  IF n < 1 THEN RAISE EXCEPTION 'RLS: worker tidak melihat sambungan Tuya'; END IF;
  RESET ROLE;

  -- Tidak ada peran aplikasi yang superuser atau BYPASSRLS.
  SELECT count(*) INTO n FROM pg_roles WHERE rolname IN ('antikebo_app', 'antikebo_worker', 'antikebo_migrasi') AND (rolsuper OR rolbypassrls);
  IF n <> 0 THEN RAISE EXCEPTION 'RLS: ada peran aplikasi superuser/BYPASSRLS'; END IF;

  -- Semua tabel milik pemilik: ENABLE + FORCE.
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
    WHERE s.nspname = 'public' AND c.relkind = 'r'
      AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'pengguna_id' AND NOT a.attisdropped)
      AND c.relname NOT IN ('sesi', 'status_hak', 'kode_sambung')
      AND NOT (c.relrowsecurity AND c.relforcerowsecurity);
  IF n <> 0 THEN RAISE EXCEPTION 'RLS: ada tabel milik pemilik tanpa ENABLE+FORCE'; END IF;

  RAISE NOTICE 'uji RLS: 51/51 lulus';
END $$;

ROLLBACK;
