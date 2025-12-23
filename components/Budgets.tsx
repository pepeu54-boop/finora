import React, { useState, useMemo } from 'react';
import { Budget, Transaction, EXPENSE_CATEGORIES } from '../types';
import { orcamentosService } from '../services/orcamentos';
import { 
  Plus, Trash2, AlertTriangle, RefreshCcw, TrendingUp, CheckCircle, Info, 
  ChevronLeft, ChevronRight, PauseCircle, PlayCircle, Edit2, X, Search 
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface BudgetsProps {
  budgets: Budget[];
  setBudgets: React.Dispatch<React.SetStateAction<Budget[]>>;
  transactions: Transaction[];
  onAdd?: (budget: any) => void;
  onDelete?: (id: string) => void;
}

type PeriodType = 'monthly' | 'weekly' | 'yearly';

export const Budgets: React.FC<BudgetsProps> = ({ budgets, setBudgets, transactions, onAdd, onDelete }) => {
  // Navigation & View State
  const [viewDate, setViewDate] = useState(new Date());
  const [periodType, setPeriodType] = useState<PeriodType>('monthly');
  
  // UI State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [detailedBudget, setDetailedBudget] = useState<string | null>(null); // ID of budget being viewed in detail

  // Form State
  const [formData, setFormData] = useState<Partial<Budget>>({
    category: '', limit: 0, rolloverEnabled: false, frequency: 'monthly', paused: false
  });

  const allCategories = Object.values(EXPENSE_CATEGORIES).flat();

  // --- Date Helpers ---

  const getPeriodDates = (date: Date, type: PeriodType) => {
    const start = new Date(date);
    const end = new Date(date);
    
    if (type === 'monthly') {
        start.setDate(1);
        start.setHours(0,0,0,0);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        end.setHours(23,59,59,999);
    } else if (type === 'weekly') {
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
        start.setDate(diff);
        start.setHours(0,0,0,0);
        end.setDate(start.getDate() + 6);
        end.setHours(23,59,59,999);
    } else if (type === 'yearly') {
        start.setMonth(0, 1);
        start.setHours(0,0,0,0);
        end.setMonth(11, 31);
        end.setHours(23,59,59,999);
    }
    return { start, end };
  };

  const changePeriod = (delta: number) => {
    const newDate = new Date(viewDate);
    if (periodType === 'monthly') newDate.setMonth(newDate.getMonth() + delta);
    else if (periodType === 'weekly') newDate.setDate(newDate.getDate() + (delta * 7));
    else if (periodType === 'yearly') newDate.setFullYear(newDate.getFullYear() + delta);
    setViewDate(newDate);
  };

  // --- Handlers ---

  const handleOpenForm = (budget?: Budget) => {
      if (budget) {
          setEditingBudget(budget);
          setFormData({ ...budget });
      } else {
          setEditingBudget(null);
          setFormData({ category: '', limit: 0, rolloverEnabled: false, frequency: 'monthly', paused: false });
      }
      setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category || !formData.limit) return;
    
    try {
        if (editingBudget) {
            const updated = await orcamentosService.update(editingBudget.id, formData);
            setBudgets(budgets.map(b => b.id === editingBudget.id ? updated : b));
        } else {
            const newB = await orcamentosService.create(formData);
            setBudgets([...budgets, newB]);
        }
        setIsFormOpen(false);
    } catch (e) {
        alert("Erro ao salvar orçamento.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Excluir orçamento? As transações não serão apagadas.")) {
        if (onDelete) onDelete(id);
        else {
             await orcamentosService.delete(id);
             setBudgets(budgets.filter(b => b.id !== id));
        }
        if (detailedBudget === id) setDetailedBudget(null);
    }
  };

  const togglePause = async (budget: Budget) => {
      try {
          const updated = await orcamentosService.update(budget.id, { paused: !budget.paused });
          setBudgets(budgets.map(b => b.id === budget.id ? updated : b));
      } catch (e) { alert("Erro ao atualizar status"); }
  };

  // --- Logic Engine ---

  const { start: periodStart, end: periodEnd } = getPeriodDates(viewDate, periodType);

  const calculateBudgetStats = (budget: Budget) => {
      if (budget.paused) return { currentSpent: 0, rolloverAmount: 0, effectiveLimit: budget.limit, percent: 0, remaining: 0, status: 'paused', transactions: [] };

      // 1. Transactions in Current Period
      const budgetTxs = transactions.filter(t => {
          const d = new Date(t.date);
          return t.type === 'expense' && 
                 t.category === budget.category && 
                 d >= periodStart && d <= periodEnd;
      });

      const currentSpent = budgetTxs.reduce((acc, t) => acc + t.amount, 0);

      // 2. Rollover Logic (Previous Period)
      let rolloverAmount = 0;
      if (budget.rolloverEnabled) {
          // Calculate Previous Period Dates
          const prevStart = new Date(periodStart);
          const prevEnd = new Date(periodStart);
          
          if (periodType === 'monthly') {
              prevStart.setMonth(prevStart.getMonth() - 1);
              prevEnd.setDate(0); // Last day of prev month
          } else if (periodType === 'weekly') {
              prevStart.setDate(prevStart.getDate() - 7);
              prevEnd.setDate(prevEnd.getDate() - 1);
          } 
          // Yearly rollover logic omitted for MVP brevity

          const prevSpent = transactions
            .filter(t => {
                const d = new Date(t.date);
                return t.type === 'expense' && 
                       t.category === budget.category && 
                       d >= prevStart && d <= prevEnd;
            })
            .reduce((acc, t) => acc + t.amount, 0);

          rolloverAmount = budget.limit - prevSpent;
      }

      const effectiveLimit = Math.max(0, budget.limit + rolloverAmount);
      const remaining = effectiveLimit - currentSpent;
      const percent = effectiveLimit > 0 ? (currentSpent / effectiveLimit) * 100 : (currentSpent > 0 ? 100 : 0);

      let status: 'normal' | 'warning' | 'critical' | 'paused' = 'normal';
      if (percent >= 100) status = 'critical';
      else if (percent >= 75) status = 'warning';

      return {
          currentSpent,
          rolloverAmount,
          effectiveLimit,
          remaining,
          percent,
          status,
          transactions: budgetTxs
      };
  };

  const budgetStats = useMemo(() => {
      return budgets
        .filter(b => b.frequency === periodType) // Only show budgets matching current view mode
        .map(b => ({ ...b, ...calculateBudgetStats(b) }))
        .sort((a, b) => b.percent - a.percent);
  }, [budgets, transactions, viewDate, periodType]);

  const totalStats = useMemo(() => {
      return budgetStats.reduce((acc, curr) => ({
          budgeted: acc.budgeted + curr.effectiveLimit,
          spent: acc.spent + curr.currentSpent,
          remaining: acc.remaining + curr.remaining
      }), { budgeted: 0, spent: 0, remaining: 0 });
  }, [budgetStats]);

  // --- Components ---

  const DetailModal = () => {
      const budget = budgetStats.find(b => b.id === detailedBudget);
      if (!budget) return null;

      return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
             <div className="bg-[#151F32] w-full max-w-2xl rounded-2xl border border-slate-700 shadow-2xl flex flex-col max-h-[90vh]">
                 <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                     <div>
                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                            {budget.category} 
                            {budget.paused && <span className="text-xs bg-slate-700 px-2 py-0.5 rounded text-slate-300">Pausado</span>}
                        </h3>
                        <p className="text-sm text-slate-400">Detalhes do período</p>
                     </div>
                     <button onClick={() => setDetailedBudget(null)} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
                 </div>

                 <div className="p-6 overflow-y-auto">
                     <div className="grid grid-cols-3 gap-4 mb-6">
                         <div className="bg-[#0B111A] p-4 rounded-xl text-center">
                             <p className="text-xs text-slate-500 uppercase">Planejado</p>
                             <p className="text-lg font-bold text-white">R$ {budget.effectiveLimit.toFixed(2)}</p>
                             {budget.rolloverEnabled && <p className="text-[10px] text-slate-500">Inclui rollover</p>}
                         </div>
                         <div className="bg-[#0B111A] p-4 rounded-xl text-center">
                             <p className="text-xs text-slate-500 uppercase">Gasto</p>
                             <p className="text-lg font-bold text-[#FF4D4D]">R$ {budget.currentSpent.toFixed(2)}</p>
                         </div>
                         <div className="bg-[#0B111A] p-4 rounded-xl text-center">
                             <p className="text-xs text-slate-500 uppercase">Restante</p>
                             <p className={`text-lg font-bold ${budget.remaining < 0 ? 'text-[#FF4D4D]' : 'text-[#00D084]'}`}>R$ {budget.remaining.toFixed(2)}</p>
                         </div>
                     </div>

                     <h4 className="font-bold text-white mb-3">Transações do Período</h4>
                     {budget.transactions.length === 0 ? (
                         <div className="text-center py-8 text-slate-500 border border-dashed border-slate-700 rounded-xl">
                             Nenhuma transação encontrada neste período.
                         </div>
                     ) : (
                         <div className="space-y-2">
                             {budget.transactions.map(t => (
                                 <div key={t.id} className="flex justify-between items-center p-3 bg-[#0B111A] rounded-xl border border-slate-800">
                                     <div>
                                         <p className="text-sm text-white font-medium">{t.description}</p>
                                         <p className="text-xs text-slate-500">{new Date(t.date).toLocaleDateString()}</p>
                                     </div>
                                     <span className="text-[#FF4D4D] font-bold">- R$ {t.amount.toFixed(2)}</span>
                                 </div>
                             ))}
                         </div>
                     )}
                     
                     {/* Analysis Text */}
                     {budget.percent > 90 && (
                         <div className="mt-6 bg-red-900/10 p-4 rounded-xl border border-red-900/30 text-sm text-slate-300">
                             <strong className="text-[#FF4D4D] block mb-1">Análise de Risco:</strong>
                             Você consumiu {budget.percent.toFixed(0)}% do seu orçamento. Considere reduzir gastos nesta categoria ou ajustar o limite.
                         </div>
                     )}
                 </div>
                 
                 <div className="p-4 border-t border-slate-700 bg-[#0B111A] rounded-b-2xl flex justify-between">
                     <button onClick={() => { setDetailedBudget(null); handleDelete(budget.id); }} className="text-[#FF4D4D] hover:underline text-sm flex items-center gap-1"><Trash2 className="w-4 h-4"/> Excluir Orçamento</button>
                     <button onClick={() => { setDetailedBudget(null); handleOpenForm(budget); }} className="bg-[#9A4DFF] text-white px-4 py-2 rounded-lg font-bold hover:bg-[#8339ea]">Editar</button>
                 </div>
             </div>
          </div>
      );
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      
      {/* Detail Modal */}
      {detailedBudget && <DetailModal />}

      {/* Form Modal */}
      {isFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
             <div className="bg-[#151F32] w-full max-w-md rounded-2xl border border-slate-700 shadow-2xl p-6">
                 <h3 className="text-xl font-bold text-white mb-6">
                     {editingBudget ? 'Editar Orçamento' : 'Novo Orçamento'}
                 </h3>
                 <form onSubmit={handleSubmit} className="space-y-4">
                     <div>
                        <label className="text-xs text-slate-400 block mb-1">Categoria</label>
                        <select 
                            className="w-full bg-[#0B111A] border border-slate-700 rounded-lg p-3 text-white focus:border-[#9A4DFF] outline-none"
                            value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}
                            required
                        >
                            <option value="">Selecione...</option>
                            {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="text-xs text-slate-400 block mb-1">Limite (R$)</label>
                            <input 
                                type="number" step="0.01"
                                className="w-full bg-[#0B111A] border border-slate-700 rounded-lg p-3 text-white focus:border-[#9A4DFF] outline-none"
                                value={formData.limit} onChange={e => setFormData({...formData, limit: parseFloat(e.target.value)})}
                                required
                            />
                         </div>
                         <div>
                            <label className="text-xs text-slate-400 block mb-1">Período</label>
                            <select 
                                className="w-full bg-[#0B111A] border border-slate-700 rounded-lg p-3 text-white focus:border-[#9A4DFF] outline-none"
                                value={formData.frequency} onChange={e => setFormData({...formData, frequency: e.target.value as any})}
                            >
                                <option value="monthly">Mensal</option>
                                <option value="weekly">Semanal</option>
                                <option value="yearly">Anual</option>
                            </select>
                         </div>
                     </div>

                     <label className="flex items-center gap-3 p-3 bg-[#0B111A] rounded-xl border border-slate-700 cursor-pointer hover:border-[#9A4DFF]">
                         <input 
                            type="checkbox" 
                            checked={formData.rolloverEnabled} 
                            onChange={e => setFormData({...formData, rolloverEnabled: e.target.checked})}
                            className="w-5 h-5 accent-[#9A4DFF]"
                         />
                         <div>
                             <span className="text-sm font-bold text-white block">Ativar Rollover</span>
                             <span className="text-xs text-slate-500">Saldo não utilizado acumula para o próximo período.</span>
                         </div>
                     </label>

                     <div className="flex gap-3 mt-6">
                         <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 bg-slate-800 text-white py-3 rounded-xl hover:bg-slate-700">Cancelar</button>
                         <button type="submit" className="flex-1 bg-[#00D084] text-[#0B111A] py-3 rounded-xl font-bold hover:bg-[#00b371]">Salvar</button>
                     </div>
                 </form>
             </div>
          </div>
      )}

      {/* Header Toolbar */}
      <div className="flex flex-col xl:flex-row justify-between gap-6">
          <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-bold text-white">Planejamento</h2>
              <p className="text-slate-400 text-sm">Controle de limites e gastos.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center">
              {/* Period Type Switcher */}
              <div className="flex bg-[#151F32] p-1 rounded-xl border border-slate-700">
                  <button onClick={() => setPeriodType('weekly')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${periodType === 'weekly' ? 'bg-[#9A4DFF] text-white' : 'text-slate-500 hover:text-white'}`}>Semanal</button>
                  <button onClick={() => setPeriodType('monthly')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${periodType === 'monthly' ? 'bg-[#9A4DFF] text-white' : 'text-slate-500 hover:text-white'}`}>Mensal</button>
                  <button onClick={() => setPeriodType('yearly')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${periodType === 'yearly' ? 'bg-[#9A4DFF] text-white' : 'text-slate-500 hover:text-white'}`}>Anual</button>
              </div>

              {/* Date Navigation */}
              <div className="flex items-center bg-[#151F32] rounded-xl border border-slate-700 p-1 shadow-sm">
                  <button onClick={() => changePeriod(-1)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><ChevronLeft className="w-5 h-5" /></button>
                  <div className="px-4 py-1 text-center min-w-[140px]">
                      <span className="text-sm font-semibold text-white block leading-none">
                          {periodType === 'monthly' ? viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) :
                           periodType === 'weekly' ? `Semana ${Math.ceil(viewDate.getDate() / 7)} - ${viewDate.toLocaleDateString('pt-BR', { month: 'short' })}` :
                           viewDate.getFullYear()}
                      </span>
                  </div>
                  <button onClick={() => changePeriod(1)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"><ChevronRight className="w-5 h-5" /></button>
              </div>

              <button onClick={() => handleOpenForm()} className="bg-[#00D084] text-[#0B111A] px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[#00b371] font-bold shadow-lg shadow-emerald-900/20">
                  <Plus className="w-4 h-4" /> Novo
              </button>
          </div>
      </div>

      {/* Summary Stats */}
      {budgetStats.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#151F32] p-5 rounded-2xl border border-slate-800">
                  <p className="text-slate-400 text-xs uppercase mb-1">Total Orçado</p>
                  <p className="text-2xl font-bold text-white">R$ {totalStats.budgeted.toFixed(2)}</p>
              </div>
              <div className="bg-[#151F32] p-5 rounded-2xl border border-slate-800">
                  <p className="text-slate-400 text-xs uppercase mb-1">Total Gasto</p>
                  <p className="text-2xl font-bold text-[#FF4D4D]">R$ {totalStats.spent.toFixed(2)}</p>
                  <p className="text-xs text-slate-500">{((totalStats.spent / (totalStats.budgeted || 1)) * 100).toFixed(0)}% consumido</p>
              </div>
              <div className="bg-[#151F32] p-5 rounded-2xl border border-slate-800">
                  <p className="text-slate-400 text-xs uppercase mb-1">Disponível</p>
                  <p className={`text-2xl font-bold ${totalStats.remaining < 0 ? 'text-[#FF4D4D]' : 'text-[#00D084]'}`}>R$ {totalStats.remaining.toFixed(2)}</p>
              </div>
          </div>
      )}

      {/* Budget Grid */}
      <div className="grid grid-cols-1 gap-6">
          {budgetStats.length === 0 ? (
              <div className="text-center py-16 bg-[#151F32] rounded-2xl border border-dashed border-slate-800 text-slate-500">
                  <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum orçamento configurado para este período.</p>
                  <button onClick={() => handleOpenForm()} className="text-[#9A4DFF] hover:underline mt-2">Criar Orçamento</button>
              </div>
          ) : (
              budgetStats.map(budget => {
                  const barColor = budget.status === 'critical' ? 'bg-[#FF4D4D]' : budget.status === 'warning' ? 'bg-amber-400' : 'bg-[#00D084]';
                  const textColor = budget.status === 'critical' ? 'text-[#FF4D4D]' : budget.status === 'warning' ? 'text-amber-400' : 'text-[#00D084]';
                  const opacity = budget.paused ? 'opacity-50 grayscale' : '';

                  return (
                      <div key={budget.id} className={`bg-[#151F32] p-6 rounded-2xl border border-slate-800 shadow-sm relative group overflow-hidden ${opacity}`}>
                          <div className="flex flex-col md:flex-row gap-6 items-center">
                              {/* Left Info */}
                              <div className="flex-1 w-full">
                                  <div className="flex justify-between items-start mb-2">
                                      <div>
                                          <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                              {budget.category}
                                              {budget.paused && <span className="text-[10px] uppercase border border-slate-600 px-1.5 rounded text-slate-400">Pausado</span>}
                                          </h3>
                                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                              <span>Base: R$ {budget.limit.toFixed(2)}</span>
                                              {budget.rolloverAmount !== 0 && (
                                                  <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${budget.rolloverAmount > 0 ? 'bg-emerald-900/20 text-emerald-400' : 'bg-red-900/20 text-red-400'}`}>
                                                      <RefreshCcw className="w-3 h-3" />
                                                      {budget.rolloverAmount > 0 ? '+' : ''}{budget.rolloverAmount.toFixed(2)}
                                                  </span>
                                              )}
                                          </div>
                                      </div>
                                      <div className="text-right">
                                         <span className={`text-2xl font-bold ${textColor}`}>
                                             {Math.min(budget.percent, 999).toFixed(0)}%
                                         </span>
                                         <span className="text-xs text-slate-500 block">consumido</span>
                                      </div>
                                  </div>

                                  {/* Progress Bar */}
                                  <div className="relative w-full bg-[#0B111A] h-3 rounded-full overflow-hidden border border-slate-700 mb-3">
                                      <div 
                                         className={`h-full transition-all duration-1000 ${barColor}`}
                                         style={{ width: `${Math.min(budget.percent, 100)}%` }}
                                      ></div>
                                      <div className="absolute top-0 bottom-0 w-0.5 bg-slate-900/50 left-[75%]" title="75%"></div>
                                      <div className="absolute top-0 bottom-0 w-0.5 bg-slate-900/50 left-[90%]" title="90%"></div>
                                  </div>

                                  <div className="flex justify-between items-center">
                                      <div className="text-xs text-slate-300">
                                          Gasto: <span className="font-bold text-white">R$ {budget.currentSpent.toFixed(2)}</span>
                                      </div>
                                      <div className="flex gap-2">
                                          <button onClick={() => togglePause(budget)} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800" title={budget.paused ? "Retomar" : "Pausar"}>
                                              {budget.paused ? <PlayCircle className="w-4 h-4" /> : <PauseCircle className="w-4 h-4" />}
                                          </button>
                                          <button onClick={() => handleOpenForm(budget)} className="p-1.5 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800" title="Editar">
                                              <Edit2 className="w-4 h-4" />
                                          </button>
                                          <button onClick={() => setDetailedBudget(budget.id)} className="px-3 py-1.5 bg-[#0B111A] border border-slate-700 hover:border-[#9A4DFF] text-xs font-bold text-slate-300 rounded-lg transition-colors">
                                              Detalhes
                                          </button>
                                      </div>
                                  </div>
                              </div>
                              
                              {/* Mini Chart (Desktop) */}
                              <div className="hidden md:block w-20 h-20">
                                   <ResponsiveContainer width="100%" height="100%">
                                      <PieChart>
                                         <Pie
                                           data={[{ val: budget.percent }, { val: Math.max(0, 100 - budget.percent) }]}
                                           dataKey="val"
                                           innerRadius={25}
                                           outerRadius={35}
                                           startAngle={90}
                                           endAngle={-270}
                                           stroke="none"
                                         >
                                           <Cell fill={budget.status === 'critical' ? '#FF4D4D' : budget.status === 'warning' ? '#F59E0B' : '#00D084'} />
                                           <Cell fill="#1E293B" />
                                         </Pie>
                                      </PieChart>
                                   </ResponsiveContainer>
                              </div>
                          </div>
                          
                          {budget.status === 'critical' && !budget.paused && (
                              <div className="absolute inset-x-0 bottom-0 h-1 bg-[#FF4D4D]"></div>
                          )}
                      </div>
                  );
              })
          )}
      </div>

    </div>
  );
};