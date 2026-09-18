-- Интеграция с Belinda 1C API — раздел УВК (get_uvk).
-- Отдельные таблицы, НЕ трогают monthly_clients/checks/users.
-- Выполните в Supabase SQL Editor.

-- Документы УВК (шапка). Ключ — id из 1С (GUID), используется для upsert.
CREATE TABLE IF NOT EXISTS public.belinda_uvk_documents (
  id TEXT PRIMARY KEY,
  group_name TEXT NOT NULL DEFAULT '',
  employee TEXT NOT NULL DEFAULT '',
  doc_date TIMESTAMPTZ,
  month TEXT NOT NULL DEFAULT '',
  doctype TEXT NOT NULL DEFAULT '',
  raw JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Строки табличной части. При каждой синхронизации документа его строки
-- полностью пересоздаются (delete + insert) — так исключаются дубли,
-- т.к. у строк нет собственного id в 1С.
CREATE TABLE IF NOT EXISTS public.belinda_uvk_items (
  id BIGSERIAL PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES public.belinda_uvk_documents(id) ON DELETE CASCADE,
  client TEXT NOT NULL DEFAULT '',
  article TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  object_name TEXT NOT NULL DEFAULT '',
  orientir TEXT NOT NULL DEFAULT '',
  specialization TEXT NOT NULL DEFAULT '',
  position_name TEXT NOT NULL DEFAULT '',
  issuedamount NUMERIC NOT NULL DEFAULT 0,
  approvedamount NUMERIC NOT NULL DEFAULT 0,
  factamount NUMERIC NOT NULL DEFAULT 0,
  lpu TEXT NOT NULL DEFAULT '',
  lpuname TEXT NOT NULL DEFAULT '',
  debt NUMERIC NOT NULL DEFAULT 0,
  statement NUMERIC NOT NULL DEFAULT 0,
  repayment NUMERIC NOT NULL DEFAULT 0,
  balance NUMERIC NOT NULL DEFAULT 0,
  comment TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_belinda_uvk_items_document_id ON public.belinda_uvk_items (document_id);

-- Журнал запусков синхронизации — отчёт получено/создано/обновлено/ошибки.
CREATE TABLE IF NOT EXISTS public.belinda_sync_log (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL,
  received INT NOT NULL DEFAULT 0,
  created_count INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  errors JSONB,
  status TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: фронтенд (anon key) читает данные для предпросмотра в админке,
-- но НЕ пишет напрямую — запись делает только Edge Function
-- (service role key, который обходит RLS).
ALTER TABLE public.belinda_uvk_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.belinda_uvk_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.belinda_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "belinda_uvk_documents_select" ON public.belinda_uvk_documents;
CREATE POLICY "belinda_uvk_documents_select" ON public.belinda_uvk_documents FOR SELECT USING (true);

DROP POLICY IF EXISTS "belinda_uvk_items_select" ON public.belinda_uvk_items;
CREATE POLICY "belinda_uvk_items_select" ON public.belinda_uvk_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "belinda_sync_log_select" ON public.belinda_sync_log;
CREATE POLICY "belinda_sync_log_select" ON public.belinda_sync_log FOR SELECT USING (true);
