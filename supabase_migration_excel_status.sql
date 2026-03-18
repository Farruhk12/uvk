-- Добавить колонку excel_status для статуса «Отправлено» из Excel.
-- Врачи с этим статусом отображаются в профиле МП как отправившие чек.
-- Выполните в Supabase SQL Editor.

ALTER TABLE monthly_clients
  ADD COLUMN IF NOT EXISTS excel_status TEXT DEFAULT '';
