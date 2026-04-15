import React from 'react';

interface StatsProps {
  total: number;
  sent: number;
  rejected?: number;
  onRejectedClick?: () => void;
}

export const Stats: React.FC<StatsProps> = ({ total, sent, rejected = 0, onRejectedClick }) => {
  return (
    <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm border-l-4 border-brand animate-in slide-in-from-top-4 duration-500">
      <div className="flex justify-between items-center">
        <div className="text-center flex-1 border-r border-slate-100">
          <div className="text-xl font-bold text-slate-800">{total}</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Клиентов</div>
        </div>
        <div className="text-center flex-1 border-r border-slate-100">
          <div className="text-xl font-bold text-green-600">{sent}</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Сдано</div>
        </div>
        <div className="text-center flex-1">
          <div className="text-xl font-bold text-brand">{total - sent}</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Осталось</div>
        </div>
      </div>
      {rejected > 0 && (
        <button
          type="button"
          onClick={onRejectedClick}
          className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-center gap-2 bg-red-50 -mx-4 -mb-4 px-4 py-2.5 rounded-b-2xl w-full cursor-pointer hover:bg-red-100/80 active:bg-red-100 transition-colors text-left"
        >
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
          <span className="text-xs font-bold text-red-700">Проблемные чеки: {rejected}</span>
        </button>
      )}
    </div>
  );
};
