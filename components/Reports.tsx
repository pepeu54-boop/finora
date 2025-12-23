import React, { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import { 
  Download, Printer, PieChart as PieIcon, FileText, ArrowRightLeft, CreditCard, CalendarRange, Mail 
} from 'lucide-react';
import { Transaction, Debt, Budget, CreditCard as CreditCardType, ACCOUNTS, INCOME_CATEGORIES, EXPENSE_CATEGORIES, SemiannualView } from '../types';
import { lancamentosService } from '../services/lancamentos';

interface ReportsProps {
  transactions: Transaction[];
  debts: Debt[];
  budgets: Budget[];
  cards: CreditCardType[];
}

const COLORS = ['#9A4DFF', '#00D084', '#00B7FF', '#FF4D4D', '#F59E0B', '#EC4899', '#3B82F6', '#6366F1'];

export const Reports: React.FC<ReportsProps> = ({ transactions, debts, budgets, cards }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'transactions' | 'comparative' | 'semiannual' | 'liabilities'>('general');
  const [semiannualData, setSemiannualData] = useState<SemiannualView[]>([]);
  
  // Filters
  const [dateRange, setDateRange] = useState({ 
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], 
    end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0] 
  });
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  // Comparative State
  const [periodA, setPeriodA] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [periodB, setPeriodB] = useState(new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7));

  useEffect(() => {
      if (activeTab === 'semiannual') {
          lancamentosService.getSemiannualFlow().then(setSemiannualData);
      }
  }, [activeTab]);

  // --- Derived Data ---

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const dateMatch = t.date >= dateRange.start && t.date <= dateRange.end;
      const accountMatch = filterAccount === 'all' || t.account === filterAccount;
      const categoryMatch = filterCategory === 'all' || t.category === filterCategory;
      return dateMatch && accountMatch && categoryMatch;
    }).sort((a,b) => b.date.localeCompare(a.date));
  }, [transactions, dateRange, filterAccount, filterCategory]);

  const generalStats = useMemo(() => {
    const income = filteredTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = filteredTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    
    // Category Breakdown
    const catMap: Record<string, number> = {};
    filteredTransactions.filter(t => t.type === 'expense').forEach(t => {
        catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    });
    const categoryData = Object.entries(catMap)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8);

    return { income, expense, balance: income - expense, categoryData };
  }, [filteredTransactions]);

  const comparisonData = useMemo(() => {
     const getMonthStats = (monthStr: string) => {
         const [y, m] = monthStr.split('-');
         const txs = transactions.filter(t => {
             const d = new Date(t.date);
             return d.getFullYear() === parseInt(y) && d.getMonth() === parseInt(m) - 1;
         });
         const inc = txs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
         const exp = txs.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
         return { inc, exp, bal: inc - exp };
     };

     const statsA = getMonthStats(periodA);
     const statsB = getMonthStats(periodB);

     return { statsA, statsB };
  }, [transactions, periodA, periodB]);

  // --- Actions ---

  const handleExport = () => {
      // Basic CSV export logic based on active tab
      let content = "";
      let filename = `relatorio_${activeTab}_${new Date().toISOString().slice(0,10)}.csv`;

      if (activeTab === 'transactions') {
          const headers = ['Data', 'Descrição', 'Categoria', 'Conta', 'Natureza', 'Tipo', 'Valor'];
          const rows = filteredTransactions.map(t => 
              [t.date, `"${t.description}"`, t.category, t.account, t.nature, t.type, t.amount.toFixed(2)].join(',')
          );
          content = [headers.join(','), ...rows].join('\n');
      } else if (activeTab === 'semiannual') {
          const headers = ['Ano', 'Semestre', 'Entradas', 'Saídas', 'Saldo'];
          const rows = semiannualData.map(s => 
              [s.ano, `${s.semestre}º Sem`, s.total_entradas, s.total_saidas, s.saldo_semestre].join(',')
          );
          content = [headers.join(','), ...rows].join('\n');
      } else {
          // General
          const headers = ['Categoria', 'Valor'];
          const rows = generalStats.categoryData.map(c => [c.name, c.value.toFixed(2)].join(','));
          content = headers.join(',') + '\n' + rows.join('\n');
      }

      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
  };

  const handlePrint = () => window.print();

  // --- Components ---

  const TabButton = ({ id, label, icon: Icon }: any) => (
      <button 
        onClick={() => setActiveTab(id)}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === id ? 'bg-[#9A4DFF] text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
      >
          <Icon className="w-4 h-4" /> {label}
      </button>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20 print:p-0 print:pb-0">
        
        {/* Controls Header (Hidden on Print) */}
        <div className="flex flex-col xl:flex-row justify-between gap-4 print:hidden">
            <div className="flex bg-[#151F32] p-1 rounded-2xl border border-slate-800 w-fit overflow-x-auto">
                <TabButton id="general" label="Visão Geral" icon={PieIcon} />
                <TabButton id="transactions" label="Transações" icon={FileText} />
                <TabButton id="comparative" label="Comparativo" icon={ArrowRightLeft} />
                <TabButton id="semiannual" label="Semestral" icon={CalendarRange} />
                <TabButton id="liabilities" label="Dívidas e Cartões" icon={CreditCard} />
            </div>

            <div className="flex gap-2">
                <button onClick={handlePrint} className="flex items-center gap-2 bg-[#1E293B] border border-slate-700 text-slate-300 hover:text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors">
                    <Printer className="w-4 h-4" /> PDF
                </button>
                <button onClick={handleExport} className="flex items-center gap-2 bg-[#00D084] text-[#0B111A] px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#00b371] shadow-lg shadow-emerald-900/20">
                    <Download className="w-4 h-4" /> Exportar CSV
                </button>
            </div>
        </div>

        {/* --- TABS CONTENT --- */}

        {activeTab === 'general' && (
            <div className="space-y-6">
                {/* Filters Bar */}
                <div className="bg-[#151F32] p-4 rounded-2xl border border-slate-800 flex flex-wrap gap-4 items-end print:hidden">
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Início</label>
                        <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="bg-[#0B111A] border border-slate-700 text-white p-2 rounded-lg text-sm" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Fim</label>
                        <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="bg-[#0B111A] border border-slate-700 text-white p-2 rounded-lg text-sm" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 block mb-1">Conta</label>
                        <select value={filterAccount} onChange={e => setFilterAccount(e.target.value)} className="bg-[#0B111A] border border-slate-700 text-white p-2 rounded-lg text-sm w-[150px]">
                            <option value="all">Todas</option>
                            {ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-[#151F32] p-6 rounded-2xl border border-slate-800 print:border-slate-300">
                        <p className="text-slate-400 text-sm">Receitas do Período</p>
                        <p className="text-2xl font-bold text-[#00D084]">R$ {generalStats.income.toFixed(2)}</p>
                    </div>
                    <div className="bg-[#151F32] p-6 rounded-2xl border border-slate-800 print:border-slate-300">
                        <p className="text-slate-400 text-sm">Despesas do Período</p>
                        <p className="text-2xl font-bold text-[#FF4D4D]">R$ {generalStats.expense.toFixed(2)}</p>
                    </div>
                    <div className="bg-[#151F32] p-6 rounded-2xl border border-slate-800 print:border-slate-300">
                        <p className="text-slate-400 text-sm">Balanço</p>
                        <p className={`text-2xl font-bold ${generalStats.balance >= 0 ? 'text-blue-400' : 'text-red-400'}`}>R$ {generalStats.balance.toFixed(2)}</p>
                    </div>
                </div>

                {/* Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-[#151F32] p-6 rounded-2xl border border-slate-800 print:border-slate-300 print:break-inside-avoid">
                        <h3 className="font-bold text-white mb-4">Gastos por Categoria</h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={generalStats.categoryData} layout="vertical" margin={{ left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{fill: '#94a3b8', fontSize: 11}} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{backgroundColor: '#1E293B', borderColor: '#334155', color: '#fff'}} formatter={(val: number) => `R$ ${val.toFixed(2)}`} />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                        {generalStats.categoryData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="bg-[#151F32] p-6 rounded-2xl border border-slate-800 print:border-slate-300 print:break-inside-avoid">
                        <h3 className="font-bold text-white mb-4">Distribuição</h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={generalStats.categoryData} dataKey="value" cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2}>
                                        {generalStats.categoryData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{backgroundColor: '#1E293B', borderColor: '#334155', color: '#fff'}} formatter={(val: number) => `R$ ${val.toFixed(2)}`} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'semiannual' && (
            <div className="space-y-6">
                <div className="bg-[#151F32] border border-slate-800 rounded-2xl overflow-hidden print:border-slate-300">
                    <table className="w-full text-sm text-left text-slate-400">
                        <thead className="text-xs uppercase bg-[#0B111A] text-slate-500">
                            <tr>
                                <th className="px-6 py-4">Período</th>
                                <th className="px-6 py-4 text-emerald-500">Total Entradas</th>
                                <th className="px-6 py-4 text-rose-500">Total Saídas</th>
                                <th className="px-6 py-4 text-right">Saldo do Semestre</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {semiannualData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-[#1E293B]">
                                    <td className="px-6 py-4 font-bold text-white">
                                        {row.ano} - {row.semestre}º Semestre
                                    </td>
                                    <td className="px-6 py-4 text-emerald-400">
                                        R$ {row.total_entradas.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4 text-rose-400">
                                        R$ {row.total_saidas.toFixed(2)}
                                    </td>
                                    <td className={`px-6 py-4 text-right font-bold ${row.saldo_semestre >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                                        R$ {row.saldo_semestre.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                            {semiannualData.length === 0 && (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Nenhum dado disponível.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'transactions' && (
            <div className="space-y-6">
                <div className="bg-[#151F32] border border-slate-800 rounded-2xl overflow-hidden print:border-slate-300">
                    <table className="w-full text-sm text-left text-slate-400">
                        <thead className="text-xs uppercase bg-[#0B111A] text-slate-500 print:bg-slate-100 print:text-black">
                            <tr>
                                <th className="px-6 py-3">Data</th>
                                <th className="px-6 py-3">Descrição</th>
                                <th className="px-6 py-3">Natureza</th>
                                <th className="px-6 py-3">Categoria</th>
                                <th className="px-6 py-3 text-right">Valor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 print:divide-slate-300">
                            {filteredTransactions.map(t => (
                                <tr key={t.id} className="hover:bg-[#1E293B] print:hover:bg-transparent">
                                    <td className="px-6 py-3">{new Date(t.date).toLocaleDateString()}</td>
                                    <td className="px-6 py-3 text-white print:text-black">{t.description}</td>
                                    <td className="px-6 py-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${t.nature === 'fixed' ? 'bg-indigo-900/30 text-indigo-400' : 'bg-slate-700/30 text-slate-400'}`}>
                                            {t.nature === 'fixed' ? 'Fixo' : 'Var'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3">{t.category}</td>
                                    <td className={`px-6 py-3 text-right font-bold ${t.type === 'income' ? 'text-[#00D084]' : 'text-[#FF4D4D]'}`}>
                                        {t.type === 'expense' ? '-' : '+'} R$ {t.amount.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                            {filteredTransactions.length === 0 && (
                                <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhum registro encontrado.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {activeTab === 'comparative' && (
            <div className="space-y-6">
                <div className="flex gap-4 items-center bg-[#151F32] p-4 rounded-2xl border border-slate-800 print:hidden">
                     <div>
                         <label className="text-xs text-slate-500 block mb-1">Período A</label>
                         <input type="month" value={periodA} onChange={e => setPeriodA(e.target.value)} className="bg-[#0B111A] border border-slate-700 text-white p-2 rounded-lg text-sm" />
                     </div>
                     <ArrowRightLeft className="text-slate-500 w-5 h-5 mt-4" />
                     <div>
                         <label className="text-xs text-slate-500 block mb-1">Período B</label>
                         <input type="month" value={periodB} onChange={e => setPeriodB(e.target.value)} className="bg-[#0B111A] border border-slate-700 text-white p-2 rounded-lg text-sm" />
                     </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Income Comp */}
                    <div className="bg-[#151F32] p-6 rounded-2xl border border-slate-800 print:border-slate-300">
                        <p className="text-slate-400 text-sm">Receitas</p>
                        <div className="flex justify-between items-end mt-2">
                            <div>
                                <span className="text-xs text-slate-500 block">{periodA}</span>
                                <span className="text-xl font-bold text-white">R$ {comparisonData.statsA.inc.toFixed(2)}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-xs text-slate-500 block">{periodB}</span>
                                <span className="text-xl font-bold text-white">R$ {comparisonData.statsB.inc.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Expense Comp */}
                    <div className="bg-[#151F32] p-6 rounded-2xl border border-slate-800 print:border-slate-300">
                        <p className="text-slate-400 text-sm">Despesas</p>
                        <div className="flex justify-between items-end mt-2">
                            <div>
                                <span className="text-xs text-slate-500 block">{periodA}</span>
                                <span className="text-xl font-bold text-white">R$ {comparisonData.statsA.exp.toFixed(2)}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-xs text-slate-500 block">{periodB}</span>
                                <span className="text-xl font-bold text-white">R$ {comparisonData.statsB.exp.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Balance Comp */}
                    <div className="bg-[#151F32] p-6 rounded-2xl border border-slate-800 print:border-slate-300">
                        <p className="text-slate-400 text-sm">Saldo Final</p>
                        <div className="flex justify-between items-end mt-2">
                            <div>
                                <span className="text-xs text-slate-500 block">{periodA}</span>
                                <span className={`text-xl font-bold ${comparisonData.statsA.bal >= 0 ? 'text-blue-400' : 'text-red-400'}`}>R$ {comparisonData.statsA.bal.toFixed(2)}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-xs text-slate-500 block">{periodB}</span>
                                <span className={`text-xl font-bold ${comparisonData.statsB.bal >= 0 ? 'text-blue-400' : 'text-red-400'}`}>R$ {comparisonData.statsB.bal.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'liabilities' && (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-[#151F32] p-6 rounded-2xl border border-slate-800 print:border-slate-300">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-red-400" /> Panorama de Dívidas</h3>
                        <div className="space-y-4">
                            {debts.map(d => (
                                <div key={d.id} className="flex justify-between items-center border-b border-slate-800 pb-2 last:border-0">
                                    <div>
                                        <p className="text-white font-medium">{d.name}</p>
                                        <p className="text-xs text-slate-500">Taxa: {d.interestRate}% am</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[#FF4D4D] font-bold">R$ {d.currentAmount.toFixed(2)}</p>
                                        <p className="text-xs text-slate-500">Original: R$ {d.totalAmount.toFixed(2)}</p>
                                    </div>
                                </div>
                            ))}
                            {debts.length === 0 && <p className="text-slate-500 text-sm">Sem dívidas registradas.</p>}
                        </div>
                    </div>
                    <div className="bg-[#151F32] p-6 rounded-2xl border border-slate-800 print:border-slate-300">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2"><CreditCard className="w-5 h-5 text-orange-400" /> Limites de Cartão</h3>
                        <div className="space-y-4">
                            {cards.map(c => (
                                <div key={c.id} className="flex justify-between items-center border-b border-slate-800 pb-2 last:border-0">
                                    <div>
                                        <p className="text-white font-medium">{c.name}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-slate-300 font-bold">R$ {c.limit.toFixed(2)}</p>
                                    </div>
                                </div>
                            ))}
                            {cards.length === 0 && <p className="text-slate-500 text-sm">Sem cartões registrados.</p>}
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};