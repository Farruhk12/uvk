import React, { useState, useEffect, useMemo } from 'react';
import { User, Client } from '../types';
import { fetchClients } from '../services/api';
import { MONTH_NAMES, getMonthOptions } from '../constants';
import { isClientSentByStatus } from '../utils/status';
import { ClientCard } from './ClientCard';
import { Stats } from './Stats';
import { LogOut, Calendar, Loader2, ChevronDown, CheckCircle, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout }) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for collapsible "Sent" section
  const [isSentExpanded, setIsSentExpanded] = useState(false);
  
  // Local state for sent checks to update UI instantly within THIS session only
  const [localSentState, setLocalSentState] = useState<Record<string, boolean>>({});

  const monthOptions = useMemo(() => getMonthOptions(), []);

  const loadClients = async (month: string) => {
    if (!month) return;
    setLoading(true);
    setError(null);
    setClients([]);
    
    // Clear local session state on reload to ensure full sync with server
    setLocalSentState({}); 
    
    try {
      const data = await fetchClients(user.mpName, month);
      setClients(data);
    } catch (err: any) {
      console.error("Load error:", err);
      setError(err.message || 'Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedMonth(val);
    loadClients(val);
  };

  const handleRefresh = () => {
    if (selectedMonth) {
        loadClients(selectedMonth);
    }
  };

  const handleStatusUpdate = (clientName: string) => {
    const key = `sent_${user.mpName}_${selectedMonth}_${clientName}`;
    setLocalSentState(prev => ({ ...prev, [key]: true }));
  };

  const isClientSent = (client: Client) => {
    const key = `sent_${user.mpName}_${selectedMonth}_${client.client}`;
    return isClientSentByStatus(client.status) || !!localSentState[key];
  };

  const { total, sentCount, pendingClients, sentClients, rejectedClients } = useMemo(() => {
    const total = clients.length;
    let sentCount = 0;
    const pending: Client[] = [];
    const sent: Client[] = [];
    const rejected: Client[] = [];

    clients.forEach(c => {
      const key = `sent_${user.mpName}_${selectedMonth}_${c.client}`;
      const hasReSent = !!localSentState[key];

      if (c.checkStatus === 'rejected' && !hasReSent) {
        rejected.push(c);
      } else if (isClientSent(c)) {
        sentCount++;
        sent.push(c);
      } else {
        pending.push(c);
      }
    });

    return { total, sentCount: sentCount + rejected.length, pendingClients: pending, sentClients: sent, rejectedClients: rejected };
  }, [clients, localSentState, selectedMonth, user.mpName]);

  return (
    <div className="min-h-screen pb-24 bg-slate-50/50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-slate-200 px-6 py-4 flex justify-between items-center shadow-sm">
        <div>
          <p className="text-[10px] font-extrabold text-brand tracking-widest uppercase mb-0.5 opacity-90">Медицинский Представитель</p>
          <h1 className="text-lg font-bold text-slate-800 leading-none">{user.mpName}</h1>
        </div>
        <button 
          onClick={onLogout}
          className="p-2.5 text-slate-400 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50 active:bg-red-100"
          title="Выйти"
        >
          <LogOut size={20} />
        </button>
      </div>

      <div className="container mx-auto px-4 mt-6 max-w-lg">
        {/* Month Selector & Refresh */}
        <div className="flex gap-3 mb-6">
            <div className="relative flex-1 group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Calendar size={18} className="text-brand group-focus-within:scale-110 transition-transform" />
                </div>
                <select 
                    value={selectedMonth}
                    onChange={handleMonthChange}
                    className="block w-full pl-11 pr-10 py-4 bg-white border-2 border-transparent hover:border-slate-200 focus:border-brand/30 rounded-2xl text-slate-700 font-bold shadow-sm appearance-none focus:ring-4 focus:ring-brand/10 focus:outline-none transition-all cursor-pointer"
                    style={{ backgroundImage: 'none' }} 
                >
                    <option value="">Выберите месяц...</option>
                    {monthOptions.map(m => (
                    <option key={m} value={m}>{m}</option>
                    ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                </div>
            </div>
            
            <button 
                onClick={handleRefresh}
                disabled={loading || !selectedMonth}
                className="bg-white p-4 rounded-2xl shadow-sm border-2 border-transparent hover:border-slate-200 text-slate-400 hover:text-brand disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center"
            >
                <RefreshCw size={20} className={loading ? 'animate-spin text-brand' : ''} />
            </button>
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-28 bg-slate-200 rounded-3xl"></div>
            {[1, 2, 3].map(i => (
              <div key={i} className="h-36 bg-slate-200 rounded-3xl"></div>
            ))}
          </div>
        ) : error ? (
            <div className="bg-red-50 border border-red-100 rounded-3xl p-8 text-center animate-in zoom-in-95">
                <AlertCircle size={48} className="mx-auto text-red-400 mb-3" />
                <p className="text-red-800 font-bold text-lg mb-2">Ошибка загрузки</p>
                <p className="text-sm text-red-600 mb-6 max-w-[200px] mx-auto leading-relaxed">{error}</p>
                <button 
                  onClick={() => loadClients(selectedMonth)} 
                  className="px-8 py-3 bg-white text-red-600 border border-red-200 rounded-xl text-sm font-bold shadow-sm hover:bg-red-50 transition-colors"
                >
                    Попробовать снова
                </button>
            </div>
        ) : selectedMonth && clients.length > 0 ? (
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            <Stats 
              total={total} 
              sent={sentCount} 
              rejected={rejectedClients.length} 
              onRejectedClick={() => document.getElementById('problematic-checks')?.scrollIntoView({ behavior: 'smooth' })}
            />
            
            {/* --- PENDING CLIENTS --- */}
            {pendingClients.length > 0 ? (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4 px-2">
                    <div className="bg-brand/10 p-1.5 rounded-lg">
                        <AlertCircle size={16} className="text-brand" />
                    </div>
                    <h2 className="text-sm font-bold text-slate-600 uppercase tracking-wider">
                      Осталось сдать <span className="text-slate-400 ml-1">({pendingClients.length})</span>
                    </h2>
                </div>
                <div className="space-y-4">
                  {pendingClients.map((client, idx) => (
                    <ClientCard 
                      key={`${selectedMonth}-${client.client}-${idx}`} 
                      client={client} 
                      mpName={user.mpName}
                      onUpdateStatus={handleStatusUpdate}
                      hasLocalSent={false} 
                    />
                  ))}
                </div>
              </div>
            ) : (
               /* ALL DONE MESSAGE */
               <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-[2rem] p-8 text-center border border-green-100 mb-8 shadow-sm animate-in zoom-in-95 duration-500">
                  <div className="w-20 h-20 bg-white text-green-500 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-green-100">
                     <Sparkles size={36} />
                  </div>
                  <h3 className="text-2xl font-extrabold text-green-800 mb-2 tracking-tight">Отличная работа!</h3>
                  <p className="text-green-700/80 font-medium">Все чеки за {selectedMonth} успешно отправлены.</p>
               </div>
            )}

            {/* --- REJECTED CLIENTS --- */}
            {rejectedClients.length > 0 && (
              <div id="problematic-checks" className="mb-8 scroll-mt-4">
                <div className="flex items-center gap-2 mb-4 px-2">
                    <div className="bg-red-100 p-1.5 rounded-lg">
                        <AlertCircle size={16} className="text-red-600" />
                    </div>
                    <h2 className="text-sm font-bold text-red-700 uppercase tracking-wider">
                      Проблемные чеки <span className="text-red-400 ml-1">({rejectedClients.length})</span>
                    </h2>
                </div>
                <div className="space-y-4">
                  {rejectedClients.map((client, idx) => (
                    <div key={`${selectedMonth}-${client.client}-rejected-${idx}`} className="ring-2 ring-red-200 rounded-2xl">
                      <ClientCard
                        client={client}
                        mpName={user.mpName}
                        onUpdateStatus={handleStatusUpdate}
                        hasLocalSent={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- SENT CLIENTS (COLLAPSIBLE) --- */}
            {sentClients.length > 0 && (
              <div className="mb-12">
                <button
                  onClick={() => setIsSentExpanded(!isSentExpanded)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 active:scale-[0.98] group ${
                    isSentExpanded 
                    ? 'bg-green-50/80 border-green-200/60 mb-4' 
                    : 'bg-white border-slate-200 shadow-sm hover:border-green-200/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shadow-sm ${isSentExpanded ? 'bg-green-500 text-white' : 'bg-green-50 text-green-600'}`}>
                        <CheckCircle size={20} />
                    </div>
                    <div className="text-left">
                        <span className={`block font-bold text-sm transition-colors ${isSentExpanded ? 'text-green-800' : 'text-slate-700'}`}>
                            Отправленные чеки
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider group-hover:text-slate-500 transition-colors">
                            {sentClients.length} выполнено
                        </span>
                    </div>
                  </div>
                  <ChevronDown
                    size={20}
                    className={`text-slate-400 transition-transform duration-300 ${isSentExpanded ? 'rotate-180 text-green-600' : ''}`}
                  />
                </button>

                {isSentExpanded && (
                  <div className="space-y-4 animate-in slide-in-from-top-4 duration-300 fade-in">
                    {sentClients.map((client, idx) => (
                      <div key={`${selectedMonth}-${client.client}-sent-${idx}`} className="opacity-75 hover:opacity-100 transition-opacity">
                        <ClientCard
                            client={client}
                            mpName={user.mpName}
                            onUpdateStatus={handleStatusUpdate}
                            hasLocalSent={true}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : selectedMonth ? (
          <div className="text-center py-16 text-slate-400 animate-in fade-in">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar size={24} className="opacity-50" />
            </div>
            <p className="font-medium text-slate-500">Список пуст</p>
            <p className="text-xs mt-2 opacity-60 max-w-[200px] mx-auto">
                В этом месяце клиентов не найдено. Нажмите кнопку обновления, если это ошибка.
            </p>
          </div>
        ) : (
          <div className="text-center py-20 text-slate-400 animate-in fade-in">
             <div className="w-20 h-20 bg-white border-2 border-dashed border-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <Calendar size={32} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-600 mb-2">Начало работы</h3>
            <p className="text-sm opacity-70">Пожалуйста, выберите месяц<br/>для загрузки списка клиентов</p>
          </div>
        )}
      </div>
    </div>
  );
};