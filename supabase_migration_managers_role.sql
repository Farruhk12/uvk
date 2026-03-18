-- Добавить колонку role в таблицу managers (если её ещё нет).
-- Выполните в Supabase SQL Editor.

ALTER TABLE managers
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'manager';

-- role: 'admin' = администратор (полный или ограниченный доступ по областям)
-- role: 'manager' = менеджер (только Мониторинг, доступ по областям и группам)
