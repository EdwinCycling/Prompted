import React, { useEffect, useState } from 'react';
import './index.css';
import { supabase, SUPABASE_CONFIGURED } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { Auth } from './components/Auth';
import { Feed } from './components/Feed';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { LogOut, Sun, Moon, Download } from 'lucide-react';
import { APP_VERSION } from './utils/version';

const queryClient = new QueryClient();

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const stored = localStorage.getItem('pv-theme');
      return stored === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [installer, setInstaller] = useState<any>(null);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setSession(null);
      setLoading(false);
      return;
    }

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (session) setSession(session);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to get session:', err);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstaller(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('pv-theme', theme);
    } catch {}
    const html = document.documentElement;
    if (theme === 'light') {
      html.classList.remove('dark');
      html.classList.add('light');
    } else {
      html.classList.remove('light');
      html.classList.add('dark');
    }
  }, [theme]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null); // Explicitly clear local session
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout failed', error);
      setSession(null);
    }
  };

  if (loading) {
    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    );
  }

  if (!session) {
    return (
      <>
        <Toaster position="top-center" theme="dark" />
        <Auth />
      </>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-text selection:bg-primary/30">
        <Toaster position="bottom-center" theme={theme}
        />
        
        {/* Header */}
        <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md border-b border-border">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-800 rounded-lg flex items-center justify-center">
                        <span className="font-bold text-white text-sm">PE</span>
                    </div>
                    <span className="font-bold text-lg tracking-tight">PromptEDwin</span>
                    <span className="text-xs text-muted">v {APP_VERSION}</span>
                </div>
                
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted hidden sm:block">
                    {session.user.email}
                  </span>
                  <button
                    onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                    className="p-2 text-muted hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    title="Toggle theme"
                  >
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                  </button>
                  {installer && (
                    <button
                      onClick={async () => { await installer.prompt(); setInstaller(null); }}
                      className="p-2 text-muted hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                      title="Install app"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  )}
                  <button 
                    onClick={handleLogout}
                    className="p-2 text-muted hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                    title="Logout"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
            </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4">
            <Feed userId={session.user.id} />
        </main>
      </div>
    </QueryClientProvider>
  );
};

export default App;
