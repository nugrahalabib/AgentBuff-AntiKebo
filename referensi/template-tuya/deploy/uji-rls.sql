-- Uji isolasi data di produksi SETIAP deploy (dijalankan superuser, semua di
-- dalam transaksi yang DIBATALKAN - tidak ada yang tersimpan). Gagal satu =
-- deploy berhenti sebelum web baru menyala.
BEGIN;

INSERT INTO pengguna (id, agentbuff_sub, email) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'uji_rls_a', 'a@uji.internal'),
  ('00000000-0000-4000-8000-0000000000b2', 'uji_rls_b', 'b@uji.internal');
INSERT INTO sambungan_tuya (pengguna_id, kunci_sandi, kunci_samar, wilayah) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'TY1-sandi-uji', 'sk-AZ••••uji1', 'AZ');
INSERT INTO perangkat (pengguna_id, device_id, nama, kategori) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'uji-dev', 'Lampu Uji', 'dj');
INSERT INTO token_mcp (pengguna_id, label, hash, awalan, sumber) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'uji', repeat('c', 64), 'tuya_uji1', 'manual');
INSERT INTO otomasi (pengguna_id, nama, pemicu, aksi, dibuat_oleh) VALUES
  ('00000000-0000-4000-8000-0000000000a1', 'Otomasi Uji', '{}'::jsonb, '[]'::jsonb, 'web');
INSERT INTO foto_kamera (pengguna_id, kunci, device_id, nama_perangkat, jenis, mime, isi, ukuran, sumber, kedaluwarsa) VALUES
  ('00000000-0000-4000-8000-0000000000a1', repeat('k', 32), 'uji-cam', 'Kamera Uji', 'foto', 'image/jpeg', decode('ffd8ff', 'hex'), 3, 'agen', now() + interval '1 day');

DO $$
DECLARE n int;
BEGIN
  SET LOCAL ROLE tuya_app;

  -- Tanpa konteks: nol baris di semua tabel milik pemilik.
  PERFORM set_config('app.pengguna_id', '', true);
  SELECT count(*) INTO n FROM perangkat;       IF n <> 0 THEN RAISE EXCEPTION 'RLS: perangkat terbaca tanpa konteks'; END IF;
  SELECT count(*) INTO n FROM sambungan_tuya;  IF n <> 0 THEN RAISE EXCEPTION 'RLS: kunci terbaca tanpa konteks'; END IF;
  SELECT count(*) INTO n FROM token_mcp;       IF n <> 0 THEN RAISE EXCEPTION 'RLS: token terbaca tanpa konteks'; END IF;
  SELECT count(*) INTO n FROM otomasi;         IF n <> 0 THEN RAISE EXCEPTION 'RLS: otomasi terbaca tanpa konteks'; END IF;
  SELECT count(*) INTO n FROM foto_kamera;     IF n <> 0 THEN RAISE EXCEPTION 'RLS: foto kamera terbaca tanpa konteks'; END IF;

  -- Konteks B: tidak melihat milik A.
  PERFORM set_config('app.pengguna_id', '00000000-0000-4000-8000-0000000000b2', true);
  SELECT count(*) INTO n FROM perangkat WHERE device_id = 'uji-dev';  IF n <> 0 THEN RAISE EXCEPTION 'RLS: B melihat perangkat A'; END IF;
  SELECT count(*) INTO n FROM sambungan_tuya;                         IF n <> 0 THEN RAISE EXCEPTION 'RLS: B melihat kunci A'; END IF;
  SELECT count(*) INTO n FROM otomasi;                                IF n <> 0 THEN RAISE EXCEPTION 'RLS: B melihat otomasi A'; END IF;
  SELECT count(*) INTO n FROM foto_kamera;                            IF n <> 0 THEN RAISE EXCEPTION 'RLS: B melihat foto kamera A'; END IF;
  DELETE FROM foto_kamera;
  GET DIAGNOSTICS n = ROW_COUNT;                                      IF n <> 0 THEN RAISE EXCEPTION 'RLS: B menghapus foto kamera A'; END IF;
  UPDATE perangkat SET nama = 'diretas' WHERE device_id = 'uji-dev';
  GET DIAGNOSTICS n = ROW_COUNT;                                      IF n <> 0 THEN RAISE EXCEPTION 'RLS: B mengubah perangkat A'; END IF;

  -- Konteks A: melihat miliknya.
  PERFORM set_config('app.pengguna_id', '00000000-0000-4000-8000-0000000000a1', true);
  SELECT count(*) INTO n FROM perangkat WHERE device_id = 'uji-dev';  IF n <> 1 THEN RAISE EXCEPTION 'RLS: A tidak melihat perangkatnya'; END IF;

  -- Hash token: tepat satu baris terlihat tanpa konteks pemilik.
  PERFORM set_config('app.pengguna_id', '', true);
  PERFORM set_config('app.token_hash', repeat('c', 64), true);
  SELECT count(*) INTO n FROM token_mcp;                              IF n <> 1 THEN RAISE EXCEPTION 'RLS: pencarian token lewat hash gagal'; END IF;
  PERFORM set_config('app.token_hash', '', true);

  -- Tautan foto: kunci yang benar membuka tepat satu baris, kunci lain nol.
  PERFORM set_config('app.foto_kunci', repeat('k', 32), true);
  SELECT count(*) INTO n FROM foto_kamera;                            IF n <> 1 THEN RAISE EXCEPTION 'RLS: tautan foto lewat kunci gagal'; END IF;
  PERFORM set_config('app.foto_kunci', repeat('z', 32), true);
  SELECT count(*) INTO n FROM foto_kamera;                            IF n <> 0 THEN RAISE EXCEPTION 'RLS: kunci foto salah tetap membuka'; END IF;

  RESET ROLE;
  RAISE NOTICE 'uji RLS: 12/12 lulus';
END $$;

ROLLBACK;
