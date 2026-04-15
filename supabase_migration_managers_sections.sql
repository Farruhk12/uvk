-- Добавить колонку assigned_sections в таблицу managers.
-- Пустой массив = доступ ко всем разделам.
-- Значения: 'monitoring', 'checks', 'database', 'managers', 'users'
-- Выполните в Supabase SQL Editor.

ALTER TABLE managers
  ADD COLUMN IF NOT EXISTS assigned_sections TEXT[] DEFAULT '{}';
