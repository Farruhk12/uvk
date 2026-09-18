import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Loader2, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, ListFilter, Send, X } from 'lucide-react';
import {
  previewBelindaUvk,
  scanBelindaUvk,
  fetchCachedBelindaUvkScan,
  upsertMonthlyClientsPreservingChecks,
  MonthlyClientPayload
} from '../services/api';
import { BelindaPreviewRow, BelindaUvkScanResult, BelindaUvkFilters } from '../types';

/**
 * Интеграция с Belinda 1С (get_uvk) → основная база (monthly_clients).
 * 1) Предпросмотр (mode=preview) — тянет из 1С и показывает в браузере, НИЧЕГО не пишет в БД.
 * 2) «Отправить в базу» — вызывает upsertMonthlyClientsPreservingChecks, ТУ ЖЕ функцию,
 *    что использует загрузка Excel во вкладке «База»: upsert по ключу (месяц, МП, клиент),
 *    существующие чеки не отвязываются. Пишет напрямую в боевую monthly_clients — то,
 *    что сразу видят МП в личном кабинете.
 */

/** Общий вид строки для группировки — и staging, и предпросмотр приводятся к нему. */
interface DisplayRow {
  key: string;
  date: string;
  month: string;
  oblast: string;
  region: string;
  group: string;
  mpName: string;
  type: string;
  client: string;
  articul: string;
  objectType: string;
  lpu: string;
  ab: string;
  orientir: string;
  spec: string;
  dolzhnost: string;
  amountIssued: string;
  approvedAmount: string;
  actualAmount: string;
}

const previewRowToDisplay = (r: BelindaPreviewRow): DisplayRow => ({
  key: `${r.source_doc_id}|${r.item_index}`,
  date: r.date,
  month: r.month,
  oblast: r.oblast,
  region: r.region,
  group: r.group,
  mpName: r.mp_name,
  type: r.type,
  client: r.client,
  articul: r.articul,
  objectType: r.object_type,
  lpu: r.lpu,
  ab: r.ab,
  orientir: r.orientir,
  spec: r.spec,
  dolzhnost: r.dolzhnost,
  amountIssued: r.amount_issued,
  approvedAmount: r.approved_amount,
  actualAmount: r.actual_amount
});

/** Переводит строку предпросмотра в формат, который ожидает upsertMonthlyClientsPreservingChecks. */
const previewRowToMonthlyClientPayload = (r: BelindaPreviewRow): MonthlyClientPayload => ({
  month: r.month,
  mp_name: r.mp_name,
  client: r.client,
  type: r.type,
  spec: r.spec,
  ab: r.ab,
  group: r.group,
  lpu: r.lpu,
  oblast: r.oblast,
  date: r.date,
  articul: r.articul,
  region: r.region,
  object_type: r.object_type,
  orientir: r.orientir,
  dolzhnost: r.dolzhnost,
  amount_issued: r.amount_issued,
  approved_amount: r.approved_amount,
  actual_amount: r.actual_amount
});

/** Строка считается «утверждённой», если approvedAmount заполнен и не равен нулю. */
const isApprovedRow = (r: DisplayRow): boolean => {
  if (r.approvedAmount === '' || r.approvedAmount == null) return false;
  const n = Number(r.approvedAmount);
  return Number.isFinite(n) && n !== 0;
};

interface OblastMismatch {
  mp: string;
  expectedOblast: string;
  actualOblast: string;
  client: string;
  lpu: string;
  spec: string;
  group: string;
  type: string;
}

/**
 * Находит строки, где у сотрудника (МП) область отличается от его основной
 * (самой частой) области — типичная ошибка, когда выбрали не того врача из-за
 * совпадения фамилий. Возвращает подозрительные строки для проверки в 1С.
 */
const findOblastMismatches = (rows: DisplayRow[]): OblastMismatch[] => {
  const byMp = new Map<string, DisplayRow[]>();
  for (const r of rows) {
    const mp = r.mpName || 'Без МП';
    if (!byMp.has(mp)) byMp.set(mp, []);
    byMp.get(mp)!.push(r);
  }

  const mismatches: OblastMismatch[] = [];
  for (const [mp, mpRows] of byMp.entries()) {
    const counts = new Map<string, number>();
    for (const r of mpRows) {
      const o = r.oblast || 'Без области';
      counts.set(o, (counts.get(o) || 0) + 1);
    }
    if (counts.size <= 1) continue; // у МП только одна область — расхождений нет

    let mainOblast = '';
    let mainCount = -1;
    for (const [o, c] of counts.entries()) {
      if (c > mainCount) {
        mainOblast = o;
        mainCount = c;
      }
    }

    for (const r of mpRows) {
      const o = r.oblast || 'Без области';
      if (o !== mainOblast) {
        mismatches.push({
          mp,
          expectedOblast: mainOblast,
          actualOblast: o,
          client: r.client,
          lpu: r.lpu,
          spec: r.spec,
          group: r.group,
          type: r.type
        });
      }
    }
  }

  return mismatches;
};

/** Модалка со списком расхождений по области — для МП, группы или целой области. */
const MismatchModal: React.FC<{ title: string; mismatches: OblastMismatch[]; onClose: () => void }> = ({
  title,
  mismatches,
  onClose
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
    <div
      className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-amber-50">
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-800">
          <AlertTriangle size={16} />
          {title}: клиенты не из своей области ({mismatches.length})
        </span>
        <button type="button" onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
          <X size={18} />
        </button>
      </div>
      <div className="p-4 overflow-y-auto space-y-3">
        <p className="text-xs text-slate-500">
          У сотрудника большинство клиентов из одной области, но эти — из другой. Вероятно, при совпадении фамилий
          врачей выбрали не того. Проверьте в 1С.
        </p>
        {mismatches.map((m, i) => (
          <div key={i} className="border border-slate-200 rounded-xl p-3 text-sm">
            <p className="font-semibold text-slate-800">{m.client}</p>
            <p className="text-slate-500 text-xs mt-0.5">
              {m.mp} · {m.lpu} {m.spec ? `· ${m.spec}` : ''}
            </p>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="text-slate-500">Ожидалась:</span>
              <span className="font-medium text-slate-700">{m.expectedOblast}</span>
              <span className="text-slate-300">→</span>
              <span className="text-slate-500">Указана:</span>
              <span className="font-semibold text-red-600">{m.actualOblast}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/** Кликабельная иконка ошибки для заголовков Область/Группа/МП. */
const MismatchIcon: React.FC<{ count: number; onClick: () => void }> = ({ count, onClick }) => (
  <span
    role="button"
    tabIndex={0}
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className="p-1 rounded-md text-amber-500 hover:text-amber-700 hover:bg-amber-50"
    title={`Возможная ошибка: ${count} клиент(ов) не из своей области`}
  >
    <AlertTriangle size={15} />
  </span>
);

const StatBadge: React.FC<{ approvedCount: number; total: number; approvedSum: number; size?: 'sm' | 'md' }> = ({
  approvedCount,
  total,
  approvedSum,
  size = 'md'
}) => {
  const allApproved = total > 0 && approvedCount === total;
  const color = allApproved ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50';
  const sizeCls = size === 'sm' ? 'text-[11px] px-1.5 py-0.5' : 'text-xs px-2 py-1';
  return (
    <span className={`font-semibold whitespace-nowrap rounded-md ${sizeCls} ${color}`}>
      ({approvedCount}/{total}) · {approvedSum.toLocaleString('ru-RU')}
    </span>
  );
};

/** Область → Группа → МП → Тип документа → таблица клиентов, всё сворачиваемо. */
const GroupedRowsAccordion: React.FC<{ rows: DisplayRow[]; emptyText: string }> = ({ rows, emptyText }) => {
  const [openOblast, setOpenOblast] = useState<string | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [openMp, setOpenMp] = useState<string | null>(null);
  const [openDoctype, setOpenDoctype] = useState<string | null>(null);
  const [mismatchModal, setMismatchModal] = useState<{ title: string; items: OblastMismatch[] } | null>(null);

  const allMismatches = useMemo(() => findOblastMismatches(rows), [rows]);

  const grouped = useMemo(() => {
    const byOblast = new Map<string, Map<string, Map<string, Map<string, DisplayRow[]>>>>();
    for (const row of rows) {
      const oblast = row.oblast || 'Без области';
      const group = row.group || 'Без группы';
      const mp = row.mpName || 'Без МП';
      const doctype = row.type || 'Без типа';
      if (!byOblast.has(oblast)) byOblast.set(oblast, new Map());
      const byGroup = byOblast.get(oblast)!;
      if (!byGroup.has(group)) byGroup.set(group, new Map());
      const byMp = byGroup.get(group)!;
      if (!byMp.has(mp)) byMp.set(mp, new Map());
      const byDoctype = byMp.get(mp)!;
      if (!byDoctype.has(doctype)) byDoctype.set(doctype, []);
      byDoctype.get(doctype)!.push(row);
    }

    const statsOf = (rowsArr: DisplayRow[]) => {
      const approvedCount = rowsArr.filter(isApprovedRow).length;
      const approvedSum = rowsArr.reduce((s, r) => s + (isApprovedRow(r) ? Number(r.approvedAmount) || 0 : 0), 0);
      return { total: rowsArr.length, approvedCount, approvedSum };
    };

    return Array.from(byOblast.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'ru'))
      .map(([oblast, byGroup]) => {
        const oblastRows = Array.from(byGroup.values()).flatMap((byMp) => Array.from(byMp.values()).flatMap((byDoctype) => Array.from(byDoctype.values()).flat()));
        return {
          oblast,
          ...statsOf(oblastRows),
          groups: Array.from(byGroup.entries())
            .sort((a, b) => a[0].localeCompare(b[0], 'ru'))
            .map(([group, byMp]) => {
              const groupRows = Array.from(byMp.values()).flatMap((byDoctype) => Array.from(byDoctype.values()).flat());
              return {
                group,
                ...statsOf(groupRows),
                mps: Array.from(byMp.entries())
                  .sort((a, b) => a[0].localeCompare(b[0], 'ru'))
                  .map(([mp, byDoctype]) => {
                    const allMpRows = Array.from(byDoctype.values()).flat();
                    return {
                      mp,
                      ...statsOf(allMpRows),
                      doctypes: Array.from(byDoctype.entries())
                        .sort((a, b) => a[0].localeCompare(b[0], 'ru'))
                        .map(([doctype, r]) => ({ doctype, rows: r }))
                    };
                  })
              };
            })
        };
      });
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <>
    <div className="divide-y-2 divide-slate-200">
      {grouped.map(({ oblast, total, approvedCount, approvedSum, groups }) => {
        const isOblastOpen = openOblast === oblast;
        const oblastMismatches = allMismatches.filter((m) => m.actualOblast === oblast);
        return (
          <div key={oblast} className="bg-white">
            <button
              type="button"
              onClick={() => {
                setOpenOblast(isOblastOpen ? null : oblast);
                setOpenGroup(null);
                setOpenMp(null);
                setOpenDoctype(null);
              }}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 text-left gap-2"
            >
              <span className="text-sm font-bold text-slate-800 truncate">{oblast}</span>
              <div className="flex items-center gap-2 shrink-0">
                {oblastMismatches.length > 0 && (
                  <MismatchIcon
                    count={oblastMismatches.length}
                    onClick={() => setMismatchModal({ title: oblast, items: oblastMismatches })}
                  />
                )}
                <StatBadge approvedCount={approvedCount} total={total} approvedSum={approvedSum} />
                {isOblastOpen ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
              </div>
            </button>
            {isOblastOpen && (
              <div className="pb-2 pl-3 bg-slate-50/60 divide-y divide-slate-200">
                {groups.map(({ group, total: groupTotal, approvedCount: groupApproved, approvedSum: groupSum, mps }) => {
                  const groupKey = `${oblast}||${group}`;
                  const isGroupOpen = openGroup === groupKey;
                  const groupMismatches = oblastMismatches.filter((m) => m.group === group);
                  return (
                    <div key={groupKey} className="border-l-4 border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenGroup(isGroupOpen ? null : groupKey);
                          setOpenMp(null);
                          setOpenDoctype(null);
                        }}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white text-left gap-2"
                      >
                        <span className="text-sm font-semibold text-slate-700 truncate">{group}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {groupMismatches.length > 0 && (
                            <MismatchIcon
                              count={groupMismatches.length}
                              onClick={() => setMismatchModal({ title: `${oblast} · ${group}`, items: groupMismatches })}
                            />
                          )}
                          <StatBadge approvedCount={groupApproved} total={groupTotal} approvedSum={groupSum} />
                          {isGroupOpen ? (
                            <ChevronDown size={16} className="text-slate-400" />
                          ) : (
                            <ChevronRight size={16} className="text-slate-400" />
                          )}
                        </div>
                      </button>
                      {isGroupOpen && (
                        <div className="pb-1 pl-3 bg-white divide-y divide-slate-100">
                          {mps.map(({ mp, total: mpTotal, approvedCount, approvedSum, doctypes }) => {
                            const mpKey = `${groupKey}||${mp}`;
                            const isMpOpen = openMp === mpKey;
                            const mpMismatches = groupMismatches.filter((m) => m.mp === mp);
                            return (
                              <div key={mpKey} className="border-l-4 border-slate-100">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMp(isMpOpen ? null : mpKey);
                                    setOpenDoctype(null);
                                  }}
                                  className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 text-left gap-2"
                                >
                                  <span className="text-sm font-medium text-slate-600 truncate">{mp}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {mpMismatches.length > 0 && (
                                      <MismatchIcon
                                        count={mpMismatches.length}
                                        onClick={() => setMismatchModal({ title: mp, items: mpMismatches })}
                                      />
                                    )}
                                    <StatBadge approvedCount={approvedCount} total={mpTotal} approvedSum={approvedSum} size="sm" />
                                    {isMpOpen ? (
                                      <ChevronDown size={16} className="text-slate-400" />
                                    ) : (
                                      <ChevronRight size={16} className="text-slate-400" />
                                    )}
                                  </div>
                                </button>
                                {isMpOpen && (
                                  <div className="pb-1 pl-3 bg-slate-50/40">
                                    {doctypes.map(({ doctype, rows: leafRows }) => {
                                      const doctypeKey = `${mpKey}||${doctype}`;
                                      const isDoctypeOpen = openDoctype === doctypeKey;
                                      return (
                                        <div key={doctypeKey} className="border-l-2 border-slate-100">
                                          <button
                                            type="button"
                                            onClick={() => setOpenDoctype(isDoctypeOpen ? null : doctypeKey)}
                                            className="w-full flex items-center justify-between px-4 py-2 hover:bg-slate-50 text-left"
                                          >
                                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                                              {doctype} <span className="text-slate-400 font-normal normal-case">({leafRows.length})</span>
                                            </span>
                                            {isDoctypeOpen ? (
                                              <ChevronDown size={14} className="text-slate-400" />
                                            ) : (
                                              <ChevronRight size={14} className="text-slate-400" />
                                            )}
                                          </button>
                                          {isDoctypeOpen && (
                                            <div className="px-4 pb-3 overflow-x-auto">
                                              <table className="w-full text-left border-collapse min-w-[1900px]">
                                                <thead>
                                                  <tr className="bg-slate-50 border-b border-slate-200">
                                                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Дата</th>
                                                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Месяц</th>
                                                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Тип документа</th>
                                                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Группа</th>
                                                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">МП</th>
                                                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Клиент</th>
                                                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Артикул</th>
                                                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Область</th>
                                                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Регион</th>
                                                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Тип Об.</th>
                                                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">НазваниеЛПУ</th>
                                                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Аб</th>
                                                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Ориентир</th>
                                                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Специальность</th>
                                                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Должность</th>
                                                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Сумма Выдачи</th>
                                                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Утв Сумма</th>
                                                    <th className="px-2 py-2 text-xs font-bold text-slate-500 uppercase">Факт. сумма</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {leafRows.map((r) => (
                                                    <tr key={r.key} className="border-b border-slate-100 hover:bg-slate-50/50">
                                                      <td className="px-2 py-2 text-sm text-slate-600 whitespace-nowrap">{r.date}</td>
                                                      <td className="px-2 py-2 text-sm text-slate-600 whitespace-nowrap">{r.month}</td>
                                                      <td className="px-2 py-2 text-sm text-slate-600">{r.type}</td>
                                                      <td className="px-2 py-2 text-sm text-slate-600">{r.group}</td>
                                                      <td className="px-2 py-2 text-sm text-slate-700 whitespace-nowrap">{r.mpName}</td>
                                                      <td className="px-2 py-2 text-sm text-slate-700">{r.client}</td>
                                                      <td className="px-2 py-2 text-sm text-slate-600">{r.articul}</td>
                                                      <td className="px-2 py-2 text-sm text-slate-600">{r.oblast}</td>
                                                      <td className="px-2 py-2 text-sm text-slate-600">{r.region}</td>
                                                      <td className="px-2 py-2 text-sm text-slate-600">{r.objectType}</td>
                                                      <td className="px-2 py-2 text-sm text-slate-600">{r.lpu}</td>
                                                      <td className="px-2 py-2 text-sm text-slate-600">{r.ab}</td>
                                                      <td className="px-2 py-2 text-sm text-slate-600">{r.orientir}</td>
                                                      <td className="px-2 py-2 text-sm text-slate-600">{r.spec}</td>
                                                      <td className="px-2 py-2 text-sm text-slate-600">{r.dolzhnost}</td>
                                                      <td className="px-2 py-2 text-sm text-slate-600">{r.amountIssued}</td>
                                                      <td className="px-2 py-2 text-sm text-slate-600">{r.approvedAmount}</td>
                                                      <td className="px-2 py-2 text-sm text-slate-600">{r.actualAmount}</td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
    {mismatchModal && (
      <MismatchModal title={mismatchModal.title} mismatches={mismatchModal.items} onClose={() => setMismatchModal(null)} />
    )}
    </>
  );
};

export const BelindaUvkPanel: React.FC = () => {
  const [scan, setScan] = useState<BelindaUvkScanResult | null>(null);
  const [scanUpdatedAt, setScanUpdatedAt] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<BelindaPreviewRow[]>([]);
  const [previewIssues, setPreviewIssues] = useState<{ id?: string; message: string }[]>([]);

  const [committing, setCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState<{ pct: number; status: string } | null>(null);
  const [commitSuccessCount, setCommitSuccessCount] = useState<number | null>(null);
  const [commitWarning, setCommitWarning] = useState<string | null>(null);
  const [commitError, setCommitError] = useState<string | null>(null);

  const applyScan = useCallback((s: BelindaUvkScanResult) => {
    setScan(s);
  }, []);

  /** Мгновенная загрузка из кэша в БД — без похода в 1С. */
  const loadCachedScan = useCallback(async () => {
    const cached = await fetchCachedBelindaUvkScan();
    if (cached) {
      applyScan(cached.scan);
      setScanUpdatedAt(cached.updatedAt);
    }
  }, [applyScan]);

  /** Настоящий поход в 1С (медленно) — обновляет и кэш. Дёргается по кнопке. */
  const refreshScanFromSource = useCallback(async () => {
    setScanLoading(true);
    setScanError(null);
    try {
      const res = await scanBelindaUvk();
      if (!res.success) {
        setScanError(res.error || 'Не удалось получить список фильтров из 1С');
        return;
      }
      if (res.scan) {
        applyScan(res.scan);
        setScanUpdatedAt(new Date().toISOString());
      }
    } finally {
      setScanLoading(false);
    }
  }, [applyScan]);

  useEffect(() => {
    loadCachedScan();
  }, [loadCachedScan]);

  const hasAnyFilter = !!dateFrom || !!dateTo;

  const handlePreview = async () => {
    if (!hasAnyFilter) {
      setPreviewError(
        'Укажите диапазон дат документа (от/до) — иначе запрос попытается забрать всю историю и не уложится в лимит выполнения серверной функции (150 сек).'
      );
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    setCommitSuccessCount(null);
    setCommitWarning(null);
    setCommitError(null);
    try {
      const filters: BelindaUvkFilters = {
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      };
      const res = await previewBelindaUvk(filters);
      if (!res.success) {
        setPreviewError(res.error || 'Не удалось получить предпросмотр');
        setPreviewRows([]);
        setPreviewIssues([]);
        return;
      }
      setPreviewRows(res.rows || []);
      setPreviewIssues(res.errors || []);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCommit = async () => {
    if (previewRows.length === 0) return;
    if (
      !window.confirm(
        `Отправить ${previewRows.length} строк в ОСНОВНУЮ базу (monthly_clients)? Это то, что сразу увидят МП в своём личном кабинете. Существующие чеки сохранятся.`
      )
    )
      return;
    setCommitting(true);
    setCommitError(null);
    setCommitWarning(null);
    setCommitSuccessCount(null);
    setCommitProgress(null);
    try {
      const payload: MonthlyClientPayload[] = previewRows.map(previewRowToMonthlyClientPayload);
      const res = await upsertMonthlyClientsPreservingChecks(payload, (pct, status) => {
        setCommitProgress({ pct, status });
      });
      if (!res.success) {
        setCommitError(res.error || 'Не удалось отправить строки');
        return;
      }
      if (res.warning) setCommitWarning(res.warning);
      setCommitSuccessCount(payload.length);
      setPreviewRows([]);
      setPreviewIssues([]);
    } finally {
      setCommitting(false);
      setCommitProgress(null);
    }
  };

  const previewDisplayRows = useMemo(() => previewRows.map(previewRowToDisplay), [previewRows]);

  return (
    <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
        <div>
          <h3 className="font-bold text-slate-800">Загрузка УВК из Belinda 1С в базу</h3>
          <p className="text-xs text-slate-500 mt-1">
            Сначала «Показать» — данные тянутся из 1С и отображаются только у вас в браузере, ничего не сохраняется.
            Проверьте и нажмите «Отправить в базу» — строки попадут напрямую в основную базу (monthly_clients),
            той же логикой, что и загрузка Excel: по ключу месяц+МП+клиент, без потери уже отправленных чеков.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ListFilter size={14} />
            {scan
              ? `Всего документов в 1С: ${scan.total}${scanUpdatedAt ? ` · обновлено ${new Date(scanUpdatedAt).toLocaleString('ru-RU')}` : ''}`
              : 'Список фильтров ещё не загружался'}
            {scanLoading && ' · обновление из 1С...'}
          </div>
          <button
            type="button"
            onClick={refreshScanFromSource}
            disabled={scanLoading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-brand disabled:opacity-50"
            title="Обновить список месяцев из 1С (медленно)"
          >
            <RefreshCw size={14} className={scanLoading ? 'animate-spin' : ''} />
            Обновить из 1С
          </button>
        </div>

        {scanError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex gap-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>{scanError}</span>
          </div>
        )}

        <div className="border border-slate-200 rounded-xl p-3 bg-white grid grid-cols-2 gap-2">
          <label className="flex flex-col text-xs font-semibold text-slate-500 gap-1">
            Дата документа от
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-2.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </label>
          <label className="flex flex-col text-xs font-semibold text-slate-500 gap-1">
            до
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-2.5 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={handlePreview}
          disabled={previewLoading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
        >
          {previewLoading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          {previewLoading ? 'Загрузка...' : 'Показать'}
        </button>

        {previewError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex gap-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>{previewError}</span>
          </div>
        )}

        {previewRows.length > 0 && (
          <>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm flex items-center justify-between">
              <span className="text-slate-700">
                Найдено строк: <strong>{previewRows.length}</strong>
                {previewIssues.length > 0 && (
                  <span className="text-red-600"> · пропущено с ошибкой: {previewIssues.length}</span>
                )}
              </span>
              <button
                type="button"
                onClick={handleCommit}
                disabled={committing}
                className="flex items-center gap-2 px-3 py-2 bg-brand text-white rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {committing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {committing ? 'Отправка...' : 'Отправить в базу'}
              </button>
            </div>
            {previewIssues.length > 0 && (
              <div className="space-y-1">
                {previewIssues.slice(0, 10).map((e, i) => (
                  <p key={i} className="text-xs text-red-600">
                    {e.id ? `[${e.id}] ` : ''}{e.message}
                  </p>
                ))}
                {previewIssues.length > 10 && (
                  <p className="text-xs text-slate-400">...и ещё {previewIssues.length - 10} ошибок</p>
                )}
              </div>
            )}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <GroupedRowsAccordion rows={previewDisplayRows} emptyText="Нет данных" />
            </div>
          </>
        )}

        {committing && commitProgress && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>{commitProgress.status}</span>
              <span>{Math.round(commitProgress.pct)}%</span>
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-brand transition-all" style={{ width: `${commitProgress.pct}%` }} />
            </div>
          </div>
        )}

        {commitError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex gap-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>{commitError}</span>
          </div>
        )}

        {commitWarning && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-800 text-sm flex gap-2">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <span>{commitWarning}</span>
          </div>
        )}

        {commitSuccessCount != null && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm flex items-center gap-2 text-emerald-800">
            <CheckCircle2 size={18} />
            <span>
              Отправлено в базу: <strong>{commitSuccessCount}</strong> строк. Проверьте вкладку «База» или «Мониторинг».
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
