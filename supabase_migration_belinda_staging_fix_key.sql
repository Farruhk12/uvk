-- Исправление ключа уникальности staging-таблицы Belinda УВК.
--
-- Проблема: ключ (month, mp_name, client) схлопывал повторные визиты одного
-- клиента у одного МП в течение месяца в одну строку — реальные данные 1С
-- такие повторы содержат (один клиент может быть в нескольких строках/визитах
-- за месяц), и часть строк терялась при повторной синхронизации.
--
-- Решение: новый ключ — (source_doc_id, item_index), т.е. документ 1С + позиция
-- строки внутри него. Каждый визит хранится отдельной строкой, повторная
-- синхронизация того же документа обновляет те же строки, а не плодит дубли.
--
-- Выполните в Supabase SQL Editor.

ALTER TABLE public.belinda_monthly_clients_staging
  ADD COLUMN IF NOT EXISTS item_index INT NOT NULL DEFAULT 0;

-- ВАЖНО: очистить ДО создания уникального индекса — у всех старых строк
-- item_index только что стал 0 (значение по умолчанию), поэтому строки одного
-- документа сейчас дублируют друг друга по новому ключу.
TRUNCATE TABLE public.belinda_monthly_clients_staging;

DROP INDEX IF EXISTS idx_belinda_staging_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_belinda_staging_key
  ON public.belinda_monthly_clients_staging (source_doc_id, item_index);
