import React, { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { User } from './types';

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
      }
    }
  }
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [initLoading, setInitLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for session
    const savedUser = localStorage.getItem('mp_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('mp_user');
      }
    }
    
    // Initialize Telegram Web App (Safe check for old iOS)
    if (window.Telegram && window.Telegram.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      // Set header color to match our brand
      try {
        tg.setHeaderColor('#DF3B20');
        tg.setBackgroundColor('#f1f5f9');
      } catch (e) {
        // Old TG versions might not support color setting
      }
    }

    setInitLoading(false);
    
    // Hide HTML loader
    const loader = document.getElementById('app-loader');
    if (loader) loader.style.display = 'none';
  }, []);

  const handleLoginSuccess = (userData: User) => {
    setUser(userData);
    localStorage.setItem('mp_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('mp_user');
  };

  if (initLoading) {
    // React's internal loader (rarely seen due to app-loader)
    return <div className="min-h-screen"></div>;
  }

  // Routing Logic
  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (user.role === 'admin' || user.role === 'manager') {
    return <AdminDashboard user={user} onLogout={handleLogout} />;
  }

  // Default User Dashboard
  return <Dashboard user={user} onLogout={handleLogout} />;
}

export default App;