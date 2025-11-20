
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { Mail, Lock, ArrowRight, Loader2, ShieldCheck } from 'lucide-react';

export const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!supabase) {
        setError("Erro de configuração: Supabase não detectado.");
        setLoading(false);
        return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      setError('Credenciais inválidas ou usuário não cadastrado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans text-slate-800">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 via-white to-purple-100 animate-fade-in"></div>
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-indigo-300/30 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-300/30 rounded-full blur-[100px] animate-pulse" style={{animationDelay: '2s'}}></div>

      <div className="glass-panel w-full max-w-md p-8 md:p-10 rounded-[2.5rem] shadow-2xl relative z-10 border border-white/60 bg-white/40 backdrop-blur-2xl animate-scale-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-300">
            <ShieldCheck className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-blue-700">
            Lon Demandas
          </h1>
          <p className="text-slate-500 mt-2 text-sm font-medium">
            Acesso Restrito à Equipe
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold flex items-center gap-2 animate-shake">
             <div className="w-1 h-1 rounded-full bg-rose-500"></div>
             {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">E-mail Profissional</label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors w-5 h-5" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full glass-input py-3.5 pl-12 pr-4 rounded-2xl font-medium focus:bg-white/80 transition-all"
                placeholder="nome@empresa.com"
                required 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Senha</label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors w-5 h-5" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full glass-input py-3.5 pl-12 pr-4 rounded-2xl font-medium focus:bg-white/80 transition-all"
                placeholder="••••••••"
                required 
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-200 transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-6"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : (
              <>Acessar Painel <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>
        
        <div className="mt-8 text-center">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold opacity-60">Ambiente Seguro & Criptografado</p>
        </div>
      </div>
    </div>
  );
};
