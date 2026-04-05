import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { User, ManagerProfile, EmployeeMeta, Client, CheckWithClient, MpUser, SectionId } from '../types';
import {
  fetchClients,
  fetchFilters,
  fetchManagers,
  saveManagerApi,
  deleteManagerApi,
  fetchChecksForAdmin,
  updateCheckStatus,
  fetchMonthlyClientsByMonth,
  upsertMonthlyClientsPreservingChecks,
  deleteMonthlyClient,
  deleteMonthlyClientsByMonth,
  MonthlyClientPayload,
  fetchUsers,
  saveMpUser,
  deleteMpUser,
  insertMpUsers,
  fetchStorageUsage,
  compressExistingChecks,
  deleteCheck
} from '../services/api';
import { MONTH_NAMES, getMonthOptions, STORAGE_LIMIT_BYTES } from '../constants';
import { isClientSentByStatus } from '../utils/status';
import {
  LogOut,
  Users,
  BarChart3,
  Plus,
  Trash2,
  UserCog,
  Pencil,
  X,
  MapPin,
  Layers,
  Loader2,
  ShieldCheck,
  RefreshCw,
  ChevronDown,
  CheckCircle,
  Circle,
  AlertCircle,
  FileSpreadsheet,
  Image as ImageIcon,
  MessageCircle,
  Send,
  Search,
  HardDrive
} from 'lucide-react';
import { CheckImageViewer } from './CheckImageViewer';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
}

interface MonitoringStat {
  name: string;
  total: number;
  sent: number;
  loading: boolean;
  clients?: Client[];
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'monitoring' | 'managers' | 'checks' | 'database' | 'users'>(
    'monitoring'
  );
  const [managers, setManagers] = useState<ManagerProfile[]>([]);
  const [managersLoading, setManagersLoading] = useState(false);
  
  // Dynamic Data from API
  const [allEmployees, setAllEmployees] = useState<EmployeeMeta[]>([]);
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [availableOblasts, setAvailableOblasts] = useState<string[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);
  
  // State for Manager Modal (Create/Edit)
  const [showModal, setShowModal] = useState(false);
  const [isSavingManager, setIsSavingManager] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    login: '',
    pass: '',
    role: 'manager' as 'admin' | 'manager',
    oblasts: [] as string[],
    groups: [] as string[],
    sections: [] as SectionId[]
  });
  
  // State for Monitoring Tab
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [monitoringStats, setMonitoringStats] = useState<MonitoringStat[]>([]);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [monitoringOblast, setMonitoringOblast] = useState<string>('');
  const [monitoringGroup, setMonitoringGroup] = useState<string>('');
  const [monitoringEmployee, setMonitoringEmployee] = useState<string>('');

  // State for Checks Tab
  const [checksMonth, setChecksMonth] = useState<string>('');
  const [checks, setChecks] = useState<CheckWithClient[]>([]);
  const [checksLoading, setChecksLoading] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<{
    imageUrl: string;
    approvedAmount?: string;
    id?: string;
    status?: 'pending' | 'approved' | 'rejected';
    mpName?: string;
    month?: string;
    doctorName?: string;
    clientName?: string;
    clientType?: string;
  } | null>(null);
  const [checksSortAlpha, setChecksSortAlpha] = useState(false);
  const [checksSubTab, setChecksSubTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [checksSearch, setChecksSearch] = useState('');
  const [rejectingCheckId, setRejectingCheckId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [deletingCheckId, setDeletingCheckId] = useState<string | null>(null);
  const [checksOblast, setChecksOblast] = useState<string>('');
  const [checksGroup, setChecksGroup] = useState<string>('');
  const [checksEmployee, setChecksEmployee] = useState<string>('');
  const [checksCompressing, setChecksCompressing] = useState(false);
  const [compressProgress, setCompressProgress] = useState<{ current: number; total: number; status: string } | null>(null);

  // State for Database (Excel) Tab
  const [dbMonth, setDbMonth] = useState<string>('');
  const [dbClients, setDbClients] = useState<Client[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbUploading, setDbUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [dbOblast, setDbOblast] = useState<string>('');
  const [dbGroup, setDbGroup] = useState<string>('');
  const [dbEmployee, setDbEmployee] = useState<string>('');
  const [dbShowResults, setDbShowResults] = useState(false);
  const [dbLoadTriggered, setDbLoadTriggered] = useState(false);

  // State for Users (МП) Tab
  const [mpUsers, setMpUsers] = useState<MpUser[]>([]);
  const [mpUsersLoading, setMpUsersLoading] = useState(false);
  const [mpUsersUploading, setMpUsersUploading] = useState(false);
  const [mpUsersError, setMpUsersError] = useState<string | null>(null);
  const [mpUsersOblast, setMpUsersOblast] = useState<string>('');
  const [mpUsersGroup, setMpUsersGroup] = useState<string>('');
  const [mpUsersSearch, setMpUsersSearch] = useState<string>('');
  const [storageUsed, setStorageUsed] = useState<number | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingMpUserId, setEditingMpUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({ login: '', pass: '', mp_name: '', oblast: '', group: '' });
  const [savingUser, setSavingUser] = useState(false);

  // Load Filters Function
  const loadFilters = useCallback(async () => {
    setIsDataLoading(true);
    try {
        const data = await fetchFilters();
        setAvailableGroups(data.groups.sort());
        setAvailableOblasts(data.oblasts.sort());
        
        if (data.items && data.items.length > 0) {
          setAllEmployees(data.items);
        } else {
          setAllEmployees(data.mps.map(name => ({ name, group: '', oblast: '' })));
        }
    } catch (e) {
        console.error("Error loading filters", e);
    } finally {
        setIsDataLoading(false);
    }
  }, []);

  const loadManagers = useCallback(async () => {
    if (user.role !== 'admin') return;
    setManagersLoading(true);
    try {
      const data = await fetchManagers();
      setManagers(data);
    } catch (e) {
      console.error("Error loading managers", e);
    } finally {
      setManagersLoading(false);
    }
  }, [user.role]);

  // Load initial data
  useEffect(() => {
    loadFilters();
    loadManagers();
  }, [loadFilters, loadManagers]);

  const SECTIONS: { id: SectionId; label: string }[] = [
    { id: 'monitoring', label: 'Мониторинг' },
    { id: 'checks', label: 'Чеки' },
    { id: 'database', label: 'База' },
    { id: 'managers', label: 'Команда' },
    { id: 'users', label: 'Пользователи' }
  ];

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      name: '',
      login: '',
      pass: '',
      role: 'manager',
      oblasts: [],
      groups: [],
      sections: []
    });
    setShowModal(true);
  };

  const openEditModal = (manager: ManagerProfile) => {
    setEditingId(manager.id);
    setFormData({
      name: manager.name,
      login: manager.login,
      pass: manager.pass,
      role: manager.role || 'manager',
      oblasts: manager.assignedOblasts || [],
      groups: manager.assignedGroups || [],
      sections: manager.assignedSections || []
    });
    setShowModal(true);
  };

  const toggleSection = (id: SectionId) => {
    setFormData(prev => ({
      ...prev,
      sections: prev.sections.includes(id)
        ? prev.sections.filter(s => s !== id)
        : [...prev.sections, id]
    }));
  };

  const handleSaveManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.login || !formData.pass) return;
    
    setIsSavingManager(true);

    const newProfileData: ManagerProfile = {
      id: editingId || Date.now().toString(),
      name: formData.name,
      login: formData.login,
      pass: formData.pass,
      role: formData.role,
      assignedEmployees: [],
      assignedOblasts: formData.oblasts,
      assignedGroups: formData.groups,
      assignedSections: formData.sections
    };

    try {
      const res = await saveManagerApi(newProfileData);
      if (res.success) {
        await loadManagers(); // Refresh list from server
        setShowModal(false);
        if (res.warning) alert(res.warning);
      } else {
        alert('Ошибка сохранения: ' + res.error);
      }
    } catch (err) {
      alert('Ошибка соединения');
    } finally {
      setIsSavingManager(false);
    }
  };

  const handleDeleteManager = async (id: string) => {
    if (confirm('Удалить этого менеджера?')) {
      try {
        const res = await deleteManagerApi(id);
        if (res.success) {
          await loadManagers();
        } else {
          alert('Ошибка удаления');
        }
      } catch (e) {
        alert('Ошибка сети');
      }
    }
  };

  const toggleOblast = (obl: string) => {
    setFormData(prev => ({
      ...prev,
      oblasts: prev.oblasts.includes(obl) 
        ? prev.oblasts.filter(o => o !== obl)
        : [...prev.oblasts, obl]
    }));
  };

  const toggleGroup = (grp: string) => {
    setFormData(prev => ({
      ...prev,
      groups: prev.groups.includes(grp) 
        ? prev.groups.filter(g => g !== grp)
        : [...prev.groups, grp]
    }));
  };

  const toggleEmployeeExpand = (name: string) => {
    setExpandedEmployee(prev => prev === name ? null : name);
  };

  const monthOptions = useMemo(() => getMonthOptions(), []);

  const ALL_SECTIONS: SectionId[] = ['monitoring', 'checks', 'database', 'managers', 'users'];
  const visibleTabs = useMemo((): SectionId[] => {
    const sections = user.assignedSections;
    if (sections && sections.length > 0) return sections;
    return user.role === 'admin' ? ALL_SECTIONS : ['monitoring'];
  }, [user.role, user.assignedSections]);

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0]);
    }
  }, [visibleTabs, activeTab]);

  // Helper to determine which employees match a manager's permissions
  const getRelevantEmployees = useCallback((managerUser: User | ManagerProfile): string[] => {
     const oblasts = managerUser.assignedOblasts || [];
     const groups = managerUser.assignedGroups || [];

     // Admin or manager with no restrictions = all employees
     if (oblasts.length === 0 && groups.length === 0) {
         return allEmployees.map(e => e.name);
     }

     const norm = (str: string) => str ? str.toString().trim().toLowerCase() : '';

     return allEmployees
        .filter(emp => {
            const empOblast = norm(emp.oblast);
            const empGroup = norm(emp.group);

            const matchesOblast = oblasts.length === 0 || oblasts.some(o => norm(o) === empOblast);
            const matchesGroup = groups.length === 0 || groups.some(g => norm(g) === empGroup);
            
            return matchesOblast && matchesGroup;
        })
        .map(e => e.name);
  }, [allEmployees]);

  const [monitoringLoadTriggered, setMonitoringLoadTriggered] = useState(false);

  const loadMonitoringData = useCallback(() => {
    if (!selectedMonth || allEmployees.length === 0) return;
    setExpandedEmployee(null);
    const employeesToMonitor = getRelevantEmployees(user);
    if (employeesToMonitor.length === 0) {
      setMonitoringStats([]);
      return;
    }
    setMonitoringStats(employeesToMonitor.map(name => ({ name, total: 0, sent: 0, loading: true })));
    employeesToMonitor.forEach(async (mpName) => {
      try {
        const data = await fetchClients(mpName, selectedMonth);
        const sentCount = data.filter(c => isClientSentByStatus(c.status)).length;
        setMonitoringStats(prev => prev.map(item =>
          item.name === mpName
            ? { name: mpName, total: data.length, sent: sentCount, loading: false, clients: data }
            : item
        ));
      } catch (e) {
        setMonitoringStats(prev => prev.map(item =>
          item.name === mpName ? { name: mpName, total: 0, sent: 0, loading: false } : item
        ));
      }
    });
  }, [selectedMonth, user, allEmployees, getRelevantEmployees]);

  // Grouping Logic for Monitoring View
  const groupedStats = useMemo(() => {
    const groups: Record<string, Record<string, MonitoringStat[]>> = {};

    if (monitoringStats.length === 0) return {};

    monitoringStats.forEach(stat => {
        const meta = allEmployees.find(e => e.name === stat.name);
        // Explicitly avoid optional chaining
        const oblast = (meta && meta.oblast) ? meta.oblast.trim() : 'Без области';
        const group = (meta && meta.group) ? meta.group.trim() : 'Общая группа';

        if (!groups[oblast]) groups[oblast] = {};
        if (!groups[oblast][group]) groups[oblast][group] = [];

        groups[oblast][group].push(stat);
    });

    return groups;
  }, [monitoringStats, allEmployees]);

  const monitoringFilterOptionsFromUsers = useMemo(() => {
    const base = getRelevantEmployees(user).length > 0
      ? allEmployees.filter(e => getRelevantEmployees(user).includes(e.name))
      : allEmployees;
    const oblasts = (user.assignedOblasts || []).length > 0
      ? (user.assignedOblasts || []).slice().sort()
      : Array.from(new Set(base.map(e => (e.oblast || '').trim()))).filter(Boolean).sort();
    const byOblast = monitoringOblast ? base.filter(e => (e.oblast || '').trim() === monitoringOblast) : base;
    const groups = Array.from(new Set(byOblast.map(e => (e.group || '').trim()))).filter(Boolean).sort();
    const byGroup = monitoringGroup ? byOblast.filter(e => (e.group || '').trim() === monitoringGroup) : byOblast;
    const employees = Array.from(new Set(byGroup.map(e => (e.name || '').trim()))).filter(Boolean).sort();
    return { oblasts, groups, employees };
  }, [allEmployees, monitoringOblast, monitoringGroup, user, getRelevantEmployees]);

  const monitoringFilterOptions = useMemo(() => {
    if (Object.keys(groupedStats).length === 0) return monitoringFilterOptionsFromUsers;
    const userOblasts = user.assignedOblasts || [];
    const oblasts = userOblasts.length > 0
      ? userOblasts.slice().sort()
      : Object.keys(groupedStats).filter(Boolean).sort();
    const groupsByOblast = monitoringOblast && groupedStats[monitoringOblast]
      ? Object.keys(groupedStats[monitoringOblast]).filter(Boolean).sort()
      : Array.from(new Set(Object.values(groupedStats).flatMap(g => Object.keys(g)))).filter(Boolean).sort();
    let employees: string[];
    if (monitoringOblast || monitoringGroup) {
      const oblas = monitoringOblast ? [monitoringOblast] : Object.keys(groupedStats);
      const grps = monitoringGroup ? [monitoringGroup] : null;
      employees = Array.from(new Set(
        oblas.flatMap(obl => {
          const g = groupedStats[obl];
          if (!g) return [];
          const gKeys = grps ? grps.filter(k => g[k]) : Object.keys(g);
          return gKeys.flatMap(k => (g[k] || []).map((s: MonitoringStat) => s.name));
        })
      )).filter(Boolean).sort();
    } else {
      employees = monitoringStats.map(s => s.name).sort();
    }
    return { oblasts, groups: groupsByOblast, employees };
  }, [groupedStats, monitoringStats, monitoringOblast, monitoringGroup, monitoringFilterOptionsFromUsers, user.assignedOblasts]);

  // Filtered grouped stats for Monitoring (by oblast, group, employee)
  const filteredGroupedStats = useMemo(() => {
    const result: Record<string, Record<string, MonitoringStat[]>> = {};

    Object.entries(groupedStats).forEach(([oblast, groups]) => {
      if (monitoringOblast && oblast !== monitoringOblast) return;

      const filteredGroups: Record<string, MonitoringStat[]> = {};
      Object.entries(groups).forEach(([group, stats]) => {
        if (monitoringGroup && group !== monitoringGroup) return;

        const filteredStats = monitoringEmployee
          ? stats.filter(s => s.name === monitoringEmployee)
          : stats;
        if (filteredStats.length > 0) {
          filteredGroups[group] = filteredStats;
        }
      });

      if (Object.keys(filteredGroups).length > 0) {
        result[oblast] = filteredGroups;
      }
    });

    return result;
  }, [groupedStats, monitoringOblast, monitoringGroup, monitoringEmployee]);

  // Count employees for a manager card
  const getEmployeeCountForManager = (m: ManagerProfile) => {
      return getRelevantEmployees(m).length;
  }

  const isClientSent = (_mpName: string, client: Client) => {
    return isClientSentByStatus(client.status);
  }

  const [checksLoadTriggered, setChecksLoadTriggered] = useState(false);

  const handleLoadChecks = async (month: string) => {
    if (!month) {
      setChecksMonth('');
      setChecks([]);
      setChecksOblast('');
      setChecksGroup('');
      setChecksEmployee('');
      setChecksLoadTriggered(false);
      return;
    }
    setChecksOblast('');
    setChecksGroup('');
    setChecksEmployee('');
    setChecksLoading(true);
    try {
      const data = await fetchChecksForAdmin(month);
      setChecks(data);
      setChecksLoadTriggered(true);
    } catch (e) {
      console.error('Failed to load checks for admin:', e);
      setChecks([]);
    } finally {
      setChecksLoading(false);
    }
  };

  const handleChecksShow = () => {
    if (checksMonth) handleLoadChecks(checksMonth);
  };

  const handleCompressExistingChecks = async () => {
    if (!checksMonth) return;
    if (!confirm(`Сжать все фото чеков за «${checksMonth}»? Существующие файлы будут заменены сжатыми версиями.`)) return;
    setChecksCompressing(true);
    setCompressProgress(null);
    try {
      const result = await compressExistingChecks(checksMonth, (cur, tot, status) => {
        setCompressProgress({ current: cur, total: tot, status });
      });
      setCompressProgress(null);
      if (result.compressed > 0 || result.failed === 0) {
        alert(`Готово. Сжато: ${result.compressed}, ошибок: ${result.failed}.`);
        loadStorageUsage();
      } else {
        alert(`Ошибка. Сжато: ${result.compressed}, ошибок: ${result.failed}. Выполните миграцию supabase_migration_storage_checks_update.sql в Supabase.`);
      }
    } catch (e) {
      setCompressProgress(null);
      alert('Ошибка: ' + (e instanceof Error ? e.message : 'Не удалось сжать'));
    } finally {
      setChecksCompressing(false);
    }
  };

  const handleUpdateCheckStatus = async (
    id: string,
    status: 'approved' | 'rejected',
    comment: string = ''
  ): Promise<boolean> => {
    const res = await updateCheckStatus(id, status, comment);
    if (!res.success) {
      alert(res.error || 'Не удалось обновить статус');
      return false;
    }
    setChecks((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status,
              adminComment: comment,
              reviewedAt: new Date().toISOString()
            }
          : c
      )
    );
    setRejectingCheckId(null);
    setRejectComment('');
    return true;
  };

  const handleDeleteCheck = async (id: string, imageUrl?: string): Promise<void> => {
    if (!confirm('Удалить чек безвозвратно? Файл и запись будут удалены.')) return;
    setDeletingCheckId(id);
    try {
      const res = await deleteCheck(id, imageUrl);
      if (!res.success) {
        alert(res.error || 'Не удалось удалить чек');
        return;
      }
      setChecks((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setDeletingCheckId(null);
    }
  };

  const checksFilteredByRegion = useMemo(() => {
    const userOblasts = user.assignedOblasts || [];
    const userGroups = user.assignedGroups || [];
    return checks.filter((c) => {
      if (userOblasts.length > 0 && !userOblasts.includes((c.oblast || '').trim())) return false;
      if (userGroups.length > 0 && !userGroups.includes((c.group || '').trim())) return false;
      if (checksOblast && (c.oblast || '') !== checksOblast) return false;
      if (checksGroup && (c.group || '') !== checksGroup) return false;
      if (checksEmployee && (c.mpName || '') !== checksEmployee) return false;
      return true;
    });
  }, [checks, checksOblast, checksGroup, checksEmployee, user.assignedOblasts, user.assignedGroups]);

  const filteredChecks = useMemo(() => {
    const q = checksSearch.trim().toLowerCase();
    const filtered = checksFilteredByRegion.filter((c) => {
      if (c.status !== checksSubTab) return false;
      if (!q) return true;
      return (
        (c.clientName || '').toLowerCase().includes(q) ||
        (c.mpName || '').toLowerCase().includes(q)
      );
    });
    if (checksSortAlpha) {
      return [...filtered].sort((a, b) => (a.clientName || '').localeCompare(b.clientName || '', 'ru'));
    }
    return filtered;
  }, [checksFilteredByRegion, checksSubTab, checksSearch, checksSortAlpha]);

  const checksCounts = useMemo(() => ({
    pending: checksFilteredByRegion.filter((c) => c.status === 'pending').length,
    approved: checksFilteredByRegion.filter((c) => c.status === 'approved').length,
    rejected: checksFilteredByRegion.filter((c) => c.status === 'rejected').length,
  }), [checksFilteredByRegion]);

  const checksFilterOptionsFromUsers = useMemo(() => {
    const userOblasts = user.assignedOblasts || [];
    const userGroups = user.assignedGroups || [];
    const base = allEmployees.filter((e) => {
      if (userOblasts.length > 0 && !userOblasts.includes((e.oblast || '').trim())) return false;
      if (userGroups.length > 0 && !userGroups.includes((e.group || '').trim())) return false;
      return true;
    });
    const oblasts = userOblasts.length > 0
      ? userOblasts.slice().sort()
      : Array.from(new Set(base.map((e) => (e.oblast || '').trim()))).filter(Boolean).sort();
    const byOblast = checksOblast ? base.filter((e) => (e.oblast || '').trim() === checksOblast) : base;
    const groups = Array.from(new Set(byOblast.map((e) => (e.group || '').trim()))).filter(Boolean).sort();
    const byGroup = checksGroup ? byOblast.filter((e) => (e.group || '').trim() === checksGroup) : byOblast;
    const employees = Array.from(new Set(byGroup.map((e) => (e.name || '').trim()))).filter(Boolean).sort();
    return { oblasts, groups, employees };
  }, [allEmployees, checksOblast, checksGroup, user.assignedOblasts, user.assignedGroups]);

  const checksFilterOptions = useMemo(() => {
    if (checks.length === 0) return checksFilterOptionsFromUsers;
    const userOblasts = user.assignedOblasts || [];
    const userGroups = user.assignedGroups || [];
    const base = checks.filter((c) => {
      if (userOblasts.length > 0 && !userOblasts.includes((c.oblast || '').trim())) return false;
      if (userGroups.length > 0 && !userGroups.includes((c.group || '').trim())) return false;
      return true;
    });
    const oblasts = userOblasts.length > 0
      ? userOblasts.slice().sort()
      : Array.from(new Set(base.map((c) => (c.oblast || '').toString().trim()))).filter(Boolean).sort();
    const byOblast = checksOblast ? base.filter((c) => (c.oblast || '').toString().trim() === checksOblast) : base;
    const groups = Array.from(new Set(byOblast.map((c) => (c.group || '').toString().trim()))).filter(Boolean).sort();
    const byGroup = checksGroup ? byOblast.filter((c) => (c.group || '').toString().trim() === checksGroup) : byOblast;
    const employees = Array.from(new Set(byGroup.map((c) => (c.mpName || '').toString().trim()))).filter(Boolean).sort();
    return { oblasts, groups, employees };
  }, [checks, checksOblast, checksGroup, user.assignedOblasts, user.assignedGroups, checksFilterOptionsFromUsers]);

  const dbFilterOptionsFromUsers = useMemo(() => {
    const norm = (s: string) => (s || '').toString().trim().replace(/\s+/g, ' ');
    const userOblasts = user.assignedOblasts || [];
    const userGroups = user.assignedGroups || [];
    const base = allEmployees.filter((e) => {
      if (userOblasts.length > 0 && !userOblasts.includes(norm(e.oblast || ''))) return false;
      if (userGroups.length > 0 && !userGroups.includes(norm(e.group || ''))) return false;
      return true;
    });
    const oblasts = userOblasts.length > 0
      ? userOblasts.slice().sort()
      : Array.from(new Set(base.map((e) => norm(e.oblast || '')))).filter(Boolean).sort();
    const byOblast = dbOblast ? base.filter((e) => norm(e.oblast || '') === norm(dbOblast)) : base;
    const groups = Array.from(new Set(byOblast.map((e) => norm(e.group || '')))).filter(Boolean).sort();
    const byGroup = dbGroup ? byOblast.filter((e) => norm(e.group || '') === norm(dbGroup)) : byOblast;
    const employees = Array.from(new Set(byGroup.map((e) => norm(e.name || '')))).filter(Boolean).sort();
    return { oblasts, groups, employees };
  }, [allEmployees, dbOblast, dbGroup, user.assignedOblasts, user.assignedGroups]);

  const dbFilterOptions = useMemo(() => {
    if (dbClients.length === 0) return dbFilterOptionsFromUsers;
    const norm = (s: string) => (s || '').toString().trim().replace(/\s+/g, ' ');
    const userOblasts = user.assignedOblasts || [];
    const userGroups = user.assignedGroups || [];
    const base = dbClients.filter((c) => {
      if (userOblasts.length > 0 && !userOblasts.includes(norm(c.oblast || ''))) return false;
      if (userGroups.length > 0 && !userGroups.includes(norm(c.group || ''))) return false;
      return true;
    });
    const oblasts = userOblasts.length > 0
      ? userOblasts.slice().sort()
      : Array.from(new Set(base.map((c) => norm(c.oblast || '')))).filter(Boolean).sort();
    const byOblast = dbOblast ? base.filter((c) => norm(c.oblast || '') === norm(dbOblast)) : base;
    const groups = Array.from(new Set(byOblast.map((c) => norm(c.group || '')))).filter(Boolean).sort();
    const byGroup = dbGroup ? byOblast.filter((c) => norm(c.group || '') === norm(dbGroup)) : byOblast;
    const employeesFromData = Array.from(new Set(byGroup.map((c) => norm(c.mpName || '')))).filter(Boolean).sort();
    const employeesFromUsers = allEmployees.map((e) => norm(e.name)).filter(Boolean);
    let employees: string[];
    if (dbOblast || dbGroup) {
      const employeesByProfile = allEmployees
        .filter((e) => {
          const matchOblast = !dbOblast || norm(e.oblast) === norm(dbOblast);
          const matchGroup = !dbGroup || norm(e.group) === norm(dbGroup);
          return matchOblast && matchGroup;
        })
        .map((e) => norm(e.name))
        .filter(Boolean);
      employees = Array.from(new Set([...employeesByProfile, ...employeesFromData])).sort();
    } else {
      employees = Array.from(new Set([...employeesFromUsers, ...base.map((c) => norm(c.mpName || '')).filter(Boolean)])).sort();
    }
    return { oblasts, groups, employees };
  }, [dbClients, dbOblast, dbGroup, allEmployees, user.assignedOblasts, user.assignedGroups, dbFilterOptionsFromUsers]);

  const filteredDbClients = useMemo(() => {
    const norm = (s: string) => (s || '').toString().trim().replace(/\s+/g, ' ');
    const userOblasts = user.assignedOblasts || [];
    const userGroups = user.assignedGroups || [];
    return dbClients.filter((c) => {
      if (userOblasts.length > 0 && !userOblasts.includes(norm(c.oblast || ''))) return false;
      if (userGroups.length > 0 && !userGroups.includes(norm(c.group || ''))) return false;
      if (dbEmployee && norm(c.mpName || '') !== norm(dbEmployee)) return false;
      const rowOblast = norm(c.oblast || '');
      const rowGroup = norm(c.group || '');
      const emp = dbEmployee ? allEmployees.find((e) => norm(e.name) === norm(dbEmployee)) : null;
      const empOblast = emp ? norm(emp.oblast || '') : '';
      const empGroup = emp ? norm(emp.group || '') : '';
      const oblastOk = !dbOblast || rowOblast === norm(dbOblast) || (rowOblast === '' && empOblast === norm(dbOblast));
      const groupOk = !dbGroup || rowGroup === norm(dbGroup) || (rowGroup === '' && empGroup === norm(dbGroup));
      if (!oblastOk || !groupOk) return false;
      return true;
    });
  }, [dbClients, dbOblast, dbGroup, dbEmployee, allEmployees, user.assignedOblasts, user.assignedGroups]);

  const handleLoadDbClients = async (month: string, resetFilters = true) => {
    if (!month) {
      setDbMonth('');
      setDbClients([]);
      setDbOblast('');
      setDbGroup('');
      setDbEmployee('');
      setDbShowResults(false);
      setDbLoadTriggered(false);
      return;
    }
    if (resetFilters) {
      setDbOblast('');
      setDbGroup('');
      setDbEmployee('');
    }
    setDbShowResults(false);
    setDbLoading(true);
    try {
      const rows = await fetchMonthlyClientsByMonth(month);
      setDbClients(rows);
      setDbLoadTriggered(true);
      if (rows.length > 0) setDbShowResults(true);
    } catch (e) {
      console.error('Failed to load monthly_clients for admin:', e);
      setDbClients([]);
    } finally {
      setDbLoading(false);
    }
  };

  const handleDbShow = () => {
    if (dbMonth) handleLoadDbClients(dbMonth, false);
  };

  const handleDeleteDbClient = async (row: Client) => {
    if (!row.id) return;
    if (!window.confirm('Удалить эту запись из базы?')) return;
    const res = await deleteMonthlyClient(row.id);
    if (!res.success) {
      alert(res.error || 'Не удалось удалить строку');
      return;
    }
    setDbClients((prev) => prev.filter((c) => c.id !== row.id));
  };

  const handleClearMonth = async () => {
    if (!dbMonth) return;
    if (!window.confirm(`Удалить все строки за «${dbMonth}»? Это нельзя отменить.`)) return;
    setDbLoading(true);
    try {
      const res = await deleteMonthlyClientsByMonth(dbMonth);
      if (!res.success) {
        alert(res.error || 'Не удалось очистить');
        return;
      }
      setDbClients([]);
      alert('Месяц очищен. Можно загрузить Excel заново.');
    } finally {
      setDbLoading(false);
    }
  };

  const loadMpUsers = useCallback(async () => {
    setMpUsersLoading(true);
    setMpUsersError(null);
    try {
      const result = await fetchUsers();
      setMpUsers(result.data);
      if (result.error) setMpUsersError(result.error);
    } catch (e) {
      console.error('Failed to load users:', e);
      setMpUsers([]);
      setMpUsersError(e instanceof Error ? e.message : 'Ошибка загрузки списка');
    } finally {
      setMpUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'users') loadMpUsers();
  }, [activeTab, loadMpUsers]);

  const loadStorageUsage = useCallback(async () => {
    if (user.role !== 'admin') return;
    setStorageLoading(true);
    try {
      const res = await fetchStorageUsage();
      setStorageUsed(res.usedBytes);
    } catch {
      setStorageUsed(null);
    } finally {
      setStorageLoading(false);
    }
  }, [user.role]);

  useEffect(() => {
    if (user.role === 'admin' && visibleTabs.includes('checks')) {
      loadStorageUsage();
    }
  }, [user.role, visibleTabs, loadStorageUsage]);

  const filteredMpUsers = useMemo(() => {
    const norm = (s: string) => (s || '').toString().trim().toLowerCase();
    const q = norm(mpUsersSearch);
    return mpUsers.filter((u) => {
      if (mpUsersOblast && norm(u.oblast || '') !== norm(mpUsersOblast)) return false;
      if (mpUsersGroup && norm(u.group || '') !== norm(mpUsersGroup)) return false;
      if (q) {
        const match = norm(u.login) + norm(u.mp_name) + norm(u.pass) + norm(u.oblast || '') + norm(u.group || '');
        return match.includes(q);
      }
      return true;
    });
  }, [mpUsers, mpUsersOblast, mpUsersGroup, mpUsersSearch]);

  const mpUsersOblastOptions = useMemo(
    () => Array.from(new Set(mpUsers.map((u) => (u.oblast || '').trim()).filter(Boolean))).sort(),
    [mpUsers]
  );
  const mpUsersGroupOptions = useMemo(
    () => Array.from(new Set(mpUsers.map((u) => (u.group || '').trim()).filter(Boolean))).sort(),
    [mpUsers]
  );

  const openAddUserModal = () => {
    setEditingMpUserId(null);
    setUserForm({ login: '', pass: '', mp_name: '', oblast: '', group: '' });
    setShowUserModal(true);
  };

  const openEditUserModal = (u: MpUser) => {
    setEditingMpUserId(u.id || null);
    setUserForm({
      login: u.login,
      pass: u.pass,
      mp_name: u.mp_name,
      oblast: u.oblast,
      group: u.group
    });
    setShowUserModal(true);
  };

  const handleSaveMpUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.login.trim() || !userForm.mp_name.trim()) {
      alert('Заполните Логин и МП.');
      return;
    }
    setSavingUser(true);
    try {
      const res = await saveMpUser({
        id: editingMpUserId || undefined,
        login: userForm.login,
        pass: userForm.pass,
        mp_name: userForm.mp_name,
        oblast: userForm.oblast,
        group: userForm.group
      });
      if (!res.success) {
        alert(res.error || 'Ошибка сохранения');
        return;
      }
      setShowUserModal(false);
      loadMpUsers();
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteMpUser = async (u: MpUser) => {
    if (!u.id) return;
    if (!window.confirm(`Удалить пользователя «${u.mp_name}»?`)) return;
    const res = await deleteMpUser(u.id);
    if (!res.success) {
      alert(res.error || 'Не удалось удалить');
      return;
    }
    setMpUsers((prev) => prev.filter((x) => x.id !== u.id));
  };

  const handleExcelUploadUsers = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMpUsersUploading(true);
    const normalize = (v: unknown): string => {
      if (v == null || v === '') return '';
      if (typeof v === 'number') return String(v);
      return String(v).trim();
    };
    const normHeader = (s: string) => (s || '').toString().trim().toLowerCase().replace(/\s/g, '');
    const matchHeader = (cell: string, names: string[]) =>
      names.some((n) => normHeader(cell) === normHeader(n) || normHeader(cell).includes(normHeader(n)));
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', raw: false });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        alert('В файле нет листов.');
        return;
      }
      const sheet = workbook.Sheets[sheetName];
      const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (!rawRows.length) {
        alert('На первом листе нет данных.');
        return;
      }
      const headerRowIndex = rawRows.findIndex((row) => {
        const cells = (row as unknown[]).map((c) => normalize(c));
        return cells.some((c) => matchHeader(c, ['Логин', 'login'])) && cells.some((c) => matchHeader(c, ['МП', 'mp_name']));
      });
      if (headerRowIndex < 0) {
        alert('Не найдена строка заголовков с колонками «Логин» и «МП». Проверьте первый лист.');
        return;
      }
      const headerRow = (rawRows[headerRowIndex] as unknown[]).map((c) => normalize(c));
      const col = (names: string[]) => {
        const idx = headerRow.findIndex((h) => matchHeader(h, names));
        return idx >= 0 ? idx : -1;
      };
      const iLogin = col(['Логин', 'login', 'Login']);
      const iPass = col(['Пароль', 'пароль', 'pass', 'password', 'Password']);
      const iMp = col(['МП', 'mp_name', 'ФИО', 'Имя']);
      const iOblast = col(['Облать', 'Область', 'oblast', 'Region']);
      const iGroup = col(['Группа', 'group', 'Group']);
      if (iLogin < 0 || iMp < 0) {
        alert('В строке заголовков должны быть столбцы «Логин» и «МП». Найдены: ' + headerRow.filter(Boolean).join(', '));
        return;
      }
      const dataRows = rawRows.slice(headerRowIndex + 1) as unknown[][];
      const payload = dataRows
        .map((row) => {
          const arr = Array.isArray(row) ? row : [];
          const login = normalize(arr[iLogin]);
          const mp_name = normalize(arr[iMp]);
          if (!login && !mp_name) return null;
          return {
            login: login || '',
            pass: normalize(iPass >= 0 ? arr[iPass] : ''),
            mp_name: mp_name || '',
            oblast: iOblast >= 0 ? normalize(arr[iOblast]) : '',
            group: iGroup >= 0 ? normalize(arr[iGroup]) : ''
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null && r.login !== '' && r.mp_name !== '');
      if (!payload.length) {
        alert('Нет строк с заполненными Логин и МП. Данные должны начинаться со строки под заголовками.');
        return;
      }
      const res = await insertMpUsers(payload);
      if (!res.success) {
        alert('Ошибка базы: ' + (res.error || 'Неизвестная ошибка') + '\n\nЕсли в Supabase нет таблицы users, выполните SQL из файла supabase_migration_users_table.sql');
        return;
      }
      alert(`Готово: ${payload.length} пользователей добавлено или обновлено по логину.`);
      loadMpUsers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Excel users upload failed:', err);
      alert('Ошибка: ' + msg);
    } finally {
      setMpUsersUploading(false);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setDbUploading(true);
    setUploadProgress(0);
    setUploadStatus('Чтение файла...');
    const normalize = (v: unknown): string =>
      v == null || v === '' ? '' : String(v).trim().replace(/\s+/g, ' ');

    const getCell = (r: Record<string, unknown>, ...names: string[]): string => {
      for (const n of names) {
        const v = r[n];
        if (v != null && v !== '') return normalize(v);
      }
      const keys = Object.keys(r);
      for (const n of names) {
        const found = keys.find((k) => (k || '').trim() === n || (k || '').trim().includes(n));
        if (found) {
          const v = r[found];
          if (v != null && v !== '') return normalize(v);
        }
      }
      return '';
    };

    try {
      const data = await file.arrayBuffer();
      setUploadProgress(5);
      setUploadStatus('Обработка Excel...');
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      // Колонка «Отправлено»/«Статус» в конце — помечаем врачей как отправивших чек
      const getSentColumnKey = (): string | null => {
        if (rows.length === 0) return null;
        const keys = Object.keys(rows[0] as object);
        const sentKey = keys.find((k) => (k || '').trim().toLowerCase().includes('отправлено'));
        if (sentKey) return sentKey;
        const statusKey = keys.find((k) => (k || '').trim().toLowerCase().includes('статус'));
        if (statusKey) return statusKey;
        return keys.length > 0 ? keys[keys.length - 1] : null;
      };
      const sentColumnKey = getSentColumnKey();
      const getExcelStatus = (r: Record<string, unknown>): string => {
        if (!sentColumnKey) return '';
        const val = normalize(r[sentColumnKey]);
        return val.toLowerCase().includes('отправлено') ? 'отправлено' : '';
      };

      const payload = rows
        .map(
          (row): MonthlyClientPayload => {
            const r = row as Record<string, unknown>;
            const monthFromExcel = getCell(r, 'Месяц', 'month') || normalize(r['Месяц']);
            const excelStatus = getExcelStatus(r);
            return {
              date: getCell(r, 'Дата', 'date'),
              month: monthFromExcel || 'Без месяца',
              type: getCell(r, 'Тип документа', 'Тип', 'type'),
              group: getCell(r, 'Группа', 'group'),
              mp_name: getCell(r, 'ИФТ', 'МП', 'mp_name', 'ФИО', 'ФИО МП', 'МП/ФИО'),
              client: getCell(r, 'Клиент', 'client'),
              articul: getCell(r, 'Артикул', 'articul'),
              oblast: getCell(r, 'Область', 'oblast'),
              region: getCell(r, 'Регион', 'region'),
              object_type: getCell(r, 'Тип Обь', 'Тип Объ', 'object_type'),
              lpu: getCell(r, 'НазваниеЛПУ', 'НазваниеПТУ', 'ЛПУ', 'lpu'),
              ab: getCell(r, 'Аб', 'АБ', 'ОБ', 'ab'),
              orientir: getCell(r, 'Ориен тир', 'Ориентир', 'orientir'),
              spec: getCell(r, 'Специальность', 'Спец', 'spec'),
              dolzhnost: getCell(r, 'Должность', 'Должн ость', 'dolzhnost'),
              amount_issued: getCell(r, 'Сумма Выдачи', 'amount_issued'),
              approved_amount: getCell(r, 'Утв Сумма', 'Ути', 'Утвержденная Сумма', 'approved_amount'),
              actual_amount: getCell(r, 'Фактическая сумма выдачи', 'actual_amount'),
              excel_status: excelStatus
            };
          }
        )
        .filter((row) => row.mp_name && row.client);

      if (!payload.length) {
        setDbUploading(false);
        setUploadProgress(0);
        setUploadStatus('');
        alert('В Excel не найдено ни одной корректной строки.');
        return;
      }

      setUploadProgress(10);
      setUploadStatus(`Загрузка ${payload.length} строк в базу...`);
      const res = await upsertMonthlyClientsPreservingChecks(payload, (pct, status) => {
        setUploadProgress(Math.round(pct));
        setUploadStatus(status);
      });
      if (!res.success) {
        setDbUploading(false);
        setUploadProgress(0);
        setUploadStatus('');
        alert(res.error || 'Не удалось загрузить базу');
        return;
      }

      const monthsInPayload = [...new Set(payload.map((r) => r.month).filter(Boolean))];
      const monthToShow = monthsInPayload.length > 0 ? monthsInPayload[0] : (dbMonth || 'Без месяца');
      setDbMonth(monthToShow);
      setUploadProgress(100);
      const sentCount = payload.filter((r) => r.excel_status).length;
      const filterMsg = sentCount > 0 ? ` Из них со статусом «Отправлено»: ${sentCount}.` : '';
      alert(
        res.warning
          ? `${res.warning}\n\nЗагружено строк: ${payload.length}.${filterMsg}`
          : `База успешно обновлена. Загружено строк: ${payload.length}.${filterMsg}`
      );
      // Обновляем список в фоне — не блокируем пользователя
      handleLoadDbClients(monthToShow).catch(() => {});
    } catch (err) {
      console.error('Failed to parse Excel file:', err);
      alert('Ошибка чтения Excel файла. Проверьте формат.');
    } finally {
      setDbUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <div className="bg-slate-900 text-white pt-6 pb-12 px-6 rounded-b-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand opacity-10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl"></div>
        
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${user.role === 'admin' ? 'bg-red-500' : 'bg-blue-500'}`}>
                    {user.role === 'admin' ? 'SuperAdmin' : 'Manager'}
                </span>
                {user.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => loadStorageUsage()}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/10 text-slate-200 hover:bg-white/15 transition-colors"
                    title="Хранилище фото чеков (нажмите для обновления)"
                  >
                    <HardDrive size={14} />
                    {storageLoading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : storageUsed != null ? (
                      <>
                        {(storageUsed / 1024 / 1024).toFixed(1)} МБ / {(STORAGE_LIMIT_BYTES / 1024 / 1024).toFixed(0)} МБ
                        <span className="text-slate-400">
                          ({((storageUsed / STORAGE_LIMIT_BYTES) * 100).toFixed(0)}%)
                        </span>
                      </>
                    ) : (
                      '—'
                    )}
                  </button>
                )}
            </div>
            <h1 className="text-2xl font-bold">{user.mpName}</h1>
            <p className="text-slate-400 text-sm">Панель управления</p>
          </div>
          <button 
            onClick={onLogout}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors backdrop-blur-sm"
          >
            <LogOut size={20} />
          </button>
        </div>

        {/* Tabs Switcher */}
        <div className="flex p-1 bg-slate-800/50 backdrop-blur-md rounded-xl mt-6">
          {visibleTabs.includes('monitoring') && (
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === 'monitoring'
                ? 'bg-brand text-white shadow-lg shadow-brand/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 size={16} />
            Мониторинг
          </button>
          )}
          {visibleTabs.includes('checks') && (
          <button
            onClick={() => setActiveTab('checks')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === 'checks'
                ? 'bg-brand text-white shadow-lg shadow-brand/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ImageIcon size={16} />
            Чеки
          </button>
          )}
          {visibleTabs.includes('database') && (
          <button
            onClick={() => setActiveTab('database')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === 'database'
                ? 'bg-brand text-white shadow-lg shadow-brand/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileSpreadsheet size={16} />
            База (Excel)
          </button>
          )}
          {visibleTabs.includes('managers') && (
          <button
            onClick={() => setActiveTab('managers')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === 'managers'
                ? 'bg-brand text-white shadow-lg shadow-brand/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users size={16} />
            Команда
          </button>
          )}
          {visibleTabs.includes('users') && (
          <button
            onClick={() => setActiveTab('users')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-all ${
              activeTab === 'users'
                ? 'bg-brand text-white shadow-lg shadow-brand/25'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCog size={16} />
            Пользователи
          </button>
          )}
        </div>
      </div>

      <div className="px-4 -mt-6 relative z-20">
        
        {/* === MONITORING TAB === */}
        {activeTab === 'monitoring' && (
            <div className="animate-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 mb-4 space-y-2">
                    <div className="flex gap-2 flex-wrap">
                        <select 
                            value={selectedMonth}
                            onChange={(e) => {
                                setSelectedMonth(e.target.value);
                                setMonitoringLoadTriggered(false);
                                setMonitoringOblast('');
                                setMonitoringGroup('');
                                setMonitoringEmployee('');
                            }}
                            className="flex-1 min-w-[140px] p-3 bg-transparent font-semibold text-slate-700 outline-none rounded-xl border border-slate-100"
                        >
                            <option value="">Месяц...</option>
                            {monthOptions.map(m => (
                            <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                        <select
                            value={monitoringOblast}
                            onChange={(e) => {
                                setMonitoringOblast(e.target.value);
                                setMonitoringGroup('');
                                setMonitoringEmployee('');
                                setMonitoringLoadTriggered(false);
                            }}
                            className="flex-1 min-w-[120px] p-3 bg-transparent text-sm text-slate-600 outline-none rounded-xl border border-slate-100"
                            disabled={!selectedMonth}
                        >
                            <option value="">Область (все)</option>
                            {monitoringFilterOptions.oblasts.map((o) => (
                                <option key={o} value={o}>{o}</option>
                            ))}
                        </select>
                        <select
                            value={monitoringGroup}
                            onChange={(e) => {
                                setMonitoringGroup(e.target.value);
                                setMonitoringEmployee('');
                                setMonitoringLoadTriggered(false);
                            }}
                            className="flex-1 min-w-[120px] p-3 bg-transparent text-sm text-slate-600 outline-none rounded-xl border border-slate-100"
                            disabled={!selectedMonth}
                        >
                            <option value="">Группа (все)</option>
                            {monitoringFilterOptions.groups.map((g) => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                        <select
                            value={monitoringEmployee}
                            onChange={(e) => {
                                setMonitoringEmployee(e.target.value);
                                setMonitoringLoadTriggered(false);
                            }}
                            className="flex-1 min-w-[120px] p-3 bg-transparent text-sm text-slate-600 outline-none rounded-xl border border-slate-100"
                            disabled={!selectedMonth}
                        >
                            <option value="">МП (все)</option>
                            {monitoringFilterOptions.employees.map((emp) => (
                                <option key={emp} value={emp}>{emp}</option>
                            ))}
                        </select>
                        <button
                            type="button"
                            onClick={() => {
                                setMonitoringLoadTriggered(true);
                                loadMonitoringData();
                            }}
                            disabled={!selectedMonth || isDataLoading || allEmployees.length === 0}
                            className="flex items-center justify-center gap-1.5 px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 disabled:pointer-events-none"
                        >
                            Показать
                        </button>
                        <button 
                            onClick={() => loadFilters()} 
                            disabled={isDataLoading}
                            className="p-3 text-slate-400 hover:text-brand transition-colors rounded-xl hover:bg-slate-50"
                        >
                            <RefreshCw size={20} className={isDataLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {!selectedMonth ? (
                    <div className="text-center py-12 text-slate-400">
                        <BarChart3 className="mx-auto mb-3 opacity-20" size={48} />
                        <p>Выберите месяц, область, группу и МП, затем нажмите «Показать».</p>
                    </div>
                ) : !monitoringLoadTriggered ? (
                    <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">
                        <p>Выберите фильтры и нажмите «Показать».</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                         {isDataLoading && allEmployees.length === 0 ? (
                             <div className="text-center py-10">
                                 <Loader2 className="animate-spin mx-auto text-brand" size={32} />
                                 <p className="text-sm text-slate-400 mt-2">Обновление базы сотрудников...</p>
                             </div>
                         ) : monitoringStats.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">
                                <p className="mb-2">Нет сотрудников по выбранным фильтрам</p>
                                <p className="text-xs text-slate-300 px-10">
                                    Убедитесь, что у вашего менеджера выбраны правильные Группы и Области.
                                </p>
                            </div>
                         ) : Object.keys(filteredGroupedStats).length === 0 ? (
                            <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">
                                <p className="mb-2">Нет данных по выбранным фильтрам</p>
                                <p className="text-xs text-slate-300 px-10">
                                    Попробуйте изменить область, группу или МП.
                                </p>
                            </div>
                        ) : (
                            Object.entries(filteredGroupedStats).sort().map(([oblast, groups]) => (
                                <div key={oblast} className="animate-in fade-in slide-in-from-bottom-2 duration-700">
                                    {/* Oblast Header */}
                                    <div className="flex items-center gap-2 mb-3 pl-2 sticky top-2 z-10">
                                        <div className="bg-slate-800/90 backdrop-blur-md text-white px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2">
                                            <MapPin size={14} className="text-brand" />
                                            <h2 className="font-bold text-sm uppercase tracking-wide">{oblast}</h2>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        {Object.entries(groups).sort().map(([group, stats]) => (
                                            <div key={group} className="bg-white rounded-3xl p-1 shadow-sm border border-slate-100 overflow-hidden">
                                                {/* Group Header */}
                                                <div className="px-4 py-2 bg-slate-50/50 border-b border-slate-50 flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{group}</h3>
                                                    <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 rounded-md font-mono">
                                                        {stats.length}
                                                    </span>
                                                </div>

                                                <div className="divide-y divide-slate-50">
                                                    {stats.sort((a,b) => a.name.localeCompare(b.name)).map((stat, idx) => {
                                                        const isExpanded = expandedEmployee === stat.name;
                                                        
                                                        // Pre-calculate details for this view
                                                        let pendingClients: Client[] = [];
                                                        let rejectedClients: Client[] = [];
                                                        let isAllSent = false;
                                                        if (stat.clients) {
                                                            rejectedClients = stat.clients.filter(c => c.checkStatus === 'rejected');
                                                            pendingClients = stat.clients.filter(c => !isClientSent(stat.name, c) && c.checkStatus !== 'rejected');
                                                            isAllSent = stat.total > 0 && pendingClients.length === 0 && rejectedClients.length === 0;
                                                        }

                                                        return (
                                                        <div key={idx} className="transition-colors">
                                                            {/* Employee Summary Row */}
                                                            <div 
                                                                onClick={() => toggleEmployeeExpand(stat.name)}
                                                                className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50' : ''} ${rejectedClients.length > 0 ? 'ring-1 ring-red-200 ring-inset rounded-xl' : ''}`}
                                                            >
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                                                        <h4 className="font-bold text-slate-800 text-sm">{stat.name}</h4>
                                                                        {rejectedClients.length > 0 && (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-lg">
                                                                                <AlertCircle size={12} />
                                                                                Отклонено: {rejectedClients.length}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {stat.loading ? (
                                                                        <span className="text-[10px] text-slate-400 animate-pulse">...</span>
                                                                    ) : (
                                                                        <div className="flex items-center gap-1">
                                                                            <span className={`text-sm font-bold ${stat.sent === stat.total && stat.total > 0 ? 'text-green-600' : 'text-brand'}`}>
                                                                                {stat.sent}
                                                                            </span>
                                                                            <span className="text-slate-300 text-xs">/</span>
                                                                            <span className="text-xs font-medium text-slate-500">{stat.total}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                
                                                                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden ml-6 w-[calc(100%-1.5rem)]">
                                                                    {!stat.loading && stat.total > 0 && (
                                                                        <div 
                                                                            className={`h-full rounded-full transition-all duration-1000 ${stat.sent === stat.total ? 'bg-green-500' : 'bg-brand'}`}
                                                                            style={{ width: `${(stat.sent / stat.total) * 100}%` }}
                                                                        ></div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Expanded Details */}
                                                            {isExpanded && stat.clients && (
                                                                <div className="bg-slate-50/50 border-y border-slate-100 px-4 py-2 animate-in slide-in-from-top-2 duration-200">
                                                                    <div className="pl-6 space-y-2">
                                                                        {rejectedClients.length > 0 && (
                                                                            <>
                                                                                <div className="flex items-center gap-2 py-2 text-red-700">
                                                                                    <AlertCircle size={14} />
                                                                                    <span className="text-xs font-bold uppercase">Проблемные чеки ({rejectedClients.length})</span>
                                                                                </div>
                                                                                {rejectedClients.map((client, cIdx) => (
                                                                                    <div key={`rej-${cIdx}`} className="py-2 border-b border-red-100 last:border-0">
                                                                                        <p className="text-xs font-bold text-slate-700 truncate">{client.client}</p>
                                                                                        {client.checkComment && (
                                                                                            <div className="mt-1 bg-red-50 text-red-800 px-2 py-1.5 rounded-lg text-[11px] border border-red-100 flex items-start gap-1.5">
                                                                                                <MessageCircle size={12} className="mt-0.5 flex-shrink-0 text-red-500" />
                                                                                                <span><span className="font-semibold">Комментарий админа:</span> {client.checkComment}</span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                            </>
                                                                        )}
                                                                        {isAllSent ? (
                                                                            <div className="py-4 text-center">
                                                                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-2">
                                                                                    <CheckCircle size={24} />
                                                                                </div>
                                                                                <p className="text-sm font-bold text-slate-700">Все чеки отправлены!</p>
                                                                                <p className="text-[10px] text-slate-400">Сотрудник молодец</p>
                                                                            </div>
                                                                        ) : (
                                                                            <>
                                                                                {pendingClients.length > 0 ? (
                                                                                    <>
                                                                                        <div className="flex items-center gap-2 py-2 text-brand">
                                                                                            <AlertCircle size={14} />
                                                                                            <span className="text-xs font-bold uppercase">Осталось сдать ({pendingClients.length})</span>
                                                                                        </div>
                                                                                        {pendingClients.map((client, cIdx) => (
                                                                                            <div key={cIdx} className="flex items-center justify-between py-2 border-b border-slate-200/60 last:border-0">
                                                                                                <div className="min-w-0">
                                                                                                    <p className="text-xs font-bold text-slate-700 truncate">
                                                                                                        {client.client}
                                                                                                    </p>
                                                                                                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                                                                                        <span className="bg-white px-1 rounded border border-slate-200">{client.type}</span>
                                                                                                        <span>{client.spec}</span>
                                                                                                    </div>
                                                                                                </div>
                                                                                                <div>
                                                                                                    <Circle size={18} className="text-slate-300" />
                                                                                                </div>
                                                                                            </div>
                                                                                        ))}
                                                                                        {stat.sent > 0 && (
                                                                                            <div className="pt-2 pb-1 text-center">
                                                                                                <span className="text-[10px] text-slate-400 bg-slate-200/50 px-2 py-1 rounded-full">
                                                                                                    + {stat.sent} отправлено
                                                                                                </span>
                                                                                            </div>
                                                                                        )}
                                                                                    </>
                                                                                ) : (
                                                                                    <p className="text-xs text-slate-400 italic py-2">Список пуст</p>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )})}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        )}

        {/* === CHECKS TAB === */}
        {activeTab === 'checks' && user.role === 'admin' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            {/* Filters: Month, Oblast, Group, Employee */}
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 mb-2 space-y-2">
              <div className="flex gap-2 flex-wrap">
                <select
                  value={checksMonth}
                  onChange={(e) => {
                    const v = e.target.value;
                    setChecksMonth(v);
                    setChecksLoadTriggered(false);
                    if (!v) {
                      setChecks([]);
                      setChecksOblast('');
                      setChecksGroup('');
                      setChecksEmployee('');
                    }
                  }}
                  className="flex-1 min-w-[140px] p-3 bg-transparent font-semibold text-slate-700 outline-none rounded-xl border border-slate-100"
                >
                  <option value="">Месяц...</option>
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select
                  value={checksOblast}
                  onChange={(e) => {
                    setChecksOblast(e.target.value);
                    setChecksGroup('');
                    setChecksEmployee('');
                  }}
                  className="flex-1 min-w-[120px] p-3 bg-transparent text-sm text-slate-600 outline-none rounded-xl border border-slate-100"
                  disabled={!checksMonth}
                >
                  <option value="">Область (все)</option>
                  {checksFilterOptions.oblasts.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                <select
                  value={checksGroup}
                  onChange={(e) => {
                    setChecksGroup(e.target.value);
                    setChecksEmployee('');
                  }}
                  className="flex-1 min-w-[120px] p-3 bg-transparent text-sm text-slate-600 outline-none rounded-xl border border-slate-100"
                  disabled={!checksMonth}
                >
                  <option value="">Группа (все)</option>
                  {checksFilterOptions.groups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <select
                  value={checksEmployee}
                  onChange={(e) => setChecksEmployee(e.target.value)}
                  className="flex-1 min-w-[120px] p-3 bg-transparent text-sm text-slate-600 outline-none rounded-xl border border-slate-100"
                  disabled={!checksMonth}
                >
                  <option value="">Сотрудник (все)</option>
                  {checksFilterOptions.employees.map((emp) => (
                    <option key={emp} value={emp}>{emp}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleChecksShow}
                  disabled={!checksMonth || checksLoading}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 disabled:pointer-events-none"
                >
                  Показать
                </button>
                {checks.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCompressExistingChecks}
                    disabled={!checksMonth || checksCompressing}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-600 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 disabled:opacity-50 disabled:pointer-events-none"
                    title="Сжать все фото за выбранный месяц (освободит место)"
                  >
                    {checksCompressing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        {compressProgress ? `${compressProgress.current}/${compressProgress.total}` : 'Сжатие...'}
                      </>
                    ) : (
                      'Сжать существующие'
                    )}
                  </button>
                )}
              </div>
            </div>
            {compressProgress && (
              <p className="text-xs text-slate-500 px-1">{compressProgress.status}</p>
            )}

            {/* Sub-tabs */}
            {checksLoadTriggered && checksMonth && !checksLoading && checks.length > 0 && (
              <div className="flex gap-1 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100">
                <button
                  onClick={() => setChecksSubTab('pending')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                    checksSubTab === 'pending'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  На проверке {checksCounts.pending > 0 && <span className="ml-1 opacity-80">({checksCounts.pending})</span>}
                </button>
                <button
                  onClick={() => setChecksSubTab('approved')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                    checksSubTab === 'approved'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Принятые {checksCounts.approved > 0 && <span className="ml-1 opacity-80">({checksCounts.approved})</span>}
                </button>
                <button
                  onClick={() => setChecksSubTab('rejected')}
                  className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all ${
                    checksSubTab === 'rejected'
                      ? 'bg-red-500 text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  Отклонённые {checksCounts.rejected > 0 && <span className="ml-1 opacity-80">({checksCounts.rejected})</span>}
                </button>
              </div>
            )}

            {checksLoadTriggered && checksMonth && !checksLoading && checks.length > 0 && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={checksSearch}
                  onChange={(e) => setChecksSearch(e.target.value)}
                  placeholder="Поиск по МП или клиенту..."
                  className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand bg-white"
                />
                <button
                  type="button"
                  onClick={() => setChecksSortAlpha(prev => !prev)}
                  title={checksSortAlpha ? 'Сортировка: по алфавиту (вкл)' : 'Сортировка: по умолчанию'}
                  className={`px-3 py-2.5 text-sm font-semibold rounded-xl border transition-all ${
                    checksSortAlpha
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-brand hover:text-brand'
                  }`}
                >
                  А→Я
                </button>
              </div>
            )}

            {checksLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-brand" size={32} />
              </div>
            ) : !checksMonth ? (
              <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">
                <p>Выберите месяц, область, группу и МП, затем нажмите «Показать».</p>
              </div>
            ) : !checksLoadTriggered ? (
              <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">
                <p>Выберите фильтры и нажмите «Показать».</p>
              </div>
            ) : checks.length === 0 ? (
              <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">
                <p>За этот месяц пока нет загруженных чеков.</p>
              </div>
            ) : filteredChecks.length === 0 ? (
              <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">
                <p>
                  {checksSubTab === 'pending' && 'Нет чеков на проверке.'}
                  {checksSubTab === 'approved' && 'Нет принятых чеков.'}
                  {checksSubTab === 'rejected' && 'Нет отклонённых чеков.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredChecks.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => setSelectedCheck({ imageUrl: item.imageUrl, approvedAmount: item.approvedAmount, id: item.id, status: item.status, mpName: item.mpName, month: item.month, doctorName: item.doctorName, clientName: item.clientName, clientType: item.clientType })}
                        className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-50"
                      >
                        <img
                          src={item.imageUrl}
                          alt={item.clientName}
                          className="w-full h-full object-cover"
                        />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          {item.mpName}
                        </p>
                        <p className="text-sm font-bold text-slate-800 truncate">
                          {item.clientName}
                        </p>
                        {item.approvedAmount && (
                          <p className="text-sm font-medium text-emerald-600 mt-0.5">
                            Утверждённая сумма: {item.approvedAmount}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(item.submittedAt).toLocaleString()}
                          {item.reviewedAt && ` · ${new Date(item.reviewedAt).toLocaleString()}`}
                        </p>
                        {item.adminComment && (
                          <div className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 mt-2 flex items-start gap-1.5">
                            <MessageCircle size={12} className="mt-0.5 flex-shrink-0 text-slate-400" />
                            <span>{item.adminComment}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions for pending checks */}
                    {item.status === 'pending' && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        {rejectingCheckId === item.id ? (
                          <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                            <textarea
                              value={rejectComment}
                              onChange={(e) => setRejectComment(e.target.value)}
                              placeholder="Причина отклонения..."
                              className="w-full p-3 text-sm border border-red-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 resize-none bg-red-50/50"
                              rows={2}
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setRejectingCheckId(null); setRejectComment(''); }}
                                className="flex-1 py-2 text-xs font-semibold bg-slate-100 text-slate-600 rounded-xl"
                              >
                                Отмена
                              </button>
                              <button
                                onClick={() => handleUpdateCheckStatus(item.id, 'rejected', rejectComment)}
                                className="flex-1 py-2 text-xs font-semibold bg-red-500 text-white rounded-xl flex items-center justify-center gap-1"
                              >
                                <Send size={12} />
                                Отклонить
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedCheck({ imageUrl: item.imageUrl, approvedAmount: item.approvedAmount, id: item.id, status: item.status, mpName: item.mpName, month: item.month, doctorName: item.doctorName, clientName: item.clientName, clientType: item.clientType })}
                              className="flex-1 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center gap-1"
                            >
                              <ImageIcon size={14} />
                              Открыть
                            </button>
                            <button
                              onClick={() => handleUpdateCheckStatus(item.id, 'approved')}
                              className="flex-1 py-2 text-xs font-semibold bg-emerald-500 text-white rounded-xl"
                            >
                              Принять
                            </button>
                            <button
                              onClick={() => { setRejectingCheckId(item.id); setRejectComment(''); }}
                              className="flex-1 py-2 text-xs font-semibold bg-red-500 text-white rounded-xl"
                            >
                              Отклонить
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions for approved - view + reject */}
                    {item.status === 'approved' && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        {rejectingCheckId === item.id ? (
                          <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                            <textarea
                              value={rejectComment}
                              onChange={(e) => setRejectComment(e.target.value)}
                              placeholder="Причина отклонения..."
                              className="w-full p-3 text-sm border border-red-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300 resize-none bg-red-50/50"
                              rows={2}
                              autoFocus
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => { setRejectingCheckId(null); setRejectComment(''); }}
                                className="flex-1 py-2 text-xs font-semibold bg-slate-100 text-slate-600 rounded-xl"
                              >
                                Отмена
                              </button>
                              <button
                                onClick={() => handleUpdateCheckStatus(item.id, 'rejected', rejectComment)}
                                className="flex-1 py-2 text-xs font-semibold bg-red-500 text-white rounded-xl flex items-center justify-center gap-1"
                              >
                                <Send size={12} />
                                Отклонить
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedCheck({ imageUrl: item.imageUrl, approvedAmount: item.approvedAmount, id: item.id, status: item.status, mpName: item.mpName, month: item.month, doctorName: item.doctorName, clientName: item.clientName, clientType: item.clientType })}
                              className="flex-1 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center gap-1"
                            >
                              <ImageIcon size={14} />
                              Открыть чек
                            </button>
                            <button
                              onClick={() => { setRejectingCheckId(item.id); setRejectComment(''); }}
                              className="flex-1 py-2 text-xs font-semibold bg-red-500 text-white rounded-xl"
                            >
                              Отклонить
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions for rejected - view + delete */}
                    {item.status === 'rejected' && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedCheck({ imageUrl: item.imageUrl, approvedAmount: item.approvedAmount, id: item.id, status: item.status, mpName: item.mpName, month: item.month, doctorName: item.doctorName, clientName: item.clientName, clientType: item.clientType })}
                            className="flex-1 py-2 text-xs font-semibold bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center gap-1"
                          >
                            <ImageIcon size={14} />
                            Открыть чек
                          </button>
                          <button
                            onClick={() => handleDeleteCheck(item.id, item.imageUrl)}
                            disabled={deletingCheckId === item.id}
                            className="flex-1 py-2 text-xs font-semibold bg-red-500 text-white rounded-xl flex items-center justify-center gap-1 disabled:opacity-50"
                          >
                            {deletingCheckId === item.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Trash2 size={14} />
                            )}
                            Удалить
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* === DATABASE (EXCEL) TAB === */}
        {activeTab === 'database' && user.role === 'admin' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 mb-2 space-y-2">
              <div className="flex flex-wrap gap-2">
                <select
                  value={dbMonth}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDbMonth(v);
                    setDbLoadTriggered(false);
                    setDbShowResults(false);
                    if (!v) {
                      setDbClients([]);
                      setDbOblast('');
                      setDbGroup('');
                      setDbEmployee('');
                    }
                  }}
                  className="flex-1 min-w-[140px] p-3 bg-transparent font-semibold text-slate-700 outline-none rounded-xl border border-slate-100"
                >
                  <option value="">Месяц базы...</option>
                  {monthOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={dbOblast}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDbOblast(v);
                    setDbGroup('');
                    setDbEmployee('');
                    setDbShowResults(false);
                  }}
                  className="flex-1 min-w-[120px] p-3 bg-transparent text-sm text-slate-600 outline-none rounded-xl border border-slate-100"
                  disabled={!dbMonth}
                >
                  <option value="">Область (все)</option>
                  {dbFilterOptions.oblasts.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                <select
                  value={dbGroup}
                  onChange={(e) => {
                    const v = e.target.value;
                    setDbGroup(v);
                    setDbEmployee('');
                    setDbShowResults(false);
                  }}
                  className="flex-1 min-w-[120px] p-3 bg-transparent text-sm text-slate-600 outline-none rounded-xl border border-slate-100"
                  disabled={!dbMonth}
                >
                  <option value="">Группа (все)</option>
                  {dbFilterOptions.groups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <select
                  value={dbEmployee}
                  onChange={(e) => {
                    setDbEmployee(e.target.value);
                    setDbShowResults(false);
                  }}
                  className="flex-1 min-w-[120px] p-3 bg-transparent text-sm text-slate-600 outline-none rounded-xl border border-slate-100"
                  disabled={!dbMonth}
                >
                  <option value="">МП (все)</option>
                  {dbFilterOptions.employees.map((emp) => (
                    <option key={emp} value={emp}>{emp}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleDbShow}
                  disabled={!dbMonth || dbLoading}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 disabled:pointer-events-none"
                >
                  Показать
                </button>
              <button
                type="button"
                onClick={handleClearMonth}
                disabled={!dbMonth || dbLoading || dbUploading}
                className="flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-100 disabled:opacity-50 disabled:pointer-events-none"
                title="Удалить все строки за выбранный месяц"
              >
                <Trash2 size={16} />
                Очистить месяц
              </button>
              <label className="flex items-center justify-center px-3 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold cursor-pointer gap-1">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleExcelUpload}
                />
                <FileSpreadsheet size={16} />
                {dbUploading ? 'Загрузка...' : 'Excel'}
              </label>
              </div>
            </div>

            {dbLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-brand" size={32} />
              </div>
            ) : !dbMonth ? (
              <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">
                <p>Выберите месяц и при необходимости загрузите Excel.</p>
              </div>
            ) : !dbMonth ? (
              <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">
                <p>Выберите месяц, область, группу и МП, затем нажмите «Показать».</p>
              </div>
            ) : !dbLoadTriggered ? (
              <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">
                <p>Выберите фильтры и нажмите «Показать».</p>
              </div>
            ) : dbClients.length === 0 ? (
              <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">
                <p>Для выбранного месяца база пока пуста.</p>
                <p className="text-xs mt-2 text-slate-300">Загрузите Excel или выберите другой месяц.</p>
              </div>
            ) : filteredDbClients.length === 0 ? (
              <div className="text-center py-10 text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">
                <p>Нет данных по выбранным фильтрам.</p>
                {(dbOblast || dbGroup || dbEmployee) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDbOblast('');
                      setDbGroup('');
                      setDbEmployee('');
                      setDbShowResults(true);
                    }}
                    className="mt-3 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium"
                  >
                    Сбросить фильтры и показать все ({dbClients.length})
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 px-1">
                  Показано строк: <strong>{filteredDbClients.length}</strong>
                  {filteredDbClients.length !== dbClients.length && ` (из ${dbClients.length} за месяц)`}
                  {' · '}
                  Если столбцы Дата, Должность, Суммы пустые — выполните в Supabase SQL из файла <code className="bg-slate-100 px-1 rounded">supabase_migration_add_all_columns.sql</code> и загрузите Excel заново.
                </p>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1400px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Дата</th>
                        <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Месяц</th>
                        <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Тип документа</th>
                        <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Группа</th>
                        <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">МП</th>
                        <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Клиент</th>
                        <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Артикул</th>
                        <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Область</th>
                        <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Регион</th>
                        <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Тип Обь</th>
                        <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">НазваниеЛПУ</th>
                        <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Аб</th>
                        <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Ориен тир</th>
                        <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Специальность</th>
                        <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Должность</th>
                        <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Сумма Выдачи</th>
                        <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Утв Сумма</th>
                        <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Факт. сумма</th>
                        <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider w-12 text-center">—</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDbClients.map((row) => {
                        const isCheckSent = (row.status && String(row.status).toLowerCase().includes('отправлено')) && row.checkStatus !== 'rejected';
                        return (
                        <tr
                          key={String(row.id)}
                          className={`border-b border-slate-100 transition-colors ${isCheckSent ? 'bg-green-50 hover:bg-green-100/80' : 'hover:bg-slate-50/50'}`}
                        >
                          <td className="px-2 py-2 text-sm text-slate-600 whitespace-nowrap">{row.date && String(row.date).trim() ? row.date : '—'}</td>
                          <td className="px-2 py-2 text-sm text-slate-600 whitespace-nowrap">{row.month && String(row.month).trim() ? row.month : '—'}</td>
                          <td className="px-2 py-2 text-sm text-slate-600 whitespace-nowrap">{row.type && String(row.type).trim() ? row.type : '—'}</td>
                          <td className="px-2 py-2 text-sm text-slate-600 whitespace-nowrap">{row.group && String(row.group).trim() ? row.group : '—'}</td>
                          <td className="px-2 py-2 text-sm text-slate-600 whitespace-nowrap">{row.mpName && String(row.mpName).trim() ? row.mpName : '—'}</td>
                          <td className="px-2 py-2 text-sm font-medium text-slate-800 whitespace-nowrap">{row.client && String(row.client).trim() ? row.client : '—'}</td>
                          <td className="px-2 py-2 text-sm text-slate-600 whitespace-nowrap">{row.articul && String(row.articul).trim() ? row.articul : '—'}</td>
                          <td className="px-2 py-2 text-sm text-slate-600 whitespace-nowrap">{row.oblast && String(row.oblast).trim() ? row.oblast : '—'}</td>
                          <td className="px-2 py-2 text-sm text-slate-600 whitespace-nowrap">{row.region && String(row.region).trim() ? row.region : '—'}</td>
                          <td className="px-2 py-2 text-sm text-slate-600 whitespace-nowrap">{row.objectType && String(row.objectType).trim() ? row.objectType : '—'}</td>
                          <td className="px-2 py-2 text-sm text-slate-600 whitespace-nowrap">{row.lpu && String(row.lpu).trim() ? row.lpu : '—'}</td>
                          <td className="px-2 py-2 text-sm text-slate-600 whitespace-nowrap">{row.ab && String(row.ab).trim() ? row.ab : '—'}</td>
                          <td className="px-2 py-2 text-sm text-slate-600 whitespace-nowrap">{row.orientir && String(row.orientir).trim() ? row.orientir : '—'}</td>
                          <td className="px-2 py-2 text-sm text-slate-600 whitespace-nowrap">{row.spec && String(row.spec).trim() ? row.spec : '—'}</td>
                          <td className="px-2 py-2 text-sm text-slate-600 whitespace-nowrap">{row.dolzhnost && String(row.dolzhnost).trim() ? row.dolzhnost : '—'}</td>
                          <td className="px-2 py-2 text-sm text-slate-600 whitespace-nowrap">{row.amountIssued && String(row.amountIssued).trim() ? row.amountIssued : '—'}</td>
                          <td className="px-2 py-2 text-sm text-slate-600 whitespace-nowrap">{row.approvedAmount && String(row.approvedAmount).trim() ? row.approvedAmount : '—'}</td>
                          <td className="px-2 py-2 text-sm text-slate-600 whitespace-nowrap">{row.actualAmount && String(row.actualAmount).trim() ? row.actualAmount : '—'}</td>
                          <td className="px-2 py-2 text-center">
                            <button
                              onClick={() => handleDeleteDbClient(row)}
                              className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                              title="Удалить"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* === MANAGERS TAB === */}
        {activeTab === 'managers' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            {managersLoading ? (
               <div className="flex justify-center py-10">
                   <Loader2 className="animate-spin text-brand" size={32} />
               </div>
            ) : managers.length > 0 ? (
                managers.map(manager => {
                const count = getEmployeeCountForManager(manager);
                const assignedOblasts = manager.assignedOblasts || [];
                const assignedGroups = manager.assignedGroups || [];
                
                return (
                <div key={manager.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 relative group">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${manager.role === 'admin' ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                <UserCog size={20} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-slate-800">{manager.name}</h3>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${manager.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {manager.role === 'admin' ? 'Админ' : 'Менеджер'}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded inline-block">
                                    {manager.login} / {manager.pass}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                        <button 
                            onClick={() => openEditModal(manager)}
                            className="text-slate-300 hover:text-brand transition-colors p-2 bg-slate-50 rounded-lg"
                        >
                            <Pencil size={18} />
                        </button>
                        <button 
                            onClick={() => handleDeleteManager(manager.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors p-2 bg-slate-50 rounded-lg"
                        >
                            <Trash2 size={18} />
                        </button>
                        </div>
                    </div>
                    
                    <div className="border-t border-slate-50 pt-3 space-y-2">
                        <div className="flex justify-between items-center text-xs text-slate-400 uppercase font-bold tracking-wider mb-1">
                            <span>Доступ</span>
                            <span className={`px-2 py-0.5 rounded-full ${count > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                                {count} сотр.
                            </span>
                        </div>

                        <div className="flex flex-wrap gap-1">
                        {assignedOblasts.length > 0 ? assignedOblasts.map(obl => (
                            <span key={obl} className="px-2 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-md border border-blue-100 uppercase">
                            {obl}
                            </span>
                        )) : <span className="text-[10px] text-slate-300">Все области</span>}
                        
                        {assignedGroups.length > 0 ? assignedGroups.map(grp => (
                            <span key={grp} className="px-2 py-1 bg-purple-50 text-purple-600 text-[10px] font-bold rounded-md border border-purple-100 uppercase">
                            {grp}
                            </span>
                        )) : <span className="text-[10px] text-slate-300">Все группы</span>}
                        </div>
                    </div>
                </div>
                )})
            ) : (
                <div className="text-center py-20 opacity-50">
                    <Users size={48} className="mx-auto mb-2" />
                    <p>Список менеджеров пуст</p>
                </div>
            )}
          </div>
        )}

        {/* === USERS (МП) TAB === */}
        {activeTab === 'users' && user.role === 'admin' && (
          <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openAddUserModal}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold"
              >
                <Plus size={18} />
                Добавить вручную
              </button>
              <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-semibold cursor-pointer">
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUploadUsers} />
                <FileSpreadsheet size={18} />
                {mpUsersUploading ? 'Загрузка...' : 'Загрузить Excel'}
              </label>
              <button type="button" onClick={() => loadMpUsers()} disabled={mpUsersLoading} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-200 disabled:opacity-50">
                <RefreshCw size={18} className={mpUsersLoading ? 'animate-spin' : ''} />
                Обновить список
              </button>
            </div>
            <p className="text-xs text-slate-500 px-1">
              Формат Excel: столбцы <strong>Логин</strong>, <strong>Пароль</strong>, <strong>МП</strong>, <strong>Область</strong>, <strong>Группа</strong>.
            </p>
            {mpUsers.length > 0 && (
              <div className="bg-white p-3 rounded-2xl border border-slate-100 flex flex-wrap gap-2 items-center">
                <div className="flex-1 min-w-[180px] relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Поиск по логину, МП, области..."
                    value={mpUsersSearch}
                    onChange={(e) => setMpUsersSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
                  />
                </div>
                <select
                  value={mpUsersOblast}
                  onChange={(e) => setMpUsersOblast(e.target.value)}
                  className="min-w-[120px] px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">Область (все)</option>
                  {mpUsersOblastOptions.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
                <select
                  value={mpUsersGroup}
                  onChange={(e) => setMpUsersGroup(e.target.value)}
                  className="min-w-[120px] px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">Группа (все)</option>
                  {mpUsersGroupOptions.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            )}
            {mpUsersError && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
                <p className="font-semibold">Не удалось загрузить список</p>
                <p className="mt-1">{mpUsersError}</p>
                <p className="mt-2 text-xs">
                  Если данные в Supabase есть, но здесь пусто — в таблице <code className="bg-amber-100 px-1 rounded">users</code> включён RLS. 
                  Выполните в Supabase SQL из <code className="bg-amber-100 px-1 rounded">supabase_migration_users_table.sql</code> (блок с политиками) или добавьте политику SELECT для anon.
                </p>
                <button type="button" onClick={() => loadMpUsers()} className="mt-3 px-3 py-1.5 bg-amber-200 rounded-lg text-sm font-medium hover:bg-amber-300">
                  Повторить
                </button>
              </div>
            )}
            {mpUsersLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-brand" size={32} />
              </div>
            ) : mpUsers.length === 0 && !mpUsersError ? (
              <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-100 border-dashed">
                <Users size={48} className="mx-auto mb-2 opacity-50" />
                <p>Пользователей пока нет.</p>
                <p className="text-xs mt-1">Загрузите Excel или добавьте вручную.</p>
              </div>
            ) : mpUsers.length === 0 ? null : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-3 py-2 text-xs font-bold text-slate-500 uppercase">Логин</th>
                        <th className="px-3 py-2 text-xs font-bold text-slate-500 uppercase">Пароль</th>
                        <th className="px-3 py-2 text-xs font-bold text-slate-500 uppercase">МП</th>
                        <th className="px-3 py-2 text-xs font-bold text-slate-500 uppercase">Область</th>
                        <th className="px-3 py-2 text-xs font-bold text-slate-500 uppercase">Группа</th>
                        <th className="px-2 py-2 w-24 text-center">—</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMpUsers.map((u) => (
                        <tr key={u.id || u.login} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="px-3 py-2 text-sm font-medium text-slate-800">{u.login}</td>
                          <td className="px-3 py-2 text-sm text-slate-600">{u.pass}</td>
                          <td className="px-3 py-2 text-sm text-slate-600">{u.mp_name}</td>
                          <td className="px-3 py-2 text-sm text-slate-600">{u.oblast || '—'}</td>
                          <td className="px-3 py-2 text-sm text-slate-600">{u.group || '—'}</td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => openEditUserModal(u)}
                              className="p-2 rounded-lg text-slate-400 hover:text-brand"
                              title="Изменить"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMpUser(u)}
                              className="p-2 rounded-lg text-slate-400 hover:text-red-500"
                              title="Удалить"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedCheck && (
        <CheckImageViewer
          imageUrl={selectedCheck.imageUrl}
          approvedAmount={selectedCheck.approvedAmount}
          checkId={selectedCheck.id}
          checkStatus={selectedCheck.status}
          mpName={selectedCheck.mpName}
          month={selectedCheck.month}
          doctorName={selectedCheck.clientName}
          clientType={selectedCheck.clientType}
          onApprove={async () => {
            if (selectedCheck.id && (await handleUpdateCheckStatus(selectedCheck.id, 'approved'))) {
              setSelectedCheck(null);
            }
          }}
          onReject={async (comment) => {
            if (selectedCheck.id && (await handleUpdateCheckStatus(selectedCheck.id, 'rejected', comment))) {
              setSelectedCheck(null);
            }
          }}
          onClose={() => setSelectedCheck(null)}
        />
      )}

      {/* Floating Add Button for Managers */}
      {activeTab === 'managers' && (
        <div className="fixed bottom-6 left-0 right-0 px-6 z-30 flex justify-center pointer-events-none">
            <button 
              onClick={openCreateModal}
              className="pointer-events-auto w-full max-w-sm flex items-center justify-center gap-2 py-4 bg-brand text-white rounded-2xl shadow-xl shadow-brand/30 hover:bg-brand-dark active:scale-95 transition-all font-bold"
            >
              <Plus size={20} />
              Добавить в команду
            </button>
        </div>
      )}

      {/* Add/Edit Manager Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 zoom-in-95 max-h-[90vh] overflow-y-auto no-scrollbar">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-800">
                    {editingId ? 'Редактировать' : 'Новый в команде'}
                  </h2>
                  <button onClick={() => setShowModal(false)} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200">
                    <X size={16} />
                  </button>
                </div>
                
                <form onSubmit={handleSaveManager} className="space-y-4">
                    {/* Role */}
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Роль</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, role: 'admin' }))}
                          className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                            formData.role === 'admin'
                              ? 'bg-red-50 border-red-500 text-red-700'
                              : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          Админ
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, role: 'manager' }))}
                          className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                            formData.role === 'manager'
                              ? 'bg-blue-50 border-blue-500 text-blue-700'
                              : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          Менеджер
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {formData.role === 'admin' ? 'Доступ ко всем разделам. Можно ограничить по областям.' : 'Только Мониторинг. Доступ по областям и группам.'}
                      </p>
                    </div>

                    {/* Basic Info */}
                    <div className="space-y-3">
                      <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Имя</label>
                          <input 
                              required
                              type="text" 
                              className="w-full px-4 py-3 bg-slate-50 rounded-xl border-slate-200 border focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                              placeholder="Иван Иванов"
                              value={formData.name}
                              onChange={e => setFormData({...formData, name: e.target.value})}
                          />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Логин</label>
                              <input 
                                  required
                                  type="text" 
                                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border-slate-200 border focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                                  placeholder="ivan"
                                  value={formData.login}
                                  onChange={e => setFormData({...formData, login: e.target.value})}
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Пароль</label>
                              <input 
                                  required
                                  type="text" 
                                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border-slate-200 border focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                                  placeholder="1234"
                                  value={formData.pass}
                                  onChange={e => setFormData({...formData, pass: e.target.value})}
                              />
                          </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2 mb-3 text-slate-600">
                            <ShieldCheck size={16} className="text-brand" />
                            <span className="text-xs font-bold uppercase">
                              {formData.role === 'admin' ? 'Доступ по областям' : 'Доступ (области и группы)'}
                            </span>
                        </div>

                        {/* Permissions: Oblasts */}
                        <div className="mb-4">
                        <div className="flex justify-between items-center mb-2">
                            <label className="flex items-center gap-1 text-xs font-bold text-slate-400 uppercase">
                                <MapPin size={12} /> Области {formData.role === 'admin' && '(пусто = все)'}
                            </label>
                            {isDataLoading && <Loader2 size={12} className="animate-spin text-brand" />}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {availableOblasts.length > 0 ? availableOblasts.map(obl => {
                            const isSelected = formData.oblasts.includes(obl);
                            return (
                                <button
                                key={obl}
                                type="button"
                                onClick={() => toggleOblast(obl)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                    isSelected 
                                    ? 'bg-blue-500 border-blue-500 text-white shadow-md shadow-blue-500/20' 
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'
                                }`}
                                >
                                {obl}
                                </button>
                            );
                            }) : (
                                <p className="text-xs text-slate-400 italic">Данные не загружены.</p>
                            )}
                        </div>
                        </div>

                        {/* Permissions: Groups (for Manager only, or for Admin with limited access) */}
                        <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="flex items-center gap-1 text-xs font-bold text-slate-400 uppercase">
                                <Layers size={12} /> Группы {formData.role === 'manager' && '(обязательно)'}
                            </label>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {availableGroups.length > 0 ? availableGroups.map(grp => {
                            const isSelected = formData.groups.includes(grp);
                            return (
                                <button
                                key={grp}
                                type="button"
                                onClick={() => toggleGroup(grp)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                    isSelected 
                                    ? 'bg-purple-500 border-purple-500 text-white shadow-md shadow-purple-500/20' 
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-purple-300'
                                }`}
                                >
                                {grp}
                                </button>
                            );
                            }) : (
                                <p className="text-xs text-slate-400 italic">Данные не загружены.</p>
                            )}
                        </div>
                        </div>

                        {/* Permissions: Sections (for Admin only) */}
                        {formData.role === 'admin' && (
                        <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="flex items-center gap-2 mb-3 text-slate-600">
                            <Layers size={16} className="text-brand" />
                            <span className="text-xs font-bold uppercase">Доступ к разделам</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mb-2">Пусто = все разделы. Выберите — только указанные.</p>
                        <div className="flex flex-wrap gap-2">
                            {SECTIONS.map(({ id, label }) => {
                            const isSelected = formData.sections.includes(id);
                            return (
                                <button
                                key={id}
                                type="button"
                                onClick={() => toggleSection(id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                                    isSelected 
                                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20' 
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-300'
                                }`}
                                >
                                {label}
                                </button>
                            );
                            })}
                        </div>
                        </div>
                        )}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button 
                            type="button" 
                            disabled={isSavingManager}
                            onClick={() => setShowModal(false)}
                            className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                        >
                            Отмена
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSavingManager}
                            className="flex-1 py-3 text-white font-bold bg-brand rounded-xl hover:bg-brand-dark shadow-lg shadow-brand/30 transition-colors flex justify-center items-center gap-2"
                        >
                            {isSavingManager ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>Сохранение...</span>
                                </>
                            ) : (
                                <span>{editingId ? 'Сохранить' : 'Создать'}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Add/Edit User (МП) Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">
                {editingMpUserId ? 'Редактировать пользователя' : 'Новый пользователь (МП)'}
              </h2>
              <button onClick={() => setShowUserModal(false)} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSaveMpUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Логин</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                  placeholder="Камолиддин"
                  value={userForm.login}
                  onChange={(e) => setUserForm((f) => ({ ...f, login: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Пароль</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                  placeholder="002945"
                  value={userForm.pass}
                  onChange={(e) => setUserForm((f) => ({ ...f, pass: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">МП (ФИО)</label>
                <input
                  required
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                  placeholder="Вахобов Камолиддин Наимович"
                  value={userForm.mp_name}
                  onChange={(e) => setUserForm((f) => ({ ...f, mp_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Область</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                  placeholder="Душанбе"
                  value={userForm.oblast}
                  onChange={(e) => setUserForm((f) => ({ ...f, oblast: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Группа</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-200 focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                  placeholder="Альфа, Бета, Гамма..."
                  value={userForm.group}
                  onChange={(e) => setUserForm((f) => ({ ...f, group: e.target.value }))}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  disabled={savingUser}
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-xl hover:bg-slate-200"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="flex-1 py-3 text-white font-bold bg-brand rounded-xl hover:bg-brand-dark shadow-lg shadow-brand/30 flex justify-center items-center gap-2"
                >
                  {savingUser ? <Loader2 size={18} className="animate-spin" /> : (editingMpUserId ? 'Сохранить' : 'Добавить')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Прогресс загрузки Excel */}
      {dbUploading && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="animate-spin text-brand flex-shrink-0" size={28} />
              <div>
                <p className="font-bold text-slate-800">Загрузка Excel</p>
                <p className="text-sm text-slate-500">{uploadStatus || 'Обработка...'}</p>
              </div>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-right text-xs font-semibold text-slate-500 mt-2">{uploadProgress}%</p>
          </div>
        </div>
      )}
    </div>
  );
};