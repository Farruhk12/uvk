import { getSupabaseClient } from './supabaseClient';
import { compressImage } from '../utils/image';
import {
  User,
  Client,
  ApiResponse,
  UploadPayload,
  ManagerProfile,
  FilterData,
  CheckWithClient,
  MpUser
} from '../types';

const supabase = getSupabaseClient();

const normalize = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();

export const fetchManagers = async (): Promise<ManagerProfile[]> => {
  try {
    const { data, error } = await supabase
      .from('managers')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching managers from Supabase:', error);
      return [];
    }

    if (!data) return [];

    return data.map((m: any) => ({
      id: String(m.id),
      name: normalize(m.name),
      login: normalize(m.login),
      pass: normalize(m.pass),
      role: (m.role === 'admin' ? 'admin' : 'manager') as 'admin' | 'manager',
      assignedEmployees: [],
      assignedOblasts: Array.isArray(m.assigned_oblasts) ? m.assigned_oblasts : [],
      assignedGroups: Array.isArray(m.assigned_groups) ? m.assigned_groups : [],
      assignedSections: Array.isArray(m.assigned_sections) ? m.assigned_sections : []
    }));
  } catch (e) {
    console.error('Error fetching managers:', e);
    return [];
  }
};

export const saveManagerApi = async (manager: ManagerProfile): Promise<ApiResponse> => {
  const { id, name, login, pass, role, assignedOblasts, assignedGroups, assignedSections } = manager;

  const payloadWithSections = {
    id,
    name,
    login,
    pass,
    role: role || 'manager',
    assigned_oblasts: assignedOblasts || [],
    assigned_groups: assignedGroups || [],
    assigned_sections: assignedSections || []
  };

  const payloadWithoutSections = {
    id,
    name,
    login,
    pass,
    role: role || 'manager',
    assigned_oblasts: assignedOblasts || [],
    assigned_groups: assignedGroups || []
  };

  let { error } = await supabase.from('managers').upsert(payloadWithSections, { onConflict: 'id' });

  if (error && /column .* does not exist|assigned_sections/i.test(error.message)) {
    error = (await supabase.from('managers').upsert(payloadWithoutSections, { onConflict: 'id' })).error;
    if (!error) {
      return {
        success: true,
        warning: 'Сохранено. Для доступа к разделам выполните миграцию supabase_migration_managers_sections.sql в Supabase.'
      };
    }
  }

  if (error) {
    console.error('Error saving manager:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
};

export const deleteManagerApi = async (id: string): Promise<ApiResponse> => {
  const { error } = await supabase.from('managers').delete().eq('id', id);

  if (error) {
    console.error('Error deleting manager:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
};

export const loginUser = async (login: string, pass: string): Promise<User> => {
  const trimmedLogin = login.trim();
  const cleanLogin = trimmedLogin.toLowerCase();
  const cleanPass = pass.trim();

  // 1. Check Hardcoded Admin (Always works)
  if (cleanLogin === 'фаррух' && cleanPass === '900') {
    return {
      success: true,
      mpName: 'Фаррух',
      role: 'admin'
    };
  }

  // 2. Check Managers (Supabase) — ilike для регистронезависимого логина (Мам/мам)
  try {
    const { data, error } = await supabase
      .from('managers')
      .select('*')
      .ilike('login', cleanLogin)
      .eq('pass', cleanPass)
      .maybeSingle();

    if (!error && data) {
      const role: 'admin' | 'manager' = (data.role === 'admin' ? 'admin' : 'manager') as
        | 'admin'
        | 'manager';

      return {
        success: true,
        mpName: normalize(data.name),
        role,
        assignedEmployees: [],
        assignedOblasts: Array.isArray(data.assigned_oblasts)
          ? data.assigned_oblasts
          : [],
        assignedGroups: Array.isArray(data.assigned_groups)
          ? data.assigned_groups
          : [],
        assignedSections: Array.isArray(data.assigned_sections)
          ? data.assigned_sections
          : []
      };
    }
  } catch (e) {
    console.warn('Manager login check failed, trying regular user...', e);
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .ilike('login', cleanLogin)
      .eq('pass', cleanPass)
      .maybeSingle();

    if (error) {
      console.error('User login query failed:', error);
      return {
        success: false,
        mpName: '',
        error: 'Ошибка соединения с сервером'
      };
    }

    if (data) {
      return {
        success: true,
        mpName: normalize(data.mp_name),
        role: 'user'
      };
    }

    return {
      success: false,
      mpName: '',
      error: 'Неверный логин или пароль'
    };
  } catch (e) {
    console.error('Unexpected error during login:', e);
    return {
      success: false,
      mpName: '',
      error: 'Ошибка соединения с сервером'
    };
  }
};

export const fetchClients = async (mpName: string, month: string): Promise<Client[]> => {
  const { data, error } = await supabase
    .from('monthly_clients')
    .select('*')
    .eq('mp_name', mpName)
    .eq('month', month)
    .order('client', { ascending: true });

  if (error) {
    console.error('Error fetching clients:', error);
    throw new Error(error.message);
  }

  if (!data) return [];

  // Fetch checks for these clients to enrich status / comments
  const clientIds = data.map((row: any) => row.id);
  let checksByClientId: Record<string, any[]> = {};

  if (clientIds.length > 0) {
    const { data: checks, error: checksError } = await supabase
      .from('checks')
      .select('*')
      .in('monthly_client_id', clientIds);

    if (checksError) {
      console.error('Error fetching checks for clients:', checksError);
    } else if (checks) {
      checksByClientId = checks.reduce((acc: Record<string, any[]>, check: any) => {
        const key = String(check.monthly_client_id);
        if (!acc[key]) acc[key] = [];
        acc[key].push(check);
        return acc;
      }, {});
    }
  }

  return data.map((row: any) => {
    const rowId = String(row.id);
    const checksForClient = checksByClientId[rowId] || [];
    // Берём самый последний чек как актуальный
    const lastCheck = checksForClient.sort(
      (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
    )[checksForClient.length - 1];

    const checkStatus = lastCheck?.status ?? undefined;
    const checkComment = lastCheck?.admin_comment ?? undefined;

    const excelStatus = normalize((row as any).excel_status || '');
    const status =
      checksForClient.length > 0 ? 'отправлено' : excelStatus.toLowerCase().includes('отправлено') ? 'отправлено' : '';

    const client: Client = {
      id: row.id,
      client: normalize(row.client),
      type: normalize(row.type),
      spec: normalize(row.spec),
      ab: normalize(row.ab),
      group: normalize(row.group),
      lpu: normalize(row.lpu),
      oblast: normalize(row.oblast),
      status,
      checkStatus,
      checkComment
    };

    return client;
  });
};

export const uploadCheck = async (payload: UploadPayload): Promise<ApiResponse> => {
  const { clientData, fileData } = payload;

  const monthlyClientId = (clientData as any).id;
  if (!monthlyClientId) {
    return { success: false, error: 'Не найден идентификатор клиента (monthly_client_id)' };
  }

  // Преобразуем base64 data URL в Blob
  const toBlobFromDataUrl = (dataUrl: string): Blob => {
    const [meta, base64] = dataUrl.split(',');
    const mimeMatch = meta.match(/data:(.*);base64/);
    const mime = mimeMatch?.[1] || 'image/jpeg';
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  };

  let publicUrl = '';

  try {
    const blob = toBlobFromDataUrl(fileData);
    const fileName = `check_${monthlyClientId}_${Date.now()}.jpg`;

    const { data: storageResult, error: storageError } = await supabase.storage
      .from('checks')
      .upload(fileName, blob, {
        contentType: blob.type || 'image/jpeg',
        upsert: false
      });

    if (storageError || !storageResult) {
      console.error('Error uploading check image to Storage:', storageError);
      const hint = storageError?.message?.includes('row-level security') || storageError?.message?.includes('policy')
        ? ' Настройте политики Storage: выполните SQL из файла supabase_migration_storage_checks.sql в Supabase.'
        : '';
      return { success: false, error: 'Не удалось загрузить файл в хранилище.' + (storageError?.message ? ' ' + storageError.message : '') + hint };
    }

    const { data: publicUrlData } = supabase.storage.from('checks').getPublicUrl(storageResult.path);
    publicUrl = publicUrlData?.publicUrl || storageResult.path;
  } catch (e) {
    console.error('Failed to prepare image for upload:', e);
    return { success: false, error: 'Ошибка подготовки изображения' };
  }

  const { error } = await supabase.from('checks').insert({
    monthly_client_id: monthlyClientId,
    image_url: publicUrl,
    status: 'pending',
    submitted_at: new Date().toISOString()
  });

  if (error) {
    console.error('Error saving check record:', error);
    return { success: false, error: 'Не удалось сохранить чек в базе' };
  }

  return { success: true };
};

export const fetchFilters = async (): Promise<FilterData> => {
  try {
    // Берём базу сотрудников (МП) из таблицы users
    const { data: users, error: usersError } = await supabase.from('users').select('*');

    if (usersError) {
      console.error('Failed to fetch users for filters:', usersError);
      return { mps: [], groups: [], oblasts: [], items: [] };
    }

    const items = (users || []).map((u: any) => ({
      name: normalize(u.mp_name),
      oblast: normalize(u.oblast),
      group: normalize(u.group)
    }));

    const mps = Array.from(new Set(items.map((i) => i.name))).filter(Boolean);
    const groups = Array.from(new Set(items.map((i) => i.group))).filter(Boolean);

    // Области: из users + из monthly_clients (чтобы были все области из Excel)
    const oblastsFromUsers = items.map((i) => i.oblast).filter(Boolean);
    let oblastsFromDb: string[] = [];
    const { data: mcRows } = await supabase
      .from('monthly_clients')
      .select('oblast')
      .limit(5000);
    if (mcRows) {
      oblastsFromDb = mcRows.map((r: any) => normalize(r?.oblast ?? '')).filter(Boolean);
    }
    const oblasts = Array.from(new Set([...oblastsFromUsers, ...oblastsFromDb])).filter(Boolean).sort();

    return { mps, groups, oblasts, items };
  } catch (e) {
    console.error('Failed to fetch filters:', e);
    return { mps: [], groups: [], oblasts: [], items: [] };
  }
};

export const fetchChecksForAdmin = async (
  month: string
): Promise<CheckWithClient[]> => {
  // Используем JOIN через Supabase relation, чтобы избежать проблемы
  // с лимитом в 1000 строк при двух отдельных запросах
  const { data: checks, error } = await supabase
    .from('checks')
    .select('*, monthly_clients!inner(month, mp_name, client, oblast, group, approved_amount)')
    .eq('monthly_clients.month', month);

  if (error || !checks) {
    if (error) {
      console.error('Error fetching checks for admin:', error);
    }
    return [];
  }

  return checks.map((check: any) => {
    const mc = check.monthly_clients;
    return {
      id: String(check.id),
      monthlyClientId: check.monthly_client_id,
      status: check.status,
      adminComment: check.admin_comment ?? '',
      submittedAt: check.submitted_at,
      reviewedAt: check.reviewed_at ?? null,
      imageUrl: check.image_url,
      month: mc?.month || '',
      mpName: mc?.mp_name || '',
      clientName: mc?.client || '',
      oblast: normalize(mc?.oblast ?? ''),
      group: normalize(mc?.group ?? ''),
      approvedAmount: normalize(mc?.approved_amount ?? '')
    };
  });
};

export const updateCheckStatus = async (
  id: string,
  status: 'approved' | 'rejected',
  adminComment?: string
): Promise<ApiResponse> => {
  const { error } = await supabase
    .from('checks')
    .update({
      status,
      admin_comment: adminComment || null,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) {
    console.error('Error updating check status:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
};

export interface MonthlyClientPayload {
  id?: string | number;
  month: string;
  mp_name: string;
  client: string;
  type: string;
  spec: string;
  ab: string;
  group: string;
  lpu: string;
  oblast: string;
  date?: string;
  articul?: string;
  region?: string;
  object_type?: string;
  orientir?: string;
  dolzhnost?: string;
  amount_issued?: string;
  approved_amount?: string;
  actual_amount?: string;
  /** Статус из Excel «Отправлено» — врач уже сдал чек */
  excel_status?: string;
}

const PAGE_SIZE = 1000;

export const fetchMonthlyClientsByMonth = async (month: string): Promise<Client[]> => {
  const allRows: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('monthly_clients')
      .select('*')
      .eq('month', month)
      .order('mp_name', { ascending: true })
      .order('client', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching monthly_clients for admin:', error);
      return [];
    }

    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < PAGE_SIZE) hasMore = false;
    else offset += PAGE_SIZE;
  }

  const data = allRows;

  const clientIds = data.map((row: any) => row.id);
  let checksByClientId: Record<string, any[]> = {};

  if (clientIds.length > 0) {
    const BATCH = 500;
    for (let i = 0; i < clientIds.length; i += BATCH) {
      const batch = clientIds.slice(i, i + BATCH);
      const { data: checks, error: checksError } = await supabase
        .from('checks')
        .select('*')
        .in('monthly_client_id', batch);

      if (!checksError && checks) {
        checks.forEach((check: any) => {
          const key = String(check.monthly_client_id);
          if (!checksByClientId[key]) checksByClientId[key] = [];
          checksByClientId[key].push(check);
        });
      }
    }
  }

  return data.map(
    (row: any): Client => {
      const r = row || {};
      const rowId = String(r.id);
      const checksForClient = checksByClientId[rowId] || [];
      const lastCheck = checksForClient.sort(
        (a: any, b: any) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime()
      )[checksForClient.length - 1];
      const checkStatus = lastCheck?.status ?? undefined;
      const checkComment = lastCheck?.admin_comment ?? undefined;

      const excelStatus = normalize(r.excel_status || '');
      const status =
        checksForClient.length > 0 ? 'отправлено' : excelStatus.toLowerCase().includes('отправлено') ? 'отправлено' : '';

      return {
        id: r.id,
        client: normalize(r.client),
        type: normalize(r.type),
        spec: normalize(r.spec),
        ab: normalize(r.ab),
        group: normalize(r.group),
        lpu: normalize(r.lpu),
        oblast: normalize(r.oblast),
        status,
        checkStatus,
        checkComment,
        month: normalize(r.month),
        mpName: normalize(r.mp_name),
        date: normalize(r.date),
        articul: normalize(r.articul),
        region: normalize(r.region),
        objectType: normalize(r.object_type),
        orientir: normalize(r.orientir),
        dolzhnost: normalize(r.dolzhnost),
        amountIssued: normalize(r.amount_issued),
        approvedAmount: normalize(r.approved_amount),
        actualAmount: normalize(r.actual_amount)
      };
    }
  );
};

const toDbRowBase = (row: MonthlyClientPayload) => ({
  month: row.month,
  mp_name: row.mp_name,
  client: row.client,
  type: row.type,
  spec: row.spec,
  ab: row.ab,
  group: row.group,
  lpu: row.lpu,
  oblast: row.oblast
});

const toDbRowFull = (row: MonthlyClientPayload) => ({
  ...toDbRowBase(row),
  date: row.date ?? '',
  articul: row.articul ?? '',
  region: row.region ?? '',
  object_type: row.object_type ?? '',
  orientir: row.orientir ?? '',
  dolzhnost: row.dolzhnost ?? '',
  amount_issued: row.amount_issued ?? '',
  approved_amount: row.approved_amount ?? '',
  actual_amount: row.actual_amount ?? '',
  excel_status: row.excel_status ?? ''
});

export const upsertMonthlyClients = async (
  rows: MonthlyClientPayload[]
): Promise<ApiResponse> => {
  if (!rows.length) return { success: true };

  const withId = rows.filter((r) => r.id != null);
  const withoutId = rows.filter((r) => r.id == null);

  if (withId.length > 0) {
    const { error: upsertError } = await supabase
      .from('monthly_clients')
      .upsert(withId.map((r) => ({ id: r.id, ...toDbRowFull(r) })), {
        onConflict: 'id'
      });
    if (upsertError) {
      console.error('Error upserting monthly_clients from Excel:', upsertError);
      return { success: false, error: upsertError.message };
    }
  }

  if (withoutId.length > 0) {
    const payload = withoutId.map(toDbRowFull);
    const { error: insertError } = await supabase
      .from('monthly_clients')
      .insert(payload);
    if (insertError) {
      const isUnknownColumn =
        /column .* does not exist|undefined column/i.test(insertError.message);
      if (isUnknownColumn) {
        const { error: insertBaseError } = await supabase
          .from('monthly_clients')
          .insert(withoutId.map(toDbRowBase));
        if (insertBaseError) {
          console.error('Error inserting monthly_clients (base):', insertBaseError);
          return { success: false, error: insertBaseError.message };
        }
        return {
          success: true,
          warning: 'Загружены основные поля. Выполните миграцию supabase_migration_add_all_columns.sql для всех столбцов.'
        };
      }
      console.error('Error inserting monthly_clients from Excel:', insertError);
      return { success: false, error: insertError.message };
    }
  }

  return { success: true };
};

export const deleteMonthlyClient = async (id: string | number): Promise<ApiResponse> => {
  const { error } = await supabase.from('monthly_clients').delete().eq('id', id);

  if (error) {
    console.error('Error deleting monthly_client row:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
};

/** Удалить все строки за указанный месяц (очистка перед повторной загрузкой). */
export const deleteMonthlyClientsByMonth = async (month: string): Promise<ApiResponse> => {
  if (!month || !month.trim()) {
    return { success: false, error: 'Укажите месяц' };
  }
  const { error } = await supabase
    .from('monthly_clients')
    .delete()
    .eq('month', month.trim());

  if (error) {
    console.error('Error deleting monthly_clients by month:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
};

/** Ключ для сопоставления строк (месяц, МП, клиент) */
const rowKey = (r: { month: string; mp_name: string; client: string }) =>
  `${(r.month || '').trim()}|${(r.mp_name || '').trim()}|${(r.client || '').trim()}`;

const CHUNK_SIZE = 200;

export type UploadProgressCallback = (pct: number, status: string) => void;

/**
 * Upsert с сохранением id: обновляет существующие строки, добавляет новые, удаляет отсутствующие в Excel.
 * Чеки остаются привязанными к тем же monthly_client_id.
 * Требует уникальный индекс idx_monthly_clients_upsert_key на (month, mp_name, client).
 */
export const upsertMonthlyClientsPreservingChecks = async (
  rows: MonthlyClientPayload[],
  onProgress?: UploadProgressCallback
): Promise<ApiResponse> => {
  if (!rows.length) return { success: true };

  const report = (pct: number, status: string) => onProgress?.(pct, status);

  const months = [...new Set(rows.map((r) => (r.month || '').trim()).filter(Boolean))];
  if (months.length === 0) return { success: false, error: 'Нет месяца в данных' };

  const payloadKeys = new Set(rows.map((r) => rowKey(r)));

  report(5, 'Проверка существующих данных...');
  for (let i = 0; i < months.length; i++) {
    report(5 + (15 * (i + 1)) / months.length, `Обработка месяца ${i + 1}/${months.length}...`);

    const { data: existing, error: fetchError } = await supabase
      .from('monthly_clients')
      .select('id, month, mp_name, client')
      .eq('month', months[i]);

    if (fetchError) {
      console.error('Error fetching existing monthly_clients:', fetchError);
      return { success: false, error: fetchError.message };
    }

    const idsToDelete = (existing || [])
      .filter((r: any) => !payloadKeys.has(rowKey(r)))
      .map((r: any) => r.id);

    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from('monthly_clients')
        .delete()
        .in('id', idsToDelete);
      if (deleteError) {
        console.error('Error deleting removed rows:', deleteError);
        return { success: false, error: deleteError.message };
      }
    }
  }

  // Убираем дубликаты по (month, mp_name, client) — оставляем последнюю строку
  const seen = new Set<string>();
  const deduped = [...rows].reverse().filter((r) => {
    const k = rowKey(r);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).reverse();

  const payload = deduped.map((r) => toDbRowFull(r));
  const total = payload.length;

  if (total <= CHUNK_SIZE) {
    report(25, `Загрузка ${total} строк...`);
    const { error: upsertError } = await supabase
      .from('monthly_clients')
      .upsert(payload, {
        onConflict: 'month,mp_name,client',
        ignoreDuplicates: false
      });
    if (upsertError) {
      const isUnknownConflict =
        /conflict|unique|constraint/i.test(upsertError.message) &&
        !/idx_monthly_clients_upsert_key/.test(upsertError.message);
      if (isUnknownConflict) {
        return {
          success: false,
          error:
            'Выполните миграцию supabase_migration_monthly_clients_upsert.sql в Supabase для сохранения чеков при повторной загрузке.\n\nОшибка: ' +
            upsertError.message
        };
      }
      console.error('Error upserting monthly_clients:', upsertError);
      return { success: false, error: upsertError.message };
    }
    report(100, 'Готово');
    return { success: true };
  }

  const chunks = Math.ceil(total / CHUNK_SIZE);
  for (let i = 0; i < chunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, total);
    const chunk = payload.slice(start, end);
    const pct = 25 + (70 * (i + 1)) / chunks;
    report(pct, `Загрузка ${end} из ${total} строк...`);

    const { error: upsertError } = await supabase
      .from('monthly_clients')
      .upsert(chunk, {
        onConflict: 'month,mp_name,client',
        ignoreDuplicates: false
      });

    if (upsertError) {
      const isUnknownConflict =
        /conflict|unique|constraint/i.test(upsertError.message) &&
        !/idx_monthly_clients_upsert_key/.test(upsertError.message);
      if (isUnknownConflict) {
        return {
          success: false,
          error:
            'Выполните миграцию supabase_migration_monthly_clients_upsert.sql в Supabase для сохранения чеков при повторной загрузке.\n\nОшибка: ' +
            upsertError.message
        };
      }
      console.error('Error upserting monthly_clients:', upsertError);
      return { success: false, error: upsertError.message };
    }
  }

  report(100, 'Готово');
  return { success: true };
};

// ——— Пользователи (МП) — те, кто отправляют чеки ———

export const fetchUsers = async (): Promise<{ data: MpUser[]; error?: string }> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('mp_name', { ascending: true });

  if (error) {
    console.error('Error fetching users:', error);
    return { data: [], error: error.message };
  }
  if (!data) return { data: [] };
  return {
    data: data.map((r: any) => ({
      id: r.id,
      login: normalize(r.login),
      pass: normalize(r.pass),
      mp_name: normalize(r.mp_name),
      oblast: normalize(r.oblast),
      group: normalize(r.group)
    }))
  };
};

export const saveMpUser = async (u: MpUser): Promise<ApiResponse> => {
  const row = {
    login: u.login.trim(),
    pass: u.pass.trim(),
    mp_name: u.mp_name.trim(),
    oblast: (u.oblast || '').trim(),
    group: (u.group || '').trim()
  };
  if (u.id) {
    const { error } = await supabase.from('users').update(row).eq('id', u.id);
    if (error) {
      console.error('Error updating mp user:', error);
      return { success: false, error: error.message };
    }
  } else {
    const { error } = await supabase.from('users').insert(row);
    if (error) {
      console.error('Error creating mp user:', error);
      return { success: false, error: error.message };
    }
  }
  return { success: true };
};

export const deleteMpUser = async (id: string): Promise<ApiResponse> => {
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) {
    console.error('Error deleting mp user:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
};

export interface MpUserRow {
  login: string;
  pass: string;
  mp_name: string;
  oblast: string;
  group: string;
}

const BATCH_SIZE = 100;

export const insertMpUsers = async (rows: MpUserRow[]): Promise<ApiResponse> => {
  if (!rows.length) return { success: true };
  const normalized = rows
    .map((r) => ({
      login: (r.login || '').trim(),
      pass: String(r.pass ?? '').trim(),
      mp_name: (r.mp_name || '').trim(),
      oblast: (r.oblast || '').trim(),
      group: (r.group || '').trim()
    }))
    .filter((r) => r.login && r.mp_name);
  const byLogin = new Map<string, (typeof normalized)[0]>();
  for (const row of normalized) {
    byLogin.set(row.login, row);
  }
  const payload = Array.from(byLogin.values());
  if (!payload.length) {
    return { success: false, error: 'Нет строк с заполненными Логин и МП' };
  }
  for (let i = 0; i < payload.length; i += BATCH_SIZE) {
    const batch = payload.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('users')
      .upsert(batch, { onConflict: 'login' });
    if (error) {
      console.error('Error upserting mp users:', error);
      return { success: false, error: error.message || 'Ошибка Supabase' };
    }
  }
  return { success: true };
};

/** Размер хранилища чеков (фото) в байтах. */
export interface StorageUsage {
  usedBytes: number;
  fileCount: number;
  error?: string;
}

export const fetchStorageUsage = async (): Promise<StorageUsage> => {
  try {
    let totalBytes = 0;
    let fileCount = 0;
    const limit = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase.storage
        .from('checks')
        .list('', { limit, offset });

      if (error) {
        console.error('Error listing storage:', error);
        return { usedBytes: 0, fileCount: 0, error: error.message };
      }

      const items = data || [];
      for (const item of items) {
        if (item.id != null) {
          const size = (item as any).metadata?.size;
          if (size != null) totalBytes += Number(size);
          fileCount++;
        }
      }

      if (items.length < limit) hasMore = false;
      else offset += limit;
    }

    return { usedBytes: totalBytes, fileCount };
  } catch (e) {
    console.error('Unexpected error fetching storage:', e);
    return {
      usedBytes: 0,
      fileCount: 0,
      error: e instanceof Error ? e.message : 'Ошибка загрузки'
    };
  }
};

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [meta, base64] = dataUrl.split(',');
  const mimeMatch = meta.match(/data:(.*);base64/);
  const mime = mimeMatch?.[1] || 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

const getStoragePathFromUrl = (imageUrl: string): string | null => {
  const match = imageUrl.match(/\/checks\/([^?]+)/);
  return match ? match[1] : null;
};

export interface CompressExistingResult {
  success: boolean;
  compressed: number;
  failed: number;
  error?: string;
}

export const compressExistingChecks = async (
  month: string,
  onProgress?: (current: number, total: number, status: string) => void
): Promise<CompressExistingResult> => {
  const checks = await fetchChecksForAdmin(month);
  const toProcess = checks.filter((c) => c.imageUrl && getStoragePathFromUrl(c.imageUrl));
  const total = toProcess.length;
  let compressed = 0;
  let failed = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const check = toProcess[i];
    const path = check.imageUrl ? getStoragePathFromUrl(check.imageUrl) : null;
    if (!path) {
      failed++;
      continue;
    }

    onProgress?.(i + 1, total, `Сжатие ${check.clientName}...`);

    try {
      const res = await fetch(check.imageUrl!, { mode: 'cors' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], path, { type: blob.type || 'image/jpeg' });
      const compressedData = await compressImage(file);
      const compressedBlob = dataUrlToBlob(compressedData);

      const { error } = await supabase.storage
        .from('checks')
        .upload(path, compressedBlob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) throw error;
      compressed++;
    } catch (e) {
      console.error('Compress failed for', check.id, e);
      failed++;
    }
  }

  return { success: failed === 0, compressed, failed };
};
