-- Кэш результатов "сканирования" get_uvk (список групп/сотрудников/месяцев/типов
-- документа для фильтров). Позволяет открывать вкладку "Belinda" мгновенно,
-- не дожидаясь каждый раз похода в 1С. Обновляется Edge Function при каждом
-- сканировании; читается фронтендом сразу при открытии вкладки.
-- Выполните в Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.belinda_uvk_filter_cache (
  id TEXT PRIMARY KEY DEFAULT 'default',
  total INT NOT NULL DEFAULT 0,
  groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  employees JSONB NOT NULL DEFAULT '[]'::jsonb,
  months JSONB NOT NULL DEFAULT '[]'::jsonb,
  doctypes JSONB NOT NULL DEFAULT '[]'::jsonb,
  areas JSONB NOT NULL DEFAULT '[]'::jsonb,
  regions JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- На случай, если таблица уже была создана раньше без этих колонок:
ALTER TABLE public.belinda_uvk_filter_cache ADD COLUMN IF NOT EXISTS areas JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.belinda_uvk_filter_cache ADD COLUMN IF NOT EXISTS regions JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.belinda_uvk_filter_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "belinda_uvk_filter_cache_select" ON public.belinda_uvk_filter_cache;
CREATE POLICY "belinda_uvk_filter_cache_select" ON public.belinda_uvk_filter_cache FOR SELECT USING (true);
