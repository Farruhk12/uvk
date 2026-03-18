-- Таблица пользователей (МП) — те, кто отправляют чеки.
-- Выполните в Supabase SQL Editor, если таблицы users ещё нет.

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login TEXT NOT NULL,
  pass TEXT NOT NULL DEFAULT '',
  mp_name TEXT NOT NULL,
  oblast TEXT NOT NULL DEFAULT '',
  "group" TEXT NOT NULL DEFAULT ''
);

-- RLS: включить и разрешить чтение/запись для anon (чтобы список отображался после загрузки)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Удалить старую политику, если была (чтобы заменить на явные)
DROP POLICY IF EXISTS "Allow all for users" ON public.users;

-- Явные политики: без них данные сохраняются, но SELECT вернёт пустой список
CREATE POLICY "users_select" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_insert" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update" ON public.users FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "users_delete" ON public.users FOR DELETE USING (true);

-- Индекс для входа по логину (уникальность login — если ещё нет: ALTER TABLE public.users ADD CONSTRAINT users_login_key UNIQUE (login);)
CREATE INDEX IF NOT EXISTS idx_users_login ON public.users (login);
