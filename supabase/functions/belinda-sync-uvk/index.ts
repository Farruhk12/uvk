// Edge Function: интеграция УВК (СДК) из Belinda 1C API.
//
// Три режима вызова (POST, JSON body):
//   { "mode": "scan" }
//     — быстро тянет get_uvk, возвращает стандартизованные месяцы (из поля
//       date, а не грязного поля month из 1С) и типы документов + общее
//       число документов. НИЧЕГО не пишет в БД.
//   { "mode": "preview", "filters": { months?, doctypes?, dateFrom?, dateTo? } }
//     — тянет документы под фильтры, превращает в строки в формате
//       monthly_clients и ВОЗВРАЩАЕТ их клиенту. НИЧЕГО не пишет в БД —
//       это просмотр перед подтверждением.
//   { "mode": "commit", "rows": [...] }
//     — принимает строки, которые фронтенд уже показал пользователю
//       (результат preview), и записывает их в тестовую таблицу
//       belinda_monthly_clients_staging (НЕ в боевую monthly_clients).
//       Ключ — (source_doc_id, item_index): один визит = одна строка,
//       без дублей при повторной отправке.
//
// Деплой: только через Supabase Dashboard -> Edge Functions -> belinda-sync-uvk -> Code
// (в этом окружении CLI недоступен из-за политики безопасности Windows).
//
// Если 1С требует авторизацию — задайте секреты в Dashboard -> Edge Functions -> Secrets:
//   BELINDA_API_TOKEN=xxxxx                        (Bearer)
//   BELINDA_API_LOGIN=xxx  BELINDA_API_PASSWORD=yyy (Basic — этот сервер использует именно его)
// SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY доступны автоматически.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const BELINDA_BASE_URL = 'https://1c.belinda.tj/Belinda/hs/obmenuz';
const WRITE_CHUNK_SIZE = 300;

const RU_MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });

const numOrEmpty = (v: unknown): string => {
  if (v == null || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : '';
};

const strOrEmpty = (v: unknown): string => (v == null ? '' : String(v).trim());

/** Месяц в формате "Январь 2026" — из ISO-даты документа, а не из грязного поля 1С `month`. */
const monthFromIsoDate = (iso: unknown): string => {
  if (typeof iso !== 'string' || !iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${RU_MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
};

/** Ключ для хронологической сортировки месяцев вида "Январь 2026". */
const monthSortKey = (label: string): number => {
  const [name, yearStr] = label.split(' ');
  const idx = RU_MONTH_NAMES.indexOf(name);
  const year = Number(yearStr) || 0;
  return year * 100 + (idx >= 0 ? idx : 0);
};

// Область есть и в шапке документа (area_main), и в строке (items[].area) —
// приоритет у area_main как более авторитетного значения, area строки — запасной вариант.
const effectiveArea = (doc: Record<string, unknown>, it: Record<string, unknown> | null | undefined): string =>
  strOrEmpty(doc.area_main) || strOrEmpty(it?.area);

const chunkArray = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

interface SyncError {
  id?: string;
  message: string;
}

interface Filters {
  months?: string[];
  doctypes?: string[];
  dateFrom?: string; // "YYYY-MM-DD"
  dateTo?: string; // "YYYY-MM-DD"
}

// Фильтры по шапке документа (месяц считается из date, не из грязного поля 1С month).
const matchesHeaderFilters = (doc: Record<string, unknown>, filters: Filters): boolean => {
  if (filters.months?.length && !filters.months.includes(monthFromIsoDate(doc.date))) return false;
  if (filters.doctypes?.length && !filters.doctypes.includes(strOrEmpty(doc.doctype))) return false;
  if (filters.dateFrom || filters.dateTo) {
    const d = typeof doc.date === 'string' ? doc.date.slice(0, 10) : '';
    if (!d) return false;
    if (filters.dateFrom && d < filters.dateFrom) return false;
    if (filters.dateTo && d > filters.dateTo) return false;
  }
  return true;
};

async function fetchBelindaUvk(): Promise<{ ok: true; data: Record<string, unknown>[] } | { ok: false; status: number; message: string }> {
  const bearerToken = Deno.env.get('BELINDA_API_TOKEN');
  const basicLogin = Deno.env.get('BELINDA_API_LOGIN');
  const basicPassword = Deno.env.get('BELINDA_API_PASSWORD');

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  } else if (basicLogin && basicPassword) {
    headers.Authorization = `Basic ${btoa(`${basicLogin}:${basicPassword}`)}`;
  }

  // Сервер 1С отдаёт битый HTTP/2 (h2 error: unspecific protocol error) —
  // форсируем HTTP/1.1 для соединения с ним через кастомный клиент Deno.
  let http1Client: any;
  try {
    // @ts-ignore: Deno.createHttpClient — нестабильный API, доступен в Supabase Edge Runtime
    http1Client = Deno.createHttpClient({ http1: true, http2: false });
  } catch {
    http1Client = undefined;
  }

  let res: Response;
  try {
    res = await fetch(`${BELINDA_BASE_URL}/get_uvk`, {
      method: 'GET',
      headers,
      // @ts-ignore: client — расширение Deno fetch, недоступно в стандартных lib.dom.d.ts
      client: http1Client
    });
  } catch (e) {
    return { ok: false, status: 502, message: `Не удалось соединиться с 1С API: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      status: res.status,
      message:
        'Требуется авторизация к 1С API (получен HTTP ' +
        res.status +
        '). Уточните у разработчика 1С тип авторизации и задайте секреты BELINDA_API_TOKEN или BELINDA_API_LOGIN/BELINDA_API_PASSWORD для Edge Function.'
    };
  }

  if (!res.ok) {
    return { ok: false, status: 502, message: `1С API вернул ошибку HTTP ${res.status}` };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, status: 502, message: 'Ответ 1С API не является корректным JSON' };
  }

  if (!Array.isArray(data)) {
    return { ok: false, status: 502, message: 'Ожидался массив документов в ответе get_uvk, получена другая структура' };
  }

  return { ok: true, data: data as Record<string, unknown>[] };
}

/** Строит строки в формате monthly_clients (один item = одна строка) из документов 1С. */
function buildRows(docsInScope: Record<string, unknown>[]): {
  rows: Record<string, unknown>[];
  failed: number;
  errors: SyncError[];
} {
  let failed = 0;
  const errors: SyncError[] = [];
  const rows: Record<string, unknown>[] = [];

  for (const doc of docsInScope) {
    const docId = doc?.id != null ? String(doc.id) : '';
    if (!docId) {
      failed++;
      errors.push({ message: 'Документ без id — пропущен' });
      continue;
    }

    const month = monthFromIsoDate(doc.date);
    const mpName = strOrEmpty(doc.employee);

    if (!month || !mpName) {
      failed++;
      errors.push({ id: docId, message: 'Не удалось определить месяц (date) или сотрудника (employee) — документ пропущен' });
      continue;
    }

    const items = Array.isArray(doc.items) ? (doc.items as Record<string, unknown>[]) : [];

    items.forEach((it, itemIndex) => {
      const client = strOrEmpty(it?.client);
      if (!client) {
        failed++;
        const hints = [
          `группа: ${strOrEmpty(doc.group) || '—'}`,
          `сотрудник: ${strOrEmpty(doc.employee) || '—'}`,
          `месяц: ${month || '—'}`,
          `тип: ${strOrEmpty(doc.doctype) || '—'}`,
          `строка №${itemIndex + 1} в документе`,
          `артикул: ${strOrEmpty(it?.article) || '—'}`,
          `ЛПУ: ${strOrEmpty(it?.lpuname) || strOrEmpty(it?.lpu) || '—'}`,
          `специальность: ${strOrEmpty(it?.specialization) || '—'}`
        ].join(', ');
        errors.push({ id: docId, message: `Строка без клиента — пропущена (${hints})` });
        return;
      }

      rows.push({
        month,
        mp_name: mpName,
        client,
        type: strOrEmpty(doc.doctype),
        spec: strOrEmpty(it?.specialization),
        ab: '',
        group: strOrEmpty(doc.group),
        lpu: strOrEmpty(it?.lpuname) || strOrEmpty(it?.lpu),
        oblast: effectiveArea(doc, it),
        date: strOrEmpty(doc.date),
        articul: strOrEmpty(it?.article),
        region: strOrEmpty(it?.region),
        object_type: strOrEmpty(it?.object),
        orientir: strOrEmpty(it?.orientir),
        dolzhnost: strOrEmpty(it?.position),
        amount_issued: numOrEmpty(it?.issuedamount),
        approved_amount: numOrEmpty(it?.approvedamount),
        actual_amount: numOrEmpty(it?.factamount),
        source_doc_id: docId,
        item_index: itemIndex
      });
    });
  }

  return { rows, failed, errors };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const startedAt = new Date().toISOString();

  let mode: string | null = null;
  let filters: Filters = {};
  let commitRows: Record<string, unknown>[] = [];
  try {
    const body = await req.json().catch(() => ({}));
    if (body && typeof body.mode === 'string') mode = body.mode;
    if (body && body.filters && typeof body.filters === 'object') filters = body.filters as Filters;
    if (body && Array.isArray(body.rows)) commitRows = body.rows;
  } catch {
    // тело не обязательно
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ success: false, error: 'Не настроены SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY в Edge Function' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ——— Режим commit: ничего не тянем из 1С, просто записываем присланные строки ———
  if (mode === 'commit') {
    if (commitRows.length === 0) {
      return jsonResponse({ success: false, error: 'Нет строк для отправки' }, 400);
    }

    // На случай дублей ключа внутри одного запроса — оставляем последнюю.
    const dedupedMap = new Map<string, Record<string, unknown>>();
    for (const r of commitRows) {
      const key = `${r.source_doc_id}|${r.item_index}`;
      dedupedMap.set(key, { ...r, synced_at: new Date().toISOString() });
    }
    const deduped = [...dedupedMap.values()];

    const existingKeys = new Set<string>();
    for (const chunk of chunkArray(deduped, WRITE_CHUNK_SIZE)) {
      const docIds = [...new Set(chunk.map((r) => r.source_doc_id as string))];
      const { data: existingRows, error: existingError } = await supabase
        .from('belinda_monthly_clients_staging')
        .select('source_doc_id, item_index')
        .in('source_doc_id', docIds);
      if (existingError) {
        return jsonResponse({ success: false, error: `Не удалось проверить существующие строки: ${existingError.message}` }, 500);
      }
      (existingRows || []).forEach((r: any) => existingKeys.add(`${r.source_doc_id}|${r.item_index}`));
    }

    let created = 0;
    let updated = 0;
    let failed = 0;
    const errors: SyncError[] = [];

    for (const chunk of chunkArray(deduped, WRITE_CHUNK_SIZE)) {
      const { error: upsertError } = await supabase
        .from('belinda_monthly_clients_staging')
        .upsert(chunk, { onConflict: 'source_doc_id,item_index' });

      if (upsertError) {
        failed += chunk.length;
        errors.push({ message: `Ошибка сохранения строк: ${upsertError.message}` });
        continue;
      }

      chunk.forEach((r) => {
        const key = `${r.source_doc_id}|${r.item_index}`;
        existingKeys.has(key) ? updated++ : created++;
      });
    }

    const report = { received: deduped.length, created, updated, failed, errors };
    const status = failed === 0 && errors.length === 0 ? 'success' : created + updated > 0 ? 'partial' : 'error';
    await logRun(supabase, startedAt, report, status);

    return jsonResponse({ success: failed === 0 || created + updated > 0, report });
  }

  // ——— scan и preview требуют похода в 1С ———
  const fetched = await fetchBelindaUvk();
  if (!fetched.ok) {
    return jsonResponse({ success: false, error: fetched.message }, fetched.status);
  }

  const allDocs = fetched.data;

  // ——— Режим сканирования: стандартизованные месяцы + типы документов. Ничего не пишем (кроме кэша). ———
  if (mode === 'scan') {
    const months = new Set<string>();
    const doctypes = new Set<string>();

    for (const doc of allDocs) {
      const m = monthFromIsoDate(doc.date);
      const dt = strOrEmpty(doc.doctype);
      if (m) months.add(m);
      if (dt) doctypes.add(dt);
    }

    const scanResult = {
      total: allDocs.length,
      months: [...months].sort((a, b) => monthSortKey(a) - monthSortKey(b)),
      doctypes: [...doctypes].sort()
    };

    // Кэшируем, чтобы вкладка открывалась мгновенно и не ждала поход в 1С каждый раз.
    try {
      await supabase.from('belinda_uvk_filter_cache').upsert(
        {
          id: 'default',
          total: scanResult.total,
          months: scanResult.months,
          doctypes: scanResult.doctypes,
          groups: [],
          employees: [],
          areas: [],
          regions: [],
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      );
    } catch (e) {
      console.error('Failed to write belinda_uvk_filter_cache:', e);
    }

    return jsonResponse({ success: true, scan: scanResult });
  }

  // ——— Режим preview: фильтруем и превращаем в строки, но НИЧЕГО не пишем в БД ———
  if (mode === 'preview') {
    const docsInScope = allDocs.filter((d) => matchesHeaderFilters(d, filters));
    const { rows, failed, errors } = buildRows(docsInScope);
    return jsonResponse({ success: true, rows, failed, errors });
  }

  return jsonResponse({ success: false, error: `Неизвестный режим: ${mode}` }, 400);
});

async function logRun(
  supabase: ReturnType<typeof createClient>,
  startedAt: string,
  report: { received: number; created: number; updated: number; failed: number; errors: SyncError[] },
  status: string
) {
  try {
    await supabase.from('belinda_sync_log').insert({
      source: 'get_uvk',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      received: report.received,
      created_count: report.created,
      updated_count: report.updated,
      failed: report.failed,
      errors: report.errors,
      status
    });
  } catch (e) {
    console.error('Failed to write belinda_sync_log:', e);
  }
}
