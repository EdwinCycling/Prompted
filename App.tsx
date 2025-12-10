import React, { useEffect, useState } from 'react';
import './index.css';
import { supabase, SUPABASE_CONFIGURED } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { Auth } from './components/Auth';
import { Feed } from './components/Feed';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import { LogOut, Sun, Moon, Download, Settings, X } from 'lucide-react';
import { APP_VERSION } from './utils/version';
import { TagsManager } from './components/TagsManager';

const queryClient = new QueryClient();

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [isCookieOpen, setIsCookieOpen] = useState(false);
  const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isTeamOpen, setIsTeamOpen] = useState(false);
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
                    onClick={() => setIsTagsOpen(true)}
                    className="p-2 text-muted hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    title="Manage Tags"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
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
        <main className="max-w-7xl mx-auto px-4 pb-24">
            <Feed userId={session.user.id} />
        </main>
        {/* Footer */}
        <footer className="fixed bottom-0 left-0 right-0 border-t border-border bg-surface/80 backdrop-blur-md z-20">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4 text-sm text-muted">
            <button onClick={() => setIsCookieOpen(true)} className="px-3 py-1 rounded-lg border border-border hover:text-white hover:border-white/40">Cookies</button>
            <button onClick={() => setIsDisclaimerOpen(true)} className="px-3 py-1 rounded-lg border border-border hover:text-white hover:border-white/40">Disclaimer</button>
            <button onClick={() => setIsTermsOpen(true)} className="px-3 py-1 rounded-lg border border-border hover:text-white hover:border-white/40">T&C</button>
            <button onClick={() => setIsTeamOpen(true)} className="px-3 py-1 rounded-lg border border-border hover:text-white hover:border-white/40">Team</button>
          </div>
        </footer>

        {/* Cookie Modal */}
        {isCookieOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80" onClick={() => setIsCookieOpen(false)} />
            <div className="relative w-full max-w-2xl bg-surface rounded-2xl border border-border shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-white font-semibold">Cookie & Storage Disclaimer</h3>
                <button onClick={() => setIsCookieOpen(false)} className="p-2 text-muted hover:text-white hover:bg-white/10 rounded-lg"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4 text-sm text-muted space-y-3">
                <p>This app uses local storage to remember your preferences, such as view mode (list/pictures) and grid size. No third-party tracking cookies are used.</p>
                <p>Only essential client-side storage is performed to improve your experience. You can clear this data anytime from your browser settings.</p>
              </div>
              <div className="p-4 border-t border-border flex justify-end">
                <button onClick={() => setIsCookieOpen(false)} className="px-4 py-2 rounded-lg border border-border text-white hover:bg-white/10">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Disclaimer Modal */}
        {isDisclaimerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80" onClick={() => setIsDisclaimerOpen(false)} />
            <div className="relative w-full max-w-2xl bg-surface rounded-2xl border border-border shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-white font-semibold">Disclaimer</h3>
                <button onClick={() => setIsDisclaimerOpen(false)} className="p-2 text-muted hover:text-white hover:bg-white/10 rounded-lg"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4 text-sm text-muted space-y-3">
                <p>This application is provided "as is" without warranties of any kind. While we strive for reliability, availability and data accuracy are not guaranteed.</p>
                <p>You are responsible for the prompts and assets you store. Use appropriate tags and content responsibly.</p>
              </div>
              <div className="p-4 border-t border-border flex justify-end">
                <button onClick={() => setIsDisclaimerOpen(false)} className="px-4 py-2 rounded-lg border border-border text-white hover:bg-white/10">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Terms & Conditions Modal */}
        {isTermsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80" onClick={() => setIsTermsOpen(false)} />
            <div className="relative w-full max-w-2xl bg-surface rounded-2xl border border-border shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-white font-semibold">Terms & Conditions</h3>
                <button onClick={() => setIsTermsOpen(false)} className="p-2 text-muted hover:text-white hover:bg-white/10 rounded-lg"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4 text-sm text-muted space-y-3">
                <p>By using this application, you agree to store and manage content that adheres to applicable laws. Do not upload illegal or copyrighted materials without rights.</p>
                <p>We may update features and policies; continued use constitutes acceptance of changes. You can export or delete your data at any time.</p>
              </div>
              <div className="p-4 border-t border-border flex justify-end">
                <button onClick={() => setIsTermsOpen(false)} className="px-4 py-2 rounded-lg border border-border text-white hover:bg-white/10">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Team Modal */}
        {isTeamOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80" onClick={() => setIsTeamOpen(false)} />
            <div className="relative w-full max-w-2xl bg-surface rounded-2xl border border-border shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="text-white font-semibold">Team</h3>
                <button onClick={() => setIsTeamOpen(false)} className="p-2 text-muted hover:text-white hover:bg-white/10 rounded-lg"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4 text-sm text-muted space-y-3">
                <p>This app is written by Edwin. For more information, contact: <span className="text-white">edwin@editsolutions.nl</span>.</p>
                <p>It was built together with AI — a beautiful journey of ideas, iterations, and craftsmanship. From the first sketch to performance optimizations and secure data flows, each step embraced curiosity and precision.</p>
                <p>We continuously refine the experience, aiming for clarity first and a delightful workflow for creators. Thank you for being part of the story.</p>
              </div>
              <div className="p-4 border-t border-border flex justify-end">
                <button onClick={() => setIsTeamOpen(false)} className="px-4 py-2 rounded-lg border border-border text-white hover:bg-white/10">Close</button>
              </div>
            </div>
          </div>
        )}
        <TagsManager
          isOpen={isTagsOpen}
          onClose={() => setIsTagsOpen(false)}
          userId={session.user.id}
        />
      </div>
    </QueryClientProvider>
  );
};

export default App;
