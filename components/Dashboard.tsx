import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, DollarSign, 
  Plus, Target, CreditCard, FileUp, Calendar, Wallet 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { Transaction, Budget, Goal, Debt } from '../types';

interface DashboardProps {
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  debts: Debt[];
  onNewTransaction: () => void;
  onNewGoal: () => void;
  onPayDebt: () => void;
  onImport: () => void;
}

const COLORS = ['#9A4DFF', '#00D084', '#00B7FF', '#FF4D4D', '#F59E0B', '#EC4899'];

export const Dashboard: React.FC<DashboardProps> = ({ 
  transactions, budgets, goals, debts, 
  onNewTransaction, onNewGoal, onPayDebt, onImport 
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  // --- Date Logic ---
  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate);
    // IMPORTANTE: Definir dia como 1 para evitar pular meses (ex: 31 Jan -> +1 mês -> 28 Fev ou 03 Mar)
    newDate.setDate(1); 
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Helper: Verifica se a data da transação (String YYYY-MM-DD) pertence ao mês/ano selecionado
  const isSameMonth = (dateStr: string, month: number, year: number) => {
      const parts = dateStr.split('-');
      if (parts.length < 3) return false;
      
      const tYear = parseInt(parts[0]);
      const tMonth = parseInt(parts[1]) - 1; 
      
      return tYear === year && tMonth === month;
  };

  // --- Calculations ---
  
  // 1. Balance Breakdown (Saldo acumulado seguindo regra de Fluxo Contínuo)
  const balanceDetails = useMemo(() => {
    // Datas de corte
    const startOfMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
    const endOfMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(lastDayOfMonth.getDate()).padStart(2, '0')}`;

    // Apenas transações de fluxo de caixa (sem cartão de crédito pendente)
    const validTransactions = transactions.filter(t => !t.cardId);

    // 1. Calcular Histórico (Tudo ANTES deste mês)
    const historyTxs = validTransactions.filter(t => t.date < startOfMonthStr);
    const histInc = historyTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const histExp = historyTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    
    // Regra: O saldo histórico (positivo ou negativo) é carregado integralmente.
    const rollover = histInc - histExp;

    // 2. Calcular Mês Atual
    const currentTxs = validTransactions.filter(t => t.date >= startOfMonthStr && t.date <= endOfMonthStr);
    const currentInc = currentTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const currentExp = currentTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

    // 3. Consolidar
    // Balanço Final = (Receitas Mês - Despesas Mês) + Rollover Anterior
    return { 
        totalIncome: currentInc, 
        totalExpense: currentExp,
        rollover: rollover,
        balance: (currentInc - currentExp) + rollover 
    };
  }, [transactions, currentMonth, currentYear]);

  // 2. MTD Data (Dados do Mês Selecionado - Apenas movimentação DO mês)
  const mtdData = useMemo(() => {
    const mtdTrans = transactions.filter(t => isSameMonth(t.date, currentMonth, currentYear));

    const income = mtdTrans.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = mtdTrans.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    
    const balance = income - expense; // Resultado econômico (inclui crédito)

    return { income, expense, balance };
  }, [transactions, currentMonth, currentYear]);

  // 3. Historical Balance (Last 30 Days Graph)
  const historyData = useMemo(() => {
    const data = [];
    const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const changes: Record<string, number> = {};
    sorted.forEach(t => {
       if (t.cardId) return;
       const key = t.date.split('T')[0]; 
       changes[key] = (changes[key] || 0) + (t.type === 'income' ? t.amount : -t.amount);
    });

    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const offset = d.getTimezoneOffset() * 60000;
      const localISODate = new Date(d.getTime() - offset).toISOString().split('T')[0];
      days.push(localISODate);
    }

    const startDateStr = days[0];
    let runningBalance = sorted
      .filter(t => t.date < startDateStr && !t.cardId)
      .reduce((acc, t) => acc + (t.type === 'income' ? t.amount : -t.amount), 0);

    days.forEach(day => {
      runningBalance += (changes[day] || 0);
      data.push({ date: day.split('-').slice(1).join('/'), balance: runningBalance });
    });

    return data;
  }, [transactions]);

  // 4. Top Categories (MTD)
  const topCategories = useMemo(() => {
    const mtdExpenses = transactions.filter(t => 
        t.type === 'expense' && isSameMonth(t.date, currentMonth, currentYear)
    );
    const grouped: Record<string, number> = {};
    mtdExpenses.forEach(t => {
      grouped[t.category] = (grouped[t.category] || 0) + t.amount;
    });
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
  }, [transactions, currentMonth, currentYear]);

  // 5. Upcoming Bills
  const upcomingBills = useMemo(() => {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    return transactions
      .filter(t => t.isRecurring && t.type === 'expense')
      .map(t => {
        const day = parseInt(t.date.split('-')[2]);
        const d = new Date(today.getFullYear(), today.getMonth(), day);
        if (d < today) d.setMonth(d.getMonth() + 1);
        return { ...t, nextDate: d };
      })
      .filter(t => t.nextDate <= nextWeek)
      .sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());
  }, [transactions]);


  // --- Render ---

  if (transactions.length === 0) {
    return (
       <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-6 animate-fade-in">
         <div className="w-24 h-24 bg-[#1E293B] rounded-full flex items-center justify-center mb-4 border border-slate-700">
            <DollarSign className="w-12 h-12 text-[#9A4DFF]" />
         </div>
         <h2 className="text-2xl font-bold text-white">Bem-vindo ao Finora!</h2>
         <p className="text-slate-400 max-w-md">
           Parece que você ainda não tem dados. Comece importando suas transações ou adicione um lançamento manualmente.
         </p>
         <div className="flex gap-4">
           <button onClick={onNewTransaction} className="bg-[#00D084] text-[#0B111A] px-6 py-3 rounded-xl font-bold hover:bg-[#00b371] transition-colors shadow-lg shadow-emerald-500/20">
             + Adicionar Lançamento
           </button>
           <button onClick={onImport} className="bg-[#1E293B] text-white border border-slate-700 px-6 py-3 rounded-xl font-bold hover:bg-slate-700 transition-colors">
             Importar CSV
           </button>
         </div>
       </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Visão Geral</h1>
          <p className="text-slate-400 text-sm">Acompanhe a saúde das suas finanças.</p>
        </div>
        
        {/* Date Selector */}
        <div className="flex items-center bg-[#151F32] rounded-xl border border-slate-800 p-1 shadow-sm">
          <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-4 py-1 text-center min-w-[140px]">
            <span className="text-sm font-semibold text-white block leading-none">
              {currentDate.toLocaleDateString('pt-BR', { month: 'long' })}
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {currentDate.getFullYear()}
            </span>
          </div>
          <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Global Balance */}
        <div className="bg-[#151F32] p-5 rounded-2xl border border-slate-800 shadow-lg relative overflow-hidden group hover:border-[#9A4DFF]/30 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign className="w-12 h-12 text-[#9A4DFF]" />
          </div>
          <p className="text-slate-400 text-sm font-medium mb-1 flex items-center gap-1">
             Saldo Final
             <span className="text-[10px] bg-slate-800 px-1 rounded text-slate-500 cursor-help" title="Saldo Total (Mês + Acumulado Anterior)">?</span>
          </p>
          <h3 className={`text-2xl font-bold mb-3 ${balanceDetails.balance >= 0 ? 'text-white' : 'text-[#FF4D4D]'}`}>
            {balanceDetails.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </h3>
          
          {/* Breakdown / Origem do Saldo */}
          <div className="text-xs space-y-1 border-t border-slate-700/50 pt-2">
            <div className="flex justify-between items-center text-slate-400">
               <span>Resultado Mês</span>
               <span className={mtdData.balance >= 0 ? 'text-[#00D084]' : 'text-[#FF4D4D]'}>
                 {mtdData.balance > 0 ? '+' : ''} {mtdData.balance.toLocaleString('pt-BR', { notation: "compact", maximumFractionDigits: 1 })}
               </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
               <span>Saldo Anterior</span>
               <span className={balanceDetails.rollover >= 0 ? 'text-[#00B7FF]' : 'text-[#FF4D4D]'}>
                  {balanceDetails.rollover > 0 ? '+' : ''} {balanceDetails.rollover.toLocaleString('pt-BR', { notation: "compact", maximumFractionDigits: 1 })}
               </span>
            </div>
          </div>
        </div>

        {/* MTD Income */}
        <div className="bg-[#151F32] p-5 rounded-2xl border border-slate-800 shadow-lg hover:border-[#00D084]/30 transition-colors">
          <div className="flex justify-between items-start mb-2">
             <div className="p-2 bg-emerald-900/20 rounded-lg">
               <TrendingUp className="w-5 h-5 text-[#00D084]" />
             </div>
             <span className="text-xs text-slate-500 bg-[#0B111A] px-2 py-1 rounded">Mensal</span>
          </div>
          <p className="text-slate-400 text-sm font-medium">Receitas</p>
          <h3 className="text-2xl font-bold text-[#00D084]">
            {mtdData.income.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </h3>
        </div>

        {/* MTD Expense */}
        <div className="bg-[#151F32] p-5 rounded-2xl border border-slate-800 shadow-lg hover:border-[#FF4D4D]/30 transition-colors">
          <div className="flex justify-between items-start mb-2">
             <div className="p-2 bg-red-900/20 rounded-lg">
               <TrendingDown className="w-5 h-5 text-[#FF4D4D]" />
             </div>
             <span className="text-xs text-slate-500 bg-[#0B111A] px-2 py-1 rounded">Mensal</span>
          </div>
          <p className="text-slate-400 text-sm font-medium">Despesas</p>
          <h3 className="text-2xl font-bold text-[#FF4D4D]">
            {mtdData.expense.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </h3>
        </div>

        {/* Monthly Balance (Result) */}
        <div className="bg-[#151F32] p-5 rounded-2xl border border-slate-800 shadow-lg hover:border-[#00B7FF]/30 transition-colors">
          <div className="flex justify-between items-start mb-2">
             <div className="p-2 bg-blue-900/20 rounded-lg">
               <Wallet className="w-5 h-5 text-[#00B7FF]" />
             </div>
             <span className="text-xs text-slate-500 bg-[#0B111A] px-2 py-1 rounded">Mensal</span>
          </div>
          <p className="text-slate-400 text-sm font-medium truncate">Balanço do Mês</p>
          <h3 className={`text-2xl font-bold ${mtdData.balance >= 0 ? 'text-[#00B7FF]' : 'text-[#FF4D4D]'}`}>
            {mtdData.balance > 0 ? '+' : ''}{mtdData.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </h3>
           <div className="mt-2 text-xs text-slate-400 border-t border-slate-700/50 pt-2">
             Receitas - Despesas
           </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Charts */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* History Chart */}
          <div className="bg-[#151F32] p-6 rounded-2xl border border-slate-800 shadow-lg">
            <h3 className="font-bold text-white mb-6">Histórico de Saldo (30 dias)</h3>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyData}>
                  <defs>
                    <linearGradient id="colorHistory" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#9A4DFF" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#9A4DFF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E293B" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} minTickGap={30} />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{backgroundColor: '#1E293B', borderRadius: '8px', border: '1px solid #334155', color: '#fff'}}
                    itemStyle={{color: '#fff'}}
                    formatter={(value: number) => [value.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'}), 'Saldo']}
                  />
                  <Area type="monotone" dataKey="balance" stroke="#9A4DFF" strokeWidth={3} fill="url(#colorHistory)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Categories */}
          <div className="bg-[#151F32] p-6 rounded-2xl border border-slate-800 shadow-lg">
             <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-white">Top Gastos do Mês</h3>
               <span className="text-xs text-slate-500 uppercase tracking-wider">Por Categoria</span>
             </div>
             
             {topCategories.length > 0 ? (
               <div className="space-y-4">
                 {topCategories.map((cat, idx) => (
                   <div key={cat.name} className="relative">
                     <div className="flex justify-between text-sm mb-1">
                       <span className="text-slate-300 font-medium flex items-center gap-2">
                         <span className={`w-2 h-2 rounded-full`} style={{backgroundColor: COLORS[idx]}}></span>
                         {cat.name}
                       </span>
                       <span className="text-slate-200 font-bold">R$ {cat.value.toFixed(2)}</span>
                     </div>
                     <div className="w-full bg-[#0B111A] h-2 rounded-full overflow-hidden">
                       <div 
                         className="h-full rounded-full" 
                         style={{ 
                           width: `${(cat.value / mtdData.expense) * 100}%`,
                           backgroundColor: COLORS[idx] 
                         }}
                       ></div>
                     </div>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="text-center py-8 text-slate-500">Sem gastos registrados neste mês.</div>
             )}
          </div>
        </div>

        {/* Right Col: Lists & Actions */}
        <div className="space-y-6">
          
          {/* Quick Actions */}
          <div className="bg-[#151F32] p-6 rounded-2xl border border-slate-800 shadow-lg">
            <h3 className="font-bold text-white mb-4">Ações Rápidas</h3>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={onNewTransaction} className="flex flex-col items-center justify-center p-4 bg-[#0B111A] hover:bg-[#1E293B] border border-slate-700 hover:border-[#00D084] rounded-xl transition-all group">
                <div className="bg-[#00D084]/10 p-2 rounded-full mb-2 group-hover:bg-[#00D084] transition-colors">
                  <Plus className="w-5 h-5 text-[#00D084] group-hover:text-[#0B111A]" />
                </div>
                <span className="text-xs font-medium text-slate-300">Lançamento</span>
              </button>
              
              <button onClick={onNewGoal} className="flex flex-col items-center justify-center p-4 bg-[#0B111A] hover:bg-[#1E293B] border border-slate-700 hover:border-[#9A4DFF] rounded-xl transition-all group">
                <div className="bg-[#9A4DFF]/10 p-2 rounded-full mb-2 group-hover:bg-[#9A4DFF] transition-colors">
                  <Target className="w-5 h-5 text-[#9A4DFF] group-hover:text-white" />
                </div>
                <span className="text-xs font-medium text-slate-300">Nova Meta</span>
              </button>

              <button onClick={onPayDebt} className="flex flex-col items-center justify-center p-4 bg-[#0B111A] hover:bg-[#1E293B] border border-slate-700 hover:border-[#FF4D4D] rounded-xl transition-all group">
                <div className="bg-[#FF4D4D]/10 p-2 rounded-full mb-2 group-hover:bg-[#FF4D4D] transition-colors">
                  <CreditCard className="w-5 h-5 text-[#FF4D4D] group-hover:text-white" />
                </div>
                <span className="text-xs font-medium text-slate-300">Pagar Dívida</span>
              </button>

              <button onClick={onImport} className="flex flex-col items-center justify-center p-4 bg-[#0B111A] hover:bg-[#1E293B] border border-slate-700 hover:border-[#00B7FF] rounded-xl transition-all group">
                <div className="bg-[#00B7FF]/10 p-2 rounded-full mb-2 group-hover:bg-[#00B7FF] transition-colors">
                  <FileUp className="w-5 h-5 text-[#00B7FF] group-hover:text-white" />
                </div>
                <span className="text-xs font-medium text-slate-300">Importar</span>
              </button>
            </div>
          </div>

          {/* Upcoming Bills */}
          <div className="bg-[#151F32] p-6 rounded-2xl border border-slate-800 shadow-lg flex-1">
             <div className="flex items-center gap-2 mb-4">
               <Calendar className="w-5 h-5 text-orange-400" />
               <h3 className="font-bold text-white">Próximos 7 Dias</h3>
             </div>
             
             {upcomingBills.length > 0 ? (
               <div className="space-y-3">
                 {upcomingBills.map(bill => (
                   <div key={bill.id} className="flex items-center justify-between p-3 bg-[#0B111A] rounded-xl border border-slate-700 border-l-4 border-l-orange-500">
                      <div>
                        <p className="font-semibold text-slate-200 text-sm">{bill.description}</p>
                        <p className="text-xs text-orange-400">
                          Vence dia {bill.nextDate.getDate()}/{bill.nextDate.getMonth()+1}
                        </p>
                      </div>
                      <span className="font-bold text-slate-200 text-sm">
                        R$ {bill.amount.toFixed(2)}
                      </span>
                   </div>
                 ))}
               </div>
             ) : (
               <div className="text-center py-6 text-slate-500 text-sm bg-[#0B111A] rounded-xl border border-dashed border-slate-800">
                 Nenhuma conta para os próximos dias.
               </div>
             )}
          </div>
        </div>

      </div>
    </div>
  );
};