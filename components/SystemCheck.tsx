import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { lancamentosService } from '../services/lancamentos';
import { CheckCircle, XCircle, Play, Loader2 } from 'lucide-react';

export const SystemCheck: React.FC = () => {
  const [results, setResults] = useState<{name: string, status: 'pending'|'success'|'error', msg?: string}[]>([]);
  const [running, setRunning] = useState(false);

  const runTests = async () => {
    setRunning(true);
    const newResults: typeof results = [];
    const addResult = (name: string, status: 'success'|'error'|'pending', msg?: string) => {
      newResults.push({ name, status, msg });
      setResults([...newResults]);
    };

    try {
      // 1. Connection
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado. Faça login primeiro.");
      addResult("Autenticação (Session)", 'success');

      // 2. Insert Transaction
      addResult("Criar Lançamento (Teste)", 'pending');
      const mock = {
        description: "Teste Automatizado",
        amount: 10,
        type: 'expense' as const,
        category: 'Outros',
        date: new Date().toISOString().split('T')[0],
        isRecurring: false,
        account: 'Carteira',
        tags: [],
        nature: 'variable' as const
      };
      
      // Now returns an array
      const createdArray = await lancamentosService.create(mock);
      const created = createdArray?.[0];

      if (created && created.id) {
        // Update result in place
        newResults.pop(); 
        addResult("Criar Lançamento", 'success', `ID: ${created.id}`);
        
        // 3. Read
        const list = await lancamentosService.getAll();
        if (list.find(t => t.id === created.id)) {
            addResult("Ler Lançamentos", 'success');
        } else {
            addResult("Ler Lançamentos", 'error', "Item criado não encontrado");
        }

        // 4. Delete
        await lancamentosService.delete(created.id);
        addResult("Excluir Lançamento", 'success');

      } else {
        addResult("Criar Lançamento", 'error', "Falha ao criar");
      }

    } catch (e: any) {
      addResult("Erro Geral", 'error', e.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl max-w-md mx-auto mt-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">System Health Check</h3>
        <button 
          onClick={runTests} 
          disabled={running}
          className="bg-indigo-500 hover:bg-indigo-600 text-white p-2 rounded-lg disabled:opacity-50"
        >
          {running ? <Loader2 className="animate-spin w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>
      </div>
      
      <div className="space-y-2">
        {results.map((r, i) => (
          <div key={i} className="flex items-center justify-between p-2 bg-slate-800 rounded border border-slate-700">
            <span className="text-sm">{r.name}</span>
            <div className="flex items-center gap-2">
               {r.msg && <span className="text-xs text-slate-400">{r.msg}</span>}
               {r.status === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
               {r.status === 'error' && <XCircle className="w-4 h-4 text-rose-400" />}
               {r.status === 'pending' && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
            </div>
          </div>
        ))}
        {results.length === 0 && <p className="text-slate-500 text-sm text-center">Clique no play para testar a integração.</p>}
      </div>
    </div>
  );
};