-- Очистка тестовых данных Belinda УВК перед повторным сбором.
-- Затрагивает ТОЛЬКО тестовые таблицы belinda_uvk_* — monthly_clients/checks/users не трогаются.
-- Выполните в Supabase SQL Editor.

TRUNCATE TABLE public.belinda_uvk_items, public.belinda_uvk_documents;
TRUNCATE TABLE public.belinda_sync_log;
