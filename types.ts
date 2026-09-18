export interface Client {
  id?: string | number;
  client: string;
  type: string;
  spec: string;
  ab: string;
  group: string;
  lpu: string;
  oblast: string;
  /**
   * Логический статус «есть ли хоть один чек».
   * Для старой логики используется строка «отправлено».
   */
  status?: string;
  /**
   * Детальный статус последнего чека.
   */
  checkStatus?: 'pending' | 'approved' | 'rejected';
  /**
   * Комментарий администратора по последнему чеку.
   */
  checkComment?: string | null;
  /** ID последнего чека (для просмотра из админки / базы Excel). */
  checkId?: string;
  /** Публичный URL изображения последнего чека. */
  checkImageUrl?: string;
  /** Для админки: месяц и имя МП из monthly_clients */
  month?: string;
  mpName?: string;
  /** Все столбцы из Excel */
  date?: string;
  articul?: string;
  region?: string;
  objectType?: string;
  orientir?: string;
  dolzhnost?: string;
  amountIssued?: string;
  approvedAmount?: string;
  actualAmount?: string;
}

/** ID раздела панели: monitoring, checks, database, managers, users, belinda (тест интеграции 1С) */
export type SectionId = 'monitoring' | 'checks' | 'database' | 'managers' | 'users' | 'belinda';

export interface User {
  success: boolean;
  mpName: string; // Used as display name or ID
  error?: string;
  role?: 'admin' | 'manager' | 'user';
  assignedEmployees?: string[]; // Legacy/Computed
  assignedOblasts?: string[];   // Filter/Permission by Region
  assignedGroups?: string[];    // Filter/Permission by Group
  /** Пустой = все разделы. Иначе — только указанные. */
  assignedSections?: SectionId[];
}

export interface ManagerProfile {
  id: string;
  name: string;
  login: string;
  pass: string;
  role: 'admin' | 'manager';
  assignedEmployees: string[]; // Kept for legacy compatibility, but calculated dynamically now
  assignedOblasts: string[];
  assignedGroups: string[];
  /** Пустой = все разделы. Иначе — только указанные. */
  assignedSections?: SectionId[];
}

export interface UploadPayload {
  action: 'upload';
  fileData: string; // Base64
  clientData: Client & { mpName: string };
}

export interface ApiResponse {
  success: boolean;
  error?: string;
  clients?: Client[];
  [key: string]: any;
}

export interface EmployeeMeta {
  name: string;
  group: string;
  oblast: string;
}

export interface FilterData {
  mps: string[];
  groups: string[];
  oblasts: string[];
  items: EmployeeMeta[];
}

export interface CheckWithClient {
  id: string;
  monthlyClientId: string | number;
  status: 'pending' | 'approved' | 'rejected';
  adminComment?: string;
  submittedAt: string;
  reviewedAt: string | null;
  imageUrl: string;
  month: string;
  mpName: string;
  clientName: string;
  oblast?: string;
  group?: string;
  /** Утверждённая сумма из monthly_clients */
  approvedAmount?: string;
  /** Тип: УВК или Предоплата */
  clientType?: string;
  /** Имя врача (dolzhnost) */
  doctorName?: string;
}

/** Пользователь (МП) — тот, кто отправляет чеки. */
export interface MpUser {
  id?: string;
  login: string;
  pass: string;
  mp_name: string;
  oblast: string;
  group: string;
}

/**
 * Строка тестовой staging-таблицы belinda_monthly_clients_staging — та же форма,
 * что и monthly_clients (которую сейчас заполняет Excel), чтобы после проверки
 * данные можно было перенести в прод тем же способом.
 */
export interface BelindaStagingRow {
  id: number;
  month: string;
  mpName: string;
  client: string;
  type: string;
  spec: string;
  ab: string;
  group: string;
  lpu: string;
  oblast: string;
  date: string;
  articul: string;
  region: string;
  objectType: string;
  orientir: string;
  dolzhnost: string;
  amountIssued: string;
  approvedAmount: string;
  actualAmount: string;
  sourceDocId: string;
  syncedAt: string;
}

/** Доступные значения для фильтров УВК (результат "сканирования" get_uvk без записи в БД). */
export interface BelindaUvkScanResult {
  total: number;
  /** Стандартизованные "Месяц ГГГГ" — вычислены из поля date, а не из грязного поля 1С month. */
  months: string[];
  doctypes: string[];
}

/** Фильтры для предпросмотра/синхронизации УВК. */
export interface BelindaUvkFilters {
  months?: string[];
  doctypes?: string[];
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Строка предпросмотра (результат mode=preview) — ещё НЕ записана в БД.
 * Отправляется обратно в mode=commit как есть, чтобы попасть в staging-таблицу.
 */
export interface BelindaPreviewRow {
  month: string;
  mp_name: string;
  client: string;
  type: string;
  spec: string;
  ab: string;
  group: string;
  lpu: string;
  oblast: string;
  date: string;
  articul: string;
  region: string;
  object_type: string;
  orientir: string;
  dolzhnost: string;
  amount_issued: string;
  approved_amount: string;
  actual_amount: string;
  source_doc_id: string;
  item_index: number;
}

/** Отчёт о синхронизации: получено/создано/обновлено/ошибки. */
export interface BelindaSyncReport {
  received: number;
  created: number;
  updated: number;
  failed: number;
  errors: { id?: string; message: string }[];
}