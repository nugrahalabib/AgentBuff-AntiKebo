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

  -- Hash token: tepat satu baris terlihat tanpa konteks pemilik; hash lain nol.
  PERFORM set_config('app.pengguna_id', '', true);
  PERFORM set_config('app.token_hash', repeat('c', 64), true);
  SELECT count(*) INTO n FROM token_mcp;  IF n <> 1 THEN RAISE EXCEPTION 'RLS: pencarian token lewat hash gagal'; END IF;
  PERFORM set_config('app.token_hash', repeat('d', 64), true);
  SELECT count(*) INTO n FROM token_mcp;  IF n <> 0 THEN RAISE EXCEPTION 'RLS: hash salah tetap membuka token'; END IF;
  PERFORM set_config('app.token_hash', '', true);
  RESET ROLE;

  -- Worker melayani semua pemilik.
  SET LOCAL ROLE antikebo_worker;
  SELECT count(*) INTO n FROM token_mcp;  IF n < 1 THEN RAISE EXCEPTION 'RLS: worker tidak melihat token'; END IF;
  SELECT count(*) INTO n FROM kejadian_alarm WHERE status = 'menunggu';
  IF n < 1 THEN RAISE EXCEPTION 'RLS: worker tidak melihat kejadian'; END IF;
  RESET ROLE;

  -- Tidak ada peran aplikasi yang superuser atau BYPASSRLS.
  SELECT count(*) INTO n FROM pg_roles WHERE rolname IN ('antikebo_app', 'antikebo_worker', 'antikebo_migrasi') AND (rolsuper OR rolbypassrls);
  IF n <> 0 THEN RAISE EXCEPTION 'RLS: ada peran aplikasi superuser/BYPASSRLS'; END IF;

  -- Semua tabel milik pemilik: ENABLE + FORCE.
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace
    WHERE s.nspname = 'public' AND c.relkind = 'r'
      AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'pengguna_id' AND NOT a.attisdropped)
      AND c.relname NOT IN ('sesi', 'status_hak')
      AND NOT (c.relrowsecurity AND c.relforcerowsecurity);
  IF n <> 0 THEN RAISE EXCEPTION 'RLS: ada tabel milik pemilik tanpa ENABLE+FORCE'; END IF;

  RAISE NOTICE 'uji RLS: 22/22 lulus';
END $$;

ROLLBACK;
