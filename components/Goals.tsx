import React, { useState } from 'react';
import { Goal, Transaction, ACCOUNTS } from '../types';
import { metasService } from '../services/metas';
import { lancamentosService } from '../services/lancamentos';
import { 
  Target, Plus, Calendar, TrendingUp, AlertCircle, CheckCircle, 
  Settings, DollarSign, Trash2, Clock, ArrowRight 
} from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface GoalsProps {
  goals: Goal[];
  setGoals: React.Dispatch<React.SetStateAction<Goal[]>>;
  transactions: Transaction[];
  onAddTransaction: (t: any) => Promise<void> | void;
}

export const Goals: React.FC<GoalsProps> = ({ goals, setGoals, transactions, onAddTransaction }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [expandedGoalId, setExpandedGoalId] = useState<string | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<Goal>>({
    name: '', targetAmount: 0, currentAmount: 0, deadline: '', 
    color: '#10b981', priority: 'medium', status: 'active',
    targetAccount: 'Investimentos', autoContributionDay: undefined, autoContributionAmount: undefined
  });

  const [contributionAmount, setContributionAmount] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!formData.name || !formData.targetAmount) return;
    
    try {
      const newGoal = await metasService.create(formData);
      setGoals([...goals, newGoal]);
      setIsAdding(false);
      setFormData({ 
        name: '', targetAmount: 0, currentAmount: 0, deadline: '', 
        color: '#10b981', priority: 'medium', status: 'active',
        targetAccount: 'Investimentos'
      });
    } catch (e) { alert("Erro ao salvar meta"); }
  };

  const handleDelete = async (id: string) => {
    if(confirm("Tem certeza que deseja excluir esta meta?")) {
        await metasService.delete(id);
        setGoals(goals.filter(g => g.id !== id));
        if(expandedGoalId === id) setExpandedGoalId(null);
    }
  };

  const handleManualContribution = async (goal: Goal) => {
      const amount = parseFloat(contributionAmount);
      if(!amount || amount <= 0) return;

      // 1. Create Transaction payload
      const transaction = {
          description: `Aporte: ${goal.name}`,
          amount: amount,
          type: 'transfer',
          category: 'Investimento', // Or Meta
          account: 'Carteira', // Default source, ideally user selects
          tags: [`meta:${goal.id}`],
          date: new Date().toISOString().split('T')[0],
          isRecurring: false,
          goalId: goal.id,
          nature: 'variable' as const
      };

      try {
        // Await creation in parent to ensure DB consistency
        await onAddTransaction(transaction);

        // 2. Update Goal Progress only if transaction succeeded
        const newAmount = (goal.currentAmount || 0) + amount;
        await metasService.updateProgress(goal.id, newAmount);
        
        // Update local state
        setGoals(goals.map(g => g.id === goal.id ? { ...g, currentAmount: newAmount } : g));
        setContributionAmount('');
      } catch (e) {
          alert("Erro ao processar aporte. Tente novamente.");
      }
  };

  const getGoalStatusColor = (status: string) => {
      switch(status) {
          case 'completed': return 'text-emerald-400 border-emerald-500/50 bg-emerald-900/20';
          case 'paused': return 'text-yellow-400 border-yellow-500/50 bg-yellow-900/20';
          default: return 'text-blue-400 border-blue-500/50 bg-blue-900/20';
      }
  };

  const getPriorityBadge = (p: string) => {
      switch(p) {
          case 'high': return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">Alta</span>;
          case 'medium': return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">Média</span>;
          default: return <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-500/20 text-slate-400 border border-slate-500/30">Baixa</span>;
      }
  }

  // Filter transactions related to expanded goal
  const goalTransactions = expandedGoalId 
    ? transactions.filter(t => t.tags?.includes(`meta:${expandedGoalId}`) || t.description.includes(goals.find(g => g.id === expandedGoalId)?.name || ''))
    : [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#151F32] p-6 rounded-2xl border border-slate-800 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-[#9A4DFF]" /> Metas Financeiras
          </h2>
          <p className="text-slate-400 text-sm">Defina objetivos, automatize aportes e realize sonhos.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-[#00D084] text-[#0B111A] px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[#00b371] transition-colors shadow-lg shadow-emerald-500/20 font-bold"
        >
          <Plus className="w-4 h-4" /> Nova Meta
        </button>
      </div>

      {/* Form */}
      {isAdding && (
        <form onSubmit={handleSave} className="bg-[#151F32] p-6 rounded-2xl border border-slate-800 shadow-xl grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
           <div className="col-span-full mb-2">
               <h3 className="font-bold text-white">Criar Nova Meta</h3>
           </div>
           
           <input 
             placeholder="Nome do Objetivo (ex: Viagem Japão)" 
             className="w-full bg-[#0B111A] border border-slate-700 rounded-lg p-3 text-white focus:border-[#9A4DFF] outline-none"
             value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
             required
           />
           
           <div className="relative">
             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
             <input 
               type="number" placeholder="Valor Alvo" 
               className="w-full bg-[#0B111A] border border-slate-700 rounded-lg p-3 pl-10 text-white focus:border-[#9A4DFF] outline-none"
               value={formData.targetAmount || ''} onChange={e => setFormData({...formData, targetAmount: parseFloat(e.target.value)})}
               required
             />
           </div>

           <div>
              <label className="text-xs text-slate-500 mb-1 block">Prazo</label>
              <input 
                type="date"
                className="w-full bg-[#0B111A] border border-slate-700 rounded-lg p-3 text-white focus:border-[#9A4DFF] outline-none"
                value={formData.deadline} onChange={e => setFormData({...formData, deadline: e.target.value})}
                required
              />
           </div>

           <div>
              <label className="text-xs text-slate-500 mb-1 block">Prioridade</label>
              <select 
                className="w-full bg-[#0B111A] border border-slate-700 rounded-lg p-3 text-white focus:border-[#9A4DFF] outline-none"
                value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value as any})}
              >
                 <option value="low">Baixa</option>
                 <option value="medium">Média</option>
                 <option value="high">Alta</option>
              </select>
           </div>

           <div className="col-span-full bg-[#0B111A] p-4 rounded-xl border border-slate-700">
               <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                   <Settings className="w-4 h-4 text-[#9A4DFF]" /> Automação de Aporte
               </h4>
               <div className="flex gap-4">
                  <div className="flex-1">
                      <label className="text-xs text-slate-500 mb-1 block">Valor Mensal (Opcional)</label>
                      <input 
                        type="number" placeholder="0.00"
                        className="w-full bg-[#151F32] border border-slate-600 rounded-lg p-2 text-white text-sm"
                        value={formData.autoContributionAmount || ''} onChange={e => setFormData({...formData, autoContributionAmount: parseFloat(e.target.value)})}
                      />
                  </div>
                  <div className="flex-1">
                      <label className="text-xs text-slate-500 mb-1 block">Dia do Mês</label>
                      <input 
                        type="number" min="1" max="28" placeholder="Dia (1-28)"
                        className="w-full bg-[#151F32] border border-slate-600 rounded-lg p-2 text-white text-sm"
                        value={formData.autoContributionDay || ''} onChange={e => setFormData({...formData, autoContributionDay: parseInt(e.target.value)})}
                      />
                  </div>
                  <div className="flex-1">
                      <label className="text-xs text-slate-500 mb-1 block">Conta Alvo</label>
                      <select 
                        className="w-full bg-[#151F32] border border-slate-600 rounded-lg p-2 text-white text-sm"
                        value={formData.targetAccount} onChange={e => setFormData({...formData, targetAccount: e.target.value})}
                      >
                         {ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                  </div>
               </div>
               <p className="text-[10px] text-slate-500 mt-2">* Ao definir um dia e valor, o Finora criará automaticamente um lançamento de transferência mensalmente.</p>
           </div>

           <div className="col-span-full flex gap-3 pt-2">
               <button type="button" onClick={() => setIsAdding(false)} className="flex-1 bg-slate-800 text-white py-3 rounded-xl hover:bg-slate-700">Cancelar</button>
               <button type="submit" className="flex-1 bg-[#9A4DFF] text-white py-3 rounded-xl font-bold hover:bg-[#8339ea]">Salvar Meta</button>
           </div>
        </form>
      )}

      {/* Goals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {goals.map(goal => {
              const percentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
              const isExpanded = expandedGoalId === goal.id;
              
              return (
                  <div key={goal.id} className={`bg-[#151F32] rounded-2xl border transition-all duration-300 ${isExpanded ? 'border-[#9A4DFF] shadow-lg shadow-purple-900/20 col-span-full' : 'border-slate-800 shadow-sm hover:border-slate-700'}`}>
                      <div className="p-6 cursor-pointer" onClick={() => setExpandedGoalId(isExpanded ? null : goal.id)}>
                          <div className="flex justify-between items-start mb-4">
                              <div className="flex items-start gap-4">
                                  <div className="relative w-12 h-12 flex items-center justify-center">
                                     {/* Circular Progress Micro-chart */}
                                     <svg className="w-full h-full transform -rotate-90">
                                         <circle cx="24" cy="24" r="20" stroke="#1E293B" strokeWidth="4" fill="none" />
                                         <circle cx="24" cy="24" r="20" stroke={goal.color} strokeWidth="4" fill="none" strokeDasharray="126" strokeDashoffset={126 - (126 * percentage) / 100} />
                                     </svg>
                                     <span className="absolute text-[10px] font-bold text-white">{percentage.toFixed(0)}%</span>
                                  </div>
                                  <div>
                                      <h3 className="font-bold text-white text-lg">{goal.name}</h3>
                                      <div className="flex items-center gap-2 mt-1">
                                          {getPriorityBadge(goal.priority)}
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getGoalStatusColor(goal.status)} uppercase font-bold`}>{goal.status}</span>
                                      </div>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <p className="text-sm text-slate-400">Restam</p>
                                  <p className="text-white font-bold">R$ {(goal.targetAmount - goal.currentAmount).toFixed(2)}</p>
                              </div>
                          </div>

                          <div className="flex justify-between items-center text-xs text-slate-500 mt-4">
                               <div className="flex items-center gap-1">
                                   <Calendar className="w-3 h-3" />
                                   Prazo: {new Date(goal.deadline).toLocaleDateString('pt-BR')}
                               </div>
                               <div>
                                   Alvo: <span className="text-slate-300">R$ {goal.targetAmount.toLocaleString()}</span>
                               </div>
                          </div>
                      </div>

                      {isExpanded && (
                          <div className="border-t border-slate-800 p-6 bg-[#0B111A] animate-fade-in rounded-b-2xl">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                  {/* Actions */}
                                  <div>
                                      <h4 className="text-sm font-bold text-white mb-4">Aporte Rápido</h4>
                                      <div className="flex gap-2 mb-6">
                                          <div className="relative flex-1">
                                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">R$</span>
                                              <input 
                                                type="number" 
                                                placeholder="0.00" 
                                                className="w-full bg-[#151F32] border border-slate-700 rounded-lg py-2 pl-8 pr-2 text-white text-sm focus:border-[#00D084] outline-none"
                                                value={contributionAmount}
                                                onChange={e => setContributionAmount(e.target.value)}
                                              />
                                          </div>
                                          <button 
                                            onClick={(e) => { e.stopPropagation(); handleManualContribution(goal); }}
                                            className="bg-[#00D084] text-[#0B111A] px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#00b371]"
                                          >
                                              Contribuir
                                          </button>
                                      </div>
                                      
                                      <div className="bg-[#151F32] p-4 rounded-xl border border-slate-800">
                                          <div className="flex justify-between items-center mb-2">
                                              <span className="text-xs text-slate-400">Automação</span>
                                              <div className={`w-2 h-2 rounded-full ${goal.autoContributionDay ? 'bg-[#00D084]' : 'bg-slate-600'}`}></div>
                                          </div>
                                          {goal.autoContributionDay ? (
                                              <p className="text-xs text-slate-300">
                                                  Agendado: <strong>R$ {goal.autoContributionAmount}</strong> todo dia <strong>{goal.autoContributionDay}</strong> para conta <strong>{goal.targetAccount}</strong>.
                                              </p>
                                          ) : (
                                              <p className="text-xs text-slate-500">Nenhuma automação configurada.</p>
                                          )}
                                      </div>
                                  </div>

                                  {/* History */}
                                  <div>
                                      <h4 className="text-sm font-bold text-white mb-4">Últimas Contribuições</h4>
                                      {goalTransactions.length > 0 ? (
                                          <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar">
                                              {goalTransactions.slice(0, 5).map(t => (
                                                  <div key={t.id} className="flex justify-between items-center text-xs p-2 bg-[#151F32] rounded-lg border border-slate-800">
                                                      <span className="text-slate-400">{new Date(t.date).toLocaleDateString()}</span>
                                                      <span className="text-[#00D084] font-bold">+ R$ {t.amount.toFixed(2)}</span>
                                                  </div>
                                              ))}
                                          </div>
                                      ) : (
                                          <p className="text-xs text-slate-500 italic">Nenhum lançamento vinculado.</p>
                                      )}
                                      <div className="mt-4 flex justify-end">
                                          <button onClick={() => handleDelete(goal.id)} className="text-xs text-[#FF4D4D] hover:underline flex items-center gap-1">
                                              <Trash2 className="w-3 h-3" /> Excluir Meta
                                          </button>
                                      </div>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
              );
          })}
      </div>
    </div>
  );
};