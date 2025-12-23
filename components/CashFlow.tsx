import React, { useEffect, useState } from 'react';
import { DailyFlowView } from '../types';
import { lancamentosService } from '../services/lancamentos';
import { CalendarClock, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CashFlowProps {
  transactions: any[]; // Ignored, we fetch from View
}

export const CashFlow: React.FC<CashFlowProps> = () => {
  const [data, setData] = useState<DailyFlowView[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlow = async () => {
      setLoading(true);
      const res = await lancamentosService.getDailyFlow();
      setData(res);
      setLoading(false);
  };

  useEffect(() => {
      fetchFlow();
  }, []);

  if (loading) return <div className="text-center py-10 text-slate-500">Carregando fluxo diário direto do banco...</div>;

  return (
    <div className="space-y-6 animate-fade-in pb-20">
       
       <div className="flex justify-between items-center bg-[#151F32] p-6 rounded-2xl border border-slate-800 shadow-sm">
         <div>
           <h2 className="text-2xl font-bold text-white flex items-center gap-2">
             <CalendarClock className="w-6 h-6 text-[#9A4DFF]" /> Fluxo Diário
           </h2>
           <p className="text-slate-400 text-sm">Visão de planilha: Dia a dia, saldo acumulado real.</p>
         </div>
         <button onClick={fetchFlow} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white">
            <RefreshCw className="w-5 h-5" />
         </button>
       </div>

       {/* Chart Preview */}
       <div className="bg-[#151F32] p-6 rounded-2xl border border-slate-800 shadow-lg h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorBal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00D084" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00D084" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E293B" />
              <XAxis dataKey="data" hide />
              <YAxis hide />
              <Tooltip 
                contentStyle={{backgroundColor: '#1E293B', border: '1px solid #334155', color: '#fff'}}
                formatter={(val: number) => `R$ ${val.toFixed(2)}`}
              />
              <Area type="monotone" dataKey="saldo_acumulado" stroke="#00D084" fill="url(#colorBal)" />
            </AreaChart>
          </ResponsiveContainer>
       </div>

       {/* Spreadsheet Table */}
       <div className="bg-[#151F32] rounded-2xl border border-slate-800 overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
             <table className="w-full text-sm text-left">
                <thead className="bg-[#0B111A] text-slate-400 font-bold uppercase text-xs sticky top-0 z-10">
                   <tr>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4 text-emerald-500">Entradas</th>
                      <th className="px-6 py-4 text-rose-500">Saídas</th>
                      <th className="px-6 py-4">Saldo do Dia</th>
                      <th className="px-6 py-4 bg-[#0D1624] text-right">Saldo Acumulado</th>
                   </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                   {data.length === 0 ? (
                      <tr><td colSpan={5} className="p-8 text-center text-slate-500">Sem movimentações registradas.</td></tr>
                   ) : (
                      data.map((row, idx) => (
                         <tr key={idx} className="hover:bg-[#1E293B] transition-colors">
                            <td className="px-6 py-4 text-slate-300 font-medium">
                               {new Date(row.data).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', year: 'numeric'})}
                            </td>
                            <td className="px-6 py-4 text-emerald-400">
                               {row.total_entradas > 0 ? `+ ${row.total_entradas.toFixed(2)}` : '-'}
                            </td>
                            <td className="px-6 py-4 text-rose-400">
                               {row.total_saidas > 0 ? `- ${row.total_saidas.toFixed(2)}` : '-'}
                            </td>
                            <td className={`px-6 py-4 font-bold ${row.saldo_dia >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                               {row.saldo_dia.toFixed(2)}
                            </td>
                            <td className={`px-6 py-4 text-right font-bold bg-[#0D1624]/50 border-l border-slate-800 ${row.saldo_acumulado >= 0 ? 'text-[#00D084]' : 'text-rose-500'}`}>
                               {row.saldo_acumulado.toFixed(2)}
                            </td>
                         </tr>
                      ))
                   )}
                </tbody>
             </table>
          </div>
       </div>
    </div>
  );
};