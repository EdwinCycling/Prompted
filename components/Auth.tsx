import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { ShieldCheck, Loader2, Mail, Lock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem('saved_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 50);
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Save email for next time
    localStorage.setItem('saved_email', email);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      toast.success('Succesvol ingelogd');
    } catch (error: any) {
      toast.error(error.message || 'Er is iets misgegaan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center relative" style={{ backgroundImage: 'url(/intro.png)' }}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative z-10 w-full max-w-sm bg-surface/90 backdrop-blur-sm border border-border p-6 rounded-2xl shadow-2xl flex flex-col items-center">
        
        {/* Visual Header */}
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <ShieldCheck className="w-6 h-6 text-primary" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-1">PromptEDwin</h1>
        <p className="text-sm text-muted mb-6 text-center">Log in om je prompts te beheren</p>

        {/* Auth Form */}
        <form onSubmit={handleAuth} className="w-full space-y-3">
          <div className="relative group">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-primary transition-colors" />
            <input
              type="email"
              placeholder="Email adres"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-zinc-950/50 border border-border rounded-lg py-2.5 pl-9 pr-3 text-sm text-white placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-primary transition-colors" />
            <input
              ref={passwordInputRef}
              type="password"
              placeholder="Wachtwoord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-zinc-950/50 border border-border rounded-lg py-2.5 pl-9 pr-3 text-sm text-white placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-hover text-white font-medium py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-4 shadow-lg shadow-primary/20 text-sm"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Inloggen
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
