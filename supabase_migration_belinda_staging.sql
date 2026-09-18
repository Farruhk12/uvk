-- Тестовая (staging) таблица для интеграции с Belinda 1С.
-- Структура ПОВТОРЯЕТ monthly_clients — чтобы после проверки данные можно было
-- перенести туда тем же способом, каким сейчас работает загрузка Excel.
-- НЕ затрагивает monthly_clients/checks/users — можно тестировать без риска
-- для текущей работы МП.
-- Выполните в Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.belinda_monthly_clients_staging (
  id BIGSERIAL PRIMARY KEY,
  month TEXT NOT NULL DEFAULT '',
  mp_name TEXT NOT NULL DEFAULT '',
  client TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT '',
  spec TEXT NOT NULL DEFAULT '',
  ab TEXT NOT NULL DEFAULT '',
  "group" TEXT NOT NULL DEFAULT '',
  lpu TEXT NOT NULL DEFAULT '',
  oblast TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  articul TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  object_type TEXT NOT NULL DEFAULT '',
  orientir TEXT NOT NULL DEFAULT '',
  dolzhnost TEXT NOT NULL DEFAULT '',
  amount_issued TEXT NOT NULL DEFAULT '',
  approved_amount TEXT NOT NULL DEFAULT '',
  actual_amount TEXT NOT NULL DEFAULT '',
  -- Служебные поля источника (для отладки и повторной синхронизации без дублей).
  source_doc_id TEXT NOT NULL DEFAULT '',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Уникальный ключ — тот же принцип, что и у monthly_clients (month, mp_name, client).
CREATE UNIQUE INDEX IF NOT EXISTS idx_belinda_staging_key
  ON public.belinda_monthly_clients_staging (month, mp_name, client);

ALTER TABLE public.belinda_monthly_clients_staging ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "belinda_staging_select" ON public.belinda_monthly_clients_staging;
CREATE POLICY "belinda_staging_select" ON public.belinda_monthly_clients_staging FOR SELECT USING (true);
