-- Бакет и политики для загрузки чеков (фото).
-- Выполните в Supabase → SQL Editor, чтобы отправка чеков работала.
-- Если INSERT в storage.buckets выдаст ошибку — создайте бакет вручную: Storage → New bucket → id: checks, Public: включено. Затем выполните только блоки 2 и 3.

-- 1. Создать бакет 'checks' (публичный — ссылки на фото доступны по URL)
-- Если бакет уже создан вручную в Dashboard, этот запрос можно пропустить или выполнить: он обновит public.
INSERT INTO storage.buckets (id, name, public)
VALUES ('checks', 'checks', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Разрешить анонимную загрузку в бакет checks (для отправки чеков без Supabase Auth)
DROP POLICY IF EXISTS "Allow anon upload checks" ON storage.objects;
CREATE POLICY "Allow anon upload checks"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'checks');

-- 3. Разрешить всем чтение из бакета (просмотр фото в админке)
DROP POLICY IF EXISTS "Allow public read checks" ON storage.objects;
CREATE POLICY "Allow public read checks"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'checks');
