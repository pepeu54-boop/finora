import React, { useState } from 'react';
import { authService } from '../services/auth';
import { Mail, Lock, Loader2, ArrowRight, AlertTriangle } from 'lucide-react';

export const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup' | 'recovery'>('login');
  const [message, setMessage] = useState<{ text: React.ReactNode; type: 'error' | 'success' | 'warning' } | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'signup') {
        const { data, error } = await authService.register(email, password);
        if (error) throw error;

        // Tenta logar imediatamente caso o Supabase esteja com "Confirm Email" desativado
        if (!data.session) {
           const { data: loginData } = await authService.login(email, password);
           if (loginData.session) return; // Sucesso (App vai redirecionar)
        } else {
            return; // Sucesso
        }

        // Se chegou aqui, exige confirmação
        setMessage({ 
          text: (
            <div className="space-y-2">
              <p className="font-bold">Cadastro realizado!</p>
              <p className="text-xs">O sistema exige confirmação de e-mail. Verifique sua caixa de entrada.</p>
              <div className="bg-black/20 p-2 rounded text-[10px] text-left opacity-80">
                <strong>Dica Dev:</strong> Se o e-mail não chegar, vá no painel do Supabase (Auth {'>'} Providers {'>'} Email) e desative "Confirm email".
              </div>
            </div>
          ), 
          type: 'warning' 
        });

      } else if (mode === 'login') {
        const { error } = await authService.login(email, password);
        if (error) {
             if (error.message.includes("Email not confirmed")) {
                 setMessage({ 
                    text: (
                        <div>
                            <p className="font-bold">E-mail não confirmado.</p>
                            <p className="text-xs mt-1">Verifique seu e-mail ou desative a confirmação no painel do Supabase.</p>
                        </div>
                    ), 
                    type: 'error' 
                 });
             } else {
                 throw error;
             }
        }
      } else if (mode === 'recovery') {
        const { error } = await authService.resetPasswordForEmail(email);
        if (error) throw error;
        setMessage({ text: "Link de recuperação enviado para o e-mail.", type: 'success' });
      }
    } catch (error: any) {
      setMessage({ text: error.message || "Ocorreu um erro.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0B111A] p-4">
      <div className="max-w-md w-full bg-[#151F32] rounded-3xl shadow-2xl p-8 border border-slate-800 animate-fade-in">
        <div className="text-center mb-8">
           <div className="w-12 h-12 bg-gradient-to-tr from-[#9A4DFF] to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-900/50 mx-auto mb-4">
              F
            </div>
            <h1 className="text-2xl font-bold text-white">
              {mode === 'login' && 'Bem-vindo de volta'}
              {mode === 'signup' && 'Crie sua conta'}
              {mode === 'recovery' && 'Recuperar Senha'}
            </h1>
            <p className="text-slate-400 mt-2">Finora: Seu controle financeiro.</p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input 
              type="email" 
              placeholder="Seu e-mail"
              className="w-full pl-12 pr-4 py-3 bg-[#0B111A] border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-[#9A4DFF] focus:border-transparent focus:outline-none transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          {mode !== 'recovery' && (
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                type="password" 
                placeholder="Sua senha"
                className="w-full pl-12 pr-4 py-3 bg-[#0B111A] border border-slate-700 rounded-xl text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-[#9A4DFF] focus:border-transparent focus:outline-none transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          )}

          {message && (
            <div className={`p-4 rounded-xl text-sm border flex items-start gap-3 ${
                message.type === 'error' ? 'bg-red-900/20 text-[#FF4D4D] border-red-900/50' : 
                message.type === 'warning' ? 'bg-amber-900/20 text-amber-200 border-amber-900/50' :
                'bg-emerald-900/20 text-[#00D084] border-emerald-900/50'
            }`}>
              {message.type === 'warning' && <AlertTriangle className="w-5 h-5 shrink-0" />}
              <div>{message.text}</div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#9A4DFF] hover:bg-[#8339ea] text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-purple-900/30 flex items-center justify-center gap-2 disabled:opacity-70 active:scale-95"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar e Entrar' : 'Enviar Link'
            )}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-2 text-center text-sm">
          {mode === 'login' && (
            <>
              <button onClick={() => setMode('signup')} className="text-[#00B7FF] font-medium hover:underline">
                Não tem conta? Cadastre-se
              </button>
              <button onClick={() => setMode('recovery')} className="text-slate-400 hover:text-slate-200">
                Esqueci minha senha
              </button>
            </>
          )}
          {mode === 'signup' && (
             <button onClick={() => setMode('login')} className="text-[#00B7FF] font-medium hover:underline">
               Já tem conta? Entrar
             </button>
          )}
          {mode === 'recovery' && (
             <button onClick={() => setMode('login')} className="text-slate-400 hover:text-slate-200">
               Voltar para o login
             </button>
          )}
        </div>
      </div>
    </div>
  );
};