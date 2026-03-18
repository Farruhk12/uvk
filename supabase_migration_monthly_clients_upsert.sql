-- Уникальный ключ для upsert по (месяц, МП, клиент).
-- Сохраняет id при повторной загрузке Excel — чеки остаются привязанными.
-- Выполните в Supabase SQL Editor.

-- 1. Перенаправить чеки с дубликатов на оставляемую строку (с минимальным id)
UPDATE checks c
SET monthly_client_id = keeper.kept_id
FROM (
  SELECT mc.id,
    FIRST_VALUE(mc.id) OVER (PARTITION BY mc.month, mc.mp_name, mc.client ORDER BY mc.id) AS kept_id
  FROM monthly_clients mc
) keeper
WHERE c.monthly_client_id = keeper.id
  AND keeper.id != keeper.kept_id;

-- 2. Удалить дубликаты (оставить одну строку на каждую комбинацию month, mp_name, client)
DELETE FROM monthly_clients
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY month, mp_name, client ORDER BY id) AS rn
    FROM monthly_clients
  ) t
  WHERE rn > 1
);

-- 3. Создать уникальный индекс
CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_clients_upsert_key
  ON monthly_clients(month, mp_name, client);
