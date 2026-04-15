-- Разрешить удаление файлов в бакете checks (для удаления отклонённых чеков).
-- Выполните в Supabase SQL Editor после supabase_migration_storage_checks.sql.

DROP POLICY IF EXISTS "Allow anon delete checks" ON storage.objects;
CREATE POLICY "Allow anon delete checks"
  ON storage.objects FOR DELETE
  TO anon
  USING (bucket_id = 'checks');
