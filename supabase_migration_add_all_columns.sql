-- Добавить все столбцы из Excel в monthly_clients (18 колонок).
-- Выполните в Supabase SQL Editor.

ALTER TABLE monthly_clients
  ADD COLUMN IF NOT EXISTS date TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS articul TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS region TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS object_type TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS orientir TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS dolzhnost TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS amount_issued TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS approved_amount TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS actual_amount TEXT DEFAULT '';
