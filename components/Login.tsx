import React, { useState } from 'react';
import { loginUser } from '../services/api';
import { User } from '../types';
import { Loader2, KeyRound, User as UserIcon, LogIn, ShieldCheck } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [login, setLogin] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login || !pass) {
      setError('Заполните все поля');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await loginUser(login, pass);
      if (data.success) {
        onLoginSuccess(data);
      } else {
        setError(data.error || 'Неверный логин или пароль');
      }
    } catch (err) {
      setError('Ошибка сети. Проверьте интернет.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 bg-gradient-to-br from-brand-light via-white to-slate-100">
      <div className="w-full max-w-[360px] animate-in fade-in zoom-in duration-500 relative">
        
        {/* Decorative Background Elements */}
        <div className="absolute top-0 left-10 w-32 h-32 bg-brand/5 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl -z-10"></div>

        {/* Logo / Header */}
        <div className="text-center mb-10">
            <div className="w-20 h-20 bg-white rounded-3xl shadow-xl shadow-brand/10 flex items-center justify-center mx-auto mb-6 transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                <img 
                  src="https://belinda.tj/img/main-logo.svg" 
                  alt="Belinda Logo" 
                  className="h-10 w-auto object-contain"
                />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Система Чек-МП</h1>
            <p className="text-slate-400 text-sm mt-1">Авторизация сотрудника</p>
        </div>

        {/* Card */}
        <form onSubmit={handleSubmit} className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] shadow-2xl shadow-slate-200/50 border border-white space-y-5">
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Логин</label>
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <UserIcon size={18} className="text-slate-400 group-focus-within:text-brand transition-colors" />
                </div>
                <input
                    type="text"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-brand/20 rounded-2xl outline-none transition-all font-semibold text-slate-700 placeholder:text-slate-300 shadow-inner shadow-slate-200/50"
                    placeholder="Ваш логин"
                />
            </div>
          </div>
          
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Пароль</label>
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <KeyRound size={18} className="text-slate-400 group-focus-within:text-brand transition-colors" />
                </div>
                <input
                    type="password"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-brand/20 rounded-2xl outline-none transition-all font-semibold text-slate-700 placeholder:text-slate-300 shadow-inner shadow-slate-200/50"
                    placeholder="Ваш пароль"
                />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl text-center font-medium animate-in slide-in-from-top-2 flex items-center justify-center gap-2">
                <ShieldCheck size={16} />
                {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-2 bg-gradient-to-r from-brand to-brand-dark hover:shadow-lg hover:shadow-brand/30 active:scale-[0.98] text-white font-bold rounded-2xl transition-all flex justify-center items-center gap-2 group"
          >
            {loading ? (
                <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Проверка...</span>
                </>
            ) : (
                <>
                    <span>Войти</span>
                    <LogIn size={18} className="opacity-70 group-hover:translate-x-0.5 transition-transform" />
                </>
            )}
          </button>
        </form>
        
        <div className="mt-8 text-center">
            <p className="text-xs text-slate-300">
                Проблема с входом? Обратитесь к администратору.
            </p>
        </div>
      </div>
    </div>
  );
};