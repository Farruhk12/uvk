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

/** ID раздела панели: monitoring, checks, database, managers, users */
export type SectionId = 'monitoring' | 'checks' | 'database' | 'managers' | 'users';

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