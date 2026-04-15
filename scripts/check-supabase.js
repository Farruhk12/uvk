/**
 * Проверка подключения к Supabase.
 * Запуск: node scripts/check-supabase.js
 * Требует: VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env.local
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) {
    console.error('❌ Файл .env.local не найден');
    process.exit(1);
  }
  const content = readFileSync(envPath, 'utf-8');
  const env = {};
  content.split('\n').forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  });
  return env;
}

async function main() {
  console.log('🔍 Проверка подключения к Supabase...\n');

  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('❌ В .env.local не заданы VITE_SUPABASE_URL и/или VITE_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  console.log('✓ URL:', url);
  console.log('✓ Anon Key: задан\n');

  const supabase = createClient(url, key);

  // 1. Проверка managers
  try {
    const { data, error } = await supabase.from('managers').select('id').limit(1);
    if (error) throw error;
    console.log('✓ Таблица managers: OK');
  } catch (e) {
    console.log('❌ Таблица managers:', e.message);
  }

  // 2. Проверка users
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) throw error;
    console.log('✓ Таблица users: OK');
  } catch (e) {
    console.log('❌ Таблица users:', e.message);
  }

  // 3. Проверка monthly_clients
  try {
    const { data, error } = await supabase.from('monthly_clients').select('id').limit(1);
    if (error) throw error;
    console.log('✓ Таблица monthly_clients: OK');
  } catch (e) {
    console.log('❌ Таблица monthly_clients:', e.message);
  }

  // 4. Проверка checks
  try {
    const { data, error } = await supabase.from('checks').select('id').limit(1);
    if (error) throw error;
    console.log('✓ Таблица checks: OK');
  } catch (e) {
    console.log('❌ Таблица checks:', e.message);
  }

  // 5. Проверка Storage
  try {
    const { data, error } = await supabase.storage.from('checks').list('', { limit: 1 });
    if (error) throw error;
    console.log('✓ Storage bucket "checks": OK');
  } catch (e) {
    console.log('❌ Storage bucket "checks":', e.message);
  }

  console.log('\n✅ Проверка завершена');
}

main().catch((e) => {
  console.error('Ошибка:', e);
  process.exit(1);
});
