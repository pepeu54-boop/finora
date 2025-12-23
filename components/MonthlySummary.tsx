import React, { useMemo, useState, useEffect } from 'react';
import { Transaction } from '../types';
import { closuresService } from '../services/closures';
import { 
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, DollarSign, 
  Lock, Unlock, Download, AlertTriangle, Lightbulb, PieChart as PieIcon,
  ArrowDownLeft, ArrowUpRight
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';

interface MonthlySummaryProps {
  transactions: Transaction[];
}

const COLORS = ['#9A4DFF', '#00D084', '#00B7FF', '#FF4D4D', '#F59E0B', '#EC4899'];

export const MonthlySummary: React.FC<MonthlySummaryProps> = ({ transactions }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isClosed, setIsClosed] = useState(false);
  const [loadingClosure, setLoadingClosure] = useState(false);

  useEffect(() => {
    const checkClosure = async () => {
        setLoadingClosure(true);
        const closure = await closuresService.getClosure(selectedDate.getMonth(), selectedDate.getFullYear());
        setIsClosed(!!closure?.isClosed);
        setLoadingClosure(false);
    };
    checkClosure();
  }, [selectedDate]);

  const toggleClosure = async () => {
      try {
          const newState = !isClosed;
          await closuresService.toggleClosure(selectedDate.getMonth(), selectedDate.getFullYear(), newState);
          setIsClosed(newState);
      } catch (e) {
          alert("Erro ao alterar status do mês (Verifique se a tabela 'fechamentos' existe no banco).");
      }
  };

  const monthData = useMemo(() => {
    const month = selectedDate.getMonth();
    const year = selectedDate.getFullYear();
    
    // String do primeiro dia do mês selecionado (YYYY-MM-01) para comparar datas
    // Importante para garantir que pegamos tudo ANTES desse mês
    const startOfSelectedMonth = new Date(year, month, 1);
    const startOfSelectedMonthStr = startOfSelectedMonth.toISOString().split('T')[0];

    // Helper to get transaction month/year accurately from STRING to avoid timezone
    const isSameMonth = (dateStr: string, m: number, y: number) => {
        const parts = dateStr.split('-');
        if (parts.length < 3) return false;
        const tYear = parseInt(parts[0]);
        const tMonth = parseInt(parts[1]) - 1; 
        return tYear === y && tMonth === m;
    };

    // 1. Dados do Mês Atual (Operacional)
    const current = transactions.filter(t => isSameMonth(t.date, month, year));

    // 2. Cálculo do "Rollover" (Saldo Acumulado Anterior)
    // Filtra tudo que veio antes do dia 01 deste mês (excluindo faturas internas de cartão)
    const previousTransactions = transactions.filter(t => t.date < startOfSelectedMonthStr && !t.cardId);
    
    const prevIncomeTotal = previousTransactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const prevExpenseTotal = previousTransactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    
    const accumulatedHistory = prevIncomeTotal - prevExpenseTotal;
    
    // Agora o rollover pode ser positivo (Caixa Inicial) ou negativo (Dívida)
    const rollover = accumulatedHistory;

    // Previous Month Data for Comparison (Stats only)
    const prevDate = new Date(selectedDate);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevMonth = prevDate.getMonth();
    const prevYear = prevDate.getFullYear();
    const previous = transactions.filter(t => isSameMonth(t.date, prevMonth, prevYear));

    const sum = (list: Transaction[], type: 'income' | 'expense') => 
        list.filter(t => t.type === type).reduce((acc, t) => acc + t.amount, 0);

    const income = sum(current, 'income');
    const expense = sum(current, 'expense');
    
    const prevIncome = sum(previous, 'income');
    const prevExpense = sum(previous, 'expense');

    // Balanço Operacional (Só deste mês)
    const operationalBalance = income - expense;

    // Balanço Real (Considerando o acumulado anterior)
    const realBalance = operationalBalance + rollover;
    
    // Percent changes
    const getDelta = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return ((curr - prev) / prev) * 100;
    };
    
    const incomeDelta = getDelta(income, prevIncome);
    const expenseDelta = getDelta(expense, prevExpense);
    
    // Categories Breakdown
    const categories: Record<string, number> = {};
    current.filter(t => t.type === 'expense').forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });
    const categoryList = Object.entries(categories)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Insights
    const biggestSpender = categoryList[0];
    const savingsRate = income > 0 ? ((operationalBalance) / income) * 100 : 0;

    return { 
        current, income, expense, 
        operationalBalance, realBalance, rollover,
        incomeDelta, expenseDelta,
        categoryList, biggestSpender, savingsRate
    };
  }, [transactions, selectedDate]);

  const changeMonth = (delta: number) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setSelectedDate(newDate);
  };

  const handlePrint = () => {
      window.print();
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-6 pb-20">
      
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-[#151F32] p-4 rounded-2xl border border-slate-800 shadow-sm print:hidden">
        <div className="flex items-center gap-4">
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-800 rounded-lg"><ChevronLeft className="w-5 h-5 text-slate-400" /></button>
            <div className="text-center">
                <h2 className="text-xl font-bold text-white capitalize">
                {selectedDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </h2>
                {isClosed && <span className="text-xs text-[#FF4D4D] font-bold bg-red-900/20 px-2 py-0.5 rounded-full border border-red-900/50 flex items-center justify-center gap-1 mt-1"><Lock className="w-3 h-3" /> FECHADO</span>}
            </div>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-800 rounded-lg"><ChevronRight className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="flex items-center gap-3">
             <button 
                onClick={toggleClosure}
                disabled={loadingClosure}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
                    isClosed 
                    ? 'bg-[#1E293B] text-slate-300 hover:bg-slate-700 border border-slate-600' 
                    : 'bg-[#9A4DFF] text-white hover:bg-[#8339ea] shadow-lg shadow-purple-900/30'
                }`}
             >
                 {loadingClosure ? '...' : isClosed ? <><Unlock className="w-4 h-4" /> Reabrir Mês</> : <><Lock className="w-4 h-4" /> Fechar Mês</>}
             </button>
             <button 
                onClick={handlePrint}
                className="p-2 bg-[#0B111A] text-slate-400 hover:text-white border border-slate-700 rounded-xl hover:bg-slate-800"
                title="Imprimir / Salvar PDF"
             >
                 <Download className="w-5 h-5" />
             </button>
        </div>
      </div>

      {/* Rollover Alerts */}
      {monthData.rollover < 0 && (
          <div className="bg-red-900/10 border border-red-900/50 rounded-2xl p-4 flex items-start gap-4 animate-fade-in">
              <div className="bg-red-900/30 p-2 rounded-full">
                  <ArrowDownLeft className="w-6 h-6 text-[#FF4D4D]" />
              </div>
              <div>
                  <h3 className="text-[#FF4D4D] font-bold text-lg">Saldo Devedor Anterior</h3>
                  <p className="text-slate-300 text-sm">
                      Você iniciou este mês com um déficit acumulado de <strong className="text-white">R$ {Math.abs(monthData.rollover).toFixed(2)}</strong>. 
                      Este valor foi descontado do seu balanço final.
                  </p>
              </div>
          </div>
      )}

      {monthData.rollover > 0 && (
          <div className="bg-emerald-900/10 border border-emerald-900/30 rounded-2xl p-4 flex items-start gap-4 animate-fade-in">
              <div className="bg-emerald-900/30 p-2 rounded-full">
                  <ArrowUpRight className="w-6 h-6 text-[#00D084]" />
              </div>
              <div>
                  <h3 className="text-[#00D084] font-bold text-lg">Caixa Inicial</h3>
                  <p className="text-slate-300 text-sm">
                      Você iniciou este mês com um saldo positivo acumulado de <strong className="text-white">R$ {monthData.rollover.toFixed(2)}</strong>. 
                      Isso aumenta seu poder de compra neste mês.
                  </p>
              </div>
          </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3">
        <div className="bg-[#151F32] p-6 rounded-2xl border border-emerald-900/30 shadow-sm relative overflow-hidden print:border-slate-200">
           <div className="flex justify-between items-start">
               <div>
                    <div className="flex items-center gap-2 mb-2 text-[#00D084] font-medium"><TrendingUp className="w-4 h-4" /> Receitas (Mês)</div>
                    <p className="text-2xl font-bold text-slate-100">R$ {monthData.income.toFixed(2)}</p>
               </div>
               <div className={`text-xs font-bold px-2 py-1 rounded ${monthData.incomeDelta >= 0 ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                   {monthData.incomeDelta > 0 ? '+' : ''}{monthData.incomeDelta.toFixed(1)}%
               </div>
           </div>
        </div>
        <div className="bg-[#151F32] p-6 rounded-2xl border border-red-900/30 shadow-sm relative overflow-hidden print:border-slate-200">
           <div className="flex justify-between items-start">
               <div>
                    <div className="flex items-center gap-2 mb-2 text-[#FF4D4D] font-medium"><TrendingDown className="w-4 h-4" /> Despesas (Mês)</div>
                    <p className="text-2xl font-bold text-slate-100">R$ {monthData.expense.toFixed(2)}</p>
               </div>
               <div className={`text-xs font-bold px-2 py-1 rounded ${monthData.expenseDelta <= 0 ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'}`}>
                   {monthData.expenseDelta > 0 ? '+' : ''}{monthData.expenseDelta.toFixed(1)}%
               </div>
           </div>
        </div>
        
        {/* Balance Card */}
        <div className={`p-6 rounded-2xl shadow-lg relative overflow-hidden print:bg-none print:text-black print:border print:border-slate-300 ${monthData.realBalance >= 0 ? 'bg-gradient-to-br from-[#00D084] to-emerald-700 text-white' : 'bg-gradient-to-br from-[#FF4D4D] to-red-700 text-white'}`}>
           <div className="flex items-center gap-2 mb-2 font-medium opacity-90">
               <DollarSign className="w-4 h-4" /> 
               Balanço Final
           </div>
           
           <p className="text-2xl font-bold text-white">
               R$ {monthData.realBalance.toFixed(2)}
           </p>

           <div className="mt-2 pt-2 border-t border-white/20 text-xs space-y-1">
               <div className="flex justify-between text-white/80">
                   <span>Resultado Mês:</span>
                   <span>
                       {monthData.operationalBalance > 0 ? '+' : ''} {monthData.operationalBalance.toFixed(2)}
                   </span>
               </div>
               <div className="flex justify-between text-white/80">
                   <span>Saldo Anterior:</span>
                   <span>
                       {monthData.rollover > 0 ? '+' : ''}{monthData.rollover.toFixed(2)}
                   </span>
               </div>
           </div>
        </div>
      </div>

      {/* Insights & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Insights Column */}
          <div className="space-y-4">
              <div className="bg-[#151F32] p-6 rounded-2xl border border-slate-800 shadow-sm h-full print:border-slate-200">
                  <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-yellow-400" /> Insights do Mês
                  </h3>
                  
                  <div className="space-y-4">
                      {monthData.biggestSpender && (
                          <div className="p-4 bg-[#0B111A] rounded-xl border border-slate-700">
                              <p className="text-slate-400 text-xs mb-1">Maior vilão do orçamento</p>
                              <p className="text-white font-bold">{monthData.biggestSpender.name}</p>
                              <p className="text-[#FF4D4D] text-sm font-semibold">
                                  R$ {monthData.biggestSpender.value.toFixed(2)} 
                                  <span className="text-slate-500 font-normal ml-1">
                                      ({((monthData.biggestSpender.value / monthData.expense) * 100).toFixed(0)}% das despesas)
                                  </span>
                              </p>
                          </div>
                      )}

                      {monthData.savingsRate > 20 ? (
                           <div className="p-4 bg-emerald-900/10 rounded-xl border border-emerald-900/30">
                               <p className="text-emerald-400 font-bold text-sm mb-1">Ótima Poupança!</p>
                               <p className="text-slate-300 text-xs">
                                   Você economizou {monthData.savingsRate.toFixed(1)}% da sua renda este mês (operacional). Continue assim!
                               </p>
                           </div>
                      ) : monthData.operationalBalance < 0 ? (
                           <div className="p-4 bg-red-900/10 rounded-xl border border-red-900/30">
                               <p className="text-red-400 font-bold text-sm mb-1 flex items-center gap-1">
                                   <AlertTriangle className="w-3 h-3" /> Atenção Operacional
                               </p>
                               <p className="text-slate-300 text-xs">
                                   Você gastou mais do que recebeu NESTE MÊS (sem contar saldo anterior). Revise categorias para cortar custos.
                               </p>
                           </div>
                      ) : (
                          <div className="p-4 bg-blue-900/10 rounded-xl border border-blue-900/30">
                              <p className="text-blue-400 font-bold text-sm mb-1">Equilíbrio</p>
                              <p className="text-slate-300 text-xs">
                                  Você está no azul operacionalmente. Use o excedente para investimentos ou abater dívidas.
                              </p>
                          </div>
                      )}
                  </div>
              </div>
          </div>

          {/* Charts Column */}
          <div className="lg:col-span-2 bg-[#151F32] p-6 rounded-2xl border border-slate-800 shadow-sm print:border-slate-200">
             <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                 <PieIcon className="w-5 h-5 text-[#9A4DFF]" /> Distribuição de Gastos
             </h3>
             <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthData.categoryList.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                        <XAxis type="number" hide />
                        <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={100} 
                            tick={{fill: '#94a3b8', fontSize: 11}} 
                            axisLine={false}
                            tickLine={false}
                        />
                        <RechartsTooltip 
                            cursor={{fill: '#1E293B'}}
                            contentStyle={{backgroundColor: '#1E293B', borderRadius: '12px', border: '1px solid #334155', color: '#fff'}}
                            formatter={(value: number) => [`R$ ${value.toFixed(2)}`, '']}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {monthData.categoryList.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
             </div>
          </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-[#151F32] rounded-2xl border border-slate-800 shadow-sm overflow-hidden print:border-slate-200">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-white">Extrato do Mês</h3>
              <span className="text-xs text-slate-500">{monthData.current.length} lançamentos</span>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-400">
                  <thead className="text-xs uppercase bg-[#0B111A] text-slate-500">
                      <tr>
                          <th className="px-6 py-3">Data</th>
                          <th className="px-6 py-3">Descrição</th>
                          <th className="px-6 py-3">Categoria</th>
                          <th className="px-6 py-3 text-right">Valor</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                      {monthData.current.map((t) => {
                          // Display date fix
                          const [y, m, d] = t.date.split('-');
                          
                          return (
                              <tr key={t.id} className="hover:bg-[#1E293B]">
                                  <td className="px-6 py-3">{d}/{m}/{y}</td>
                                  <td className="px-6 py-3 text-white">{t.description}</td>
                                  <td className="px-6 py-3">
                                      <span className="bg-slate-800 px-2 py-1 rounded text-xs">{t.category}</span>
                                  </td>
                                  <td className={`px-6 py-3 text-right font-bold ${t.type === 'income' ? 'text-[#00D084]' : t.type === 'expense' ? 'text-[#FF4D4D]' : 'text-slate-200'}`}>
                                      {t.type === 'expense' ? '-' : '+'} R$ {t.amount.toFixed(2)}
                                  </td>
                              </tr>
                          );
                      })}
                      {monthData.current.length === 0 && (
                          <tr>
                              <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                  Nenhum lançamento neste mês.
                              </td>
                          </tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>

    </div>
  );
};