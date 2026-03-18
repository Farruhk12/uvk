-- Разрешить перезапись файлов в бакете checks (для сжатия существующих чеков).
-- Выполните в Supabase SQL Editor после supabase_migration_storage_checks.sql.

DROP POLICY IF EXISTS "Allow anon update checks" ON storage.objects;
CREATE POLICY "Allow anon update checks"
  ON storage.objects FOR UPDATE
  TO anon
  USING (bucket_id = 'checks')
  WITH CHECK (bucket_id = 'checks');
