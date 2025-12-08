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
      <div className="relative z-10 w-full max-w-md bg-surface/90 border border-border p-8 rounded-2xl shadow-2xl flex flex-col items-center overflow-hidden">
        
        {/* Visual Header */}
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-2">PromptEDwin</h1>
        <p className="text-muted mb-8 text-center">Log in om je prompts te beheren</p>

        {/* Auth Form */}
        <form onSubmit={handleAuth} className="w-full space-y-4">
          <div className="relative group">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted group-focus-within:text-primary transition-colors" />
            <input
              type="email"
              placeholder="Email adres"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-zinc-950 border border-border rounded-xl py-3 pl-10 pr-4 text-white placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          <div className="relative group">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted group-focus-within:text-primary transition-colors" />
            <input
              ref={passwordInputRef}
              type="password"
              placeholder="Wachtwoord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-zinc-950 border border-border rounded-xl py-3 pl-10 pr-4 text-white placeholder-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-6 shadow-lg shadow-primary/25"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Inloggen
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        
      </div>
    </div>
  );
};
