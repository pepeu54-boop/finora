import React, { useState, useMemo } from 'react';
import { Debt, ACCOUNTS } from '../types';
import { dividasService } from '../services/dividas';
import { lancamentosService } from '../services/lancamentos';
import { 
  Plus, Trash2, Calculator, ArrowRight, TrendingDown, 
  CalendarClock, CheckCircle, AlertTriangle, Layers, Snowflake 
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line 
} from 'recharts';

interface DebtAssistantProps {
  debts: Debt[];
  setDebts: React.Dispatch<React.SetStateAction<Debt[]>>;
  onAdd?: (debt: any) => void;
  onDelete?: (id: string) => void;
}

export const DebtAssistant: React.FC<DebtAssistantProps> = ({ debts, setDebts, onAdd, onDelete }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newDebt, setNewDebt] = useState<Partial<Debt>>({ 
    name: '', totalAmount: 0, interestRate: 0, minPayment: 0, dueDate: 10, category: 'other' 
  });
  
  // Simulator State
  const [extraPayment, setExtraPayment] = useState(0);
  const [strategy, setStrategy] = useState<'avalanche' | 'snowball'>('avalanche');
  
  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentAccount, setPaymentAccount] = useState(ACCOUNTS[0]);

  // --- Handlers ---

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDebt.name || !newDebt.totalAmount) return;
    
    if (onAdd) {
        onAdd(newDebt);
    } else {
        // Mock fallback
        setDebts([...debts, { ...newDebt, id: crypto.randomUUID(), currentAmount: newDebt.totalAmount } as Debt]);
    }
    setIsAdding(false);
    setNewDebt({ name: '', totalAmount: 0, interestRate: 0, minPayment: 0, dueDate: 10, category: 'other' });
  };

  const handleDelete = (id: string) => {
      if (onDelete) onDelete(id);
      else setDebts(debts.filter(d => d.id !== id));
  }

  const openPayModal = (debt: Debt) => {
    setSelectedDebt(debt);
    setPaymentAmount(debt.minPayment > 0 ? debt.minPayment.toString() : '');
    setPaymentModalOpen(true);
  };

  const confirmPayment = async () => {
    if (!selectedDebt || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    
    try {
      // 1. Create Transaction
      await lancamentosService.create({
        description: `Pagamento: ${selectedDebt.name}`,
        amount: amount,
        type: 'expense',
        category: 'Dívidas',
        account: paymentAccount,
        date: new Date().toISOString().split('T')[0],
        isRecurring: false,
        tags: ['dívida', selectedDebt.category || 'other'],
        nature: 'variable'
      });

      // 2. Reduce Debt Balance
      const newBalance = await dividasService.registerPayment(selectedDebt.id, selectedDebt.currentAmount, amount);
      
      // 3. Update UI
      setDebts(prev => prev.map(d => d.id === selectedDebt.id ? { ...d, currentAmount: newBalance } : d));
      
      setPaymentModalOpen(false);
      setSelectedDebt(null);
      setPaymentAmount('');
    } catch (e) {
      alert("Erro ao processar pagamento.");
    }
  };

  // --- Strategy Simulation Logic ---

  const simulationResults = useMemo(() => {
    if (debts.length === 0) return null;

    // Deep copy for simulation
    let simDebts = debts.map(d => ({ ...d }));
    let months = 0;
    let totalInterestPaid = 0;
    let history = []; // For chart: month, totalBalance

    // Sort based on strategy
    const sortDebts = (ds: typeof simDebts) => {
      return ds.sort((a, b) => {
        // Filter out paid ones from sorting logic priority but keep structure
        if (a.currentAmount <= 0) return 1;
        if (b.currentAmount <= 0) return -1;

        if (strategy === 'avalanche') {
          // Highest Rate First
          return b.interestRate - a.interestRate;
        } else {
          // Lowest Balance First (Snowball)
          return a.currentAmount - b.currentAmount;
        }
      });
    };

    // Run month by month
    while (simDebts.some(d => d.currentAmount > 0) && months < 360) { // Cap at 30 years to prevent infinite loops
      months++;
      let monthlyBudget = extraPayment; // Extra available for "targeting"
      
      // 1. Accrue Interest & Pay Minimums
      let monthlyTotalBalance = 0;
      
      // First pass: Add interest and identify minimums
      simDebts.forEach(d => {
        if (d.currentAmount > 0) {
          const interest = d.currentAmount * (d.interestRate / 100);
          totalInterestPaid += interest;
          d.currentAmount += interest;
          
          // Pay minimum (or full balance if less than min)
          const payment = Math.min(d.currentAmount, d.minPayment);
          d.currentAmount -= payment;
          
          // Note: In real snowball/avalanche, minimums are paid from the "base budget". 
          // The "extraPayment" is ON TOP of minimums.
        }
        monthlyTotalBalance += d.currentAmount;
      });

      // 2. Apply Extra Payment Strategy
      sortDebts(simDebts);
      
      for (const d of simDebts) {
        if (d.currentAmount > 0 && monthlyBudget > 0) {
          const payment = Math.min(d.currentAmount, monthlyBudget);
          d.currentAmount -= payment;
          monthlyBudget -= payment;
          monthlyTotalBalance -= payment; // Correct balance for graph
        }
      }

      if (months % 3 === 0 || months === 1) { // Sample every 3 months for chart smoothness
         history.push({ month: months, balance: Math.max(0, monthlyTotalBalance) });
      }
    }
    
    // Add final point
    if (history[history.length -1]?.balance > 0) {
        history.push({ month: months, balance: 0 });
    }

    return { months, totalInterestPaid, history };
  }, [debts, extraPayment, strategy]);

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      
      {/* Payment Modal */}
      {paymentModalOpen && selectedDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
           <div className="bg-[#151F32] p-6 rounded-2xl w-full max-w-md border border-slate-700">
              <h3 className="text-xl font-bold text-white mb-4">Registrar Pagamento</h3>
              <p className="text-slate-400 text-sm mb-4">
                 Abater saldo de: <strong className="text-white">{selectedDebt.name}</strong>
              </p>
              
              <div className="space-y-4">
                 <div>
                   <label className="text-xs text-slate-500 mb-1 block">Valor Pago (R$)</label>
                   <input 
                     type="number"
                     className="w-full bg-[#0B111A] border border-slate-700 rounded-lg p-3 text-white font-bold"
                     value={paymentAmount}
                     onChange={e => setPaymentAmount(e.target.value)}
                     autoFocus
                   />
                 </div>
                 
                 <div>
                   <label className="text-xs text-slate-500 mb-1 block">Conta de Saída</label>
                   <select 
                     value={paymentAccount} 
                     onChange={e => setPaymentAccount(e.target.value)} 
                     className="w-full bg-[#0B111A] border border-slate-700 rounded-lg p-3 text-white"
                   >
                     {ACCOUNTS.map(acc => <option key={acc} value={acc}>{acc}</option>)}
                   </select>
                 </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={() => setPaymentModalOpen(false)} className="flex-1 bg-slate-800 text-white py-3 rounded-xl hover:bg-slate-700">Cancelar</button>
                <button onClick={confirmPayment} className="flex-1 bg-[#00D084] text-[#0B111A] py-3 rounded-xl font-bold hover:bg-[#00b371]">Confirmar</button>
              </div>
           </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="bg-[#1E293B] text-white p-8 rounded-3xl relative overflow-hidden border border-slate-700">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Assistente de Dívidas</h2>
            <p className="text-slate-300 max-w-lg">
              Centralize suas pendências, simule estratégias de quitação e acompanhe seu progresso rumo à liberdade financeira.
            </p>
          </div>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-white text-[#0B111A] px-6 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center gap-2 shadow-lg"
          >
            <Plus className="w-4 h-4" /> Nova Dívida
          </button>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF4D4D] opacity-10 rounded-full blur-3xl -mr-16 -mt-16"></div>
      </div>

      {/* Add Form */}
      {isAdding && (
        <form onSubmit={handleAdd} className="bg-[#151F32] p-6 rounded-2xl border border-slate-800 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
          <input 
            placeholder="Nome (ex: Empréstimo Pessoal)" 
            className="md:col-span-2 input-field border border-slate-700 bg-[#0B111A] text-white p-2.5 rounded-lg"
            value={newDebt.name || ''}
            onChange={e => setNewDebt({...newDebt, name: e.target.value})}
            required
          />
          <select 
            className="input-field border border-slate-700 bg-[#0B111A] text-white p-2.5 rounded-lg"
            value={newDebt.category}
            onChange={e => setNewDebt({...newDebt, category: e.target.value as any})}
          >
            <option value="other">Outros</option>
            <option value="credit_card">Cartão de Crédito</option>
            <option value="loan">Empréstimo</option>
            <option value="financing">Financiamento</option>
          </select>
          <input 
            type="number"
            placeholder="Valor Total (R$)" 
            className="input-field border border-slate-700 bg-[#0B111A] text-white p-2.5 rounded-lg"
            value={newDebt.totalAmount || ''}
            onChange={e => setNewDebt({...newDebt, totalAmount: Number(e.target.value)})}
            required
          />
          <input 
            type="number" step="0.1"
            placeholder="Juros Mensal (%)" 
            className="input-field border border-slate-700 bg-[#0B111A] text-white p-2.5 rounded-lg"
            value={newDebt.interestRate || ''}
            onChange={e => setNewDebt({...newDebt, interestRate: Number(e.target.value)})}
            required
          />
          <input 
            type="number"
            placeholder="Pagamento Mínimo (R$)" 
            className="input-field border border-slate-700 bg-[#0B111A] text-white p-2.5 rounded-lg"
            value={newDebt.minPayment || ''}
            onChange={e => setNewDebt({...newDebt, minPayment: Number(e.target.value)})}
            required
          />
           <label className="flex items-center gap-2 text-slate-400 text-sm px-2">
             Dia Venc.:
             <input 
               type="number" min="1" max="31"
               className="w-16 border border-slate-700 bg-[#0B111A] text-white p-2 rounded-lg"
               value={newDebt.dueDate}
               onChange={e => setNewDebt({...newDebt, dueDate: Number(e.target.value)})}
             />
           </label>

          <button type="submit" className="bg-[#9A4DFF] text-white py-2.5 rounded-lg font-bold col-span-full hover:bg-[#8339ea]">Salvar Dívida</button>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         
         {/* Simulator Section */}
         <div className="bg-[#151F32] rounded-2xl border border-slate-800 p-6 shadow-lg h-fit">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
               <Calculator className="w-5 h-5 text-[#9A4DFF]" /> Simulador de Quitação
            </h3>

            <div className="flex flex-col gap-6">
                <div>
                   <label className="text-sm text-slate-400 mb-2 block">Quanto você pode pagar <strong>EXTRA</strong> por mês?</label>
                   <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">R$</span>
                      <input 
                         type="number" 
                         value={extraPayment} 
                         onChange={e => setExtraPayment(Number(e.target.value))}
                         className="w-full bg-[#0B111A] border border-slate-700 rounded-xl py-3 pl-10 text-white font-bold text-lg focus:border-[#9A4DFF] outline-none"
                      />
                   </div>
                   <p className="text-xs text-slate-500 mt-2">Além dos mínimos (R$ {debts.reduce((acc, d) => acc + d.minPayment, 0).toFixed(2)})</p>
                </div>

                <div>
                   <label className="text-sm text-slate-400 mb-3 block">Escolha a Estratégia</label>
                   <div className="flex bg-[#0B111A] p-1 rounded-xl border border-slate-700">
                      <button 
                        onClick={() => setStrategy('avalanche')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${strategy === 'avalanche' ? 'bg-[#9A4DFF] text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                         <TrendingDown className="w-4 h-4" /> Avalanche
                      </button>
                      <button 
                        onClick={() => setStrategy('snowball')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${strategy === 'snowball' ? 'bg-[#00B7FF] text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                      >
                         <Snowflake className="w-4 h-4" /> Bola de Neve
                      </button>
                   </div>
                   <p className="text-xs text-slate-400 mt-3 h-10">
                      {strategy === 'avalanche' 
                        ? 'Foca em pagar as dívidas com MAIOR JUROS primeiro. Matematicamente mais eficiente (economiza dinheiro).' 
                        : 'Foca em pagar as dívidas com MENOR SALDO primeiro. Psicologicamente motivador (elimina contas rápido).'}
                   </p>
                </div>

                {simulationResults && simulationResults.months < 360 && (
                  <div className="bg-[#0B111A] p-4 rounded-xl border border-slate-800">
                     <div className="flex justify-between items-center mb-4">
                        <div>
                           <p className="text-xs text-slate-500">Tempo até a liberdade</p>
                           <p className="text-2xl font-bold text-white">{Math.floor(simulationResults.months / 12)}a {simulationResults.months % 12}m</p>
                        </div>
                        <div className="text-right">
                           <p className="text-xs text-slate-500">Total Juros Pagos</p>
                           <p className="text-xl font-bold text-[#FF4D4D]">R$ {simulationResults.totalInterestPaid.toFixed(2)}</p>
                        </div>
                     </div>
                     <div className="h-[150px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                           <LineChart data={simulationResults.history}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E293B" />
                              <XAxis dataKey="month" hide />
                              <Tooltip 
                                contentStyle={{backgroundColor: '#1E293B', border: '1px solid #334155'}}
                                formatter={(val: number) => `R$ ${val.toFixed(0)}`}
                                labelFormatter={(label) => `Mês ${label}`}
                              />
                              <Line type="monotone" dataKey="balance" stroke={strategy === 'avalanche' ? '#9A4DFF' : '#00B7FF'} strokeWidth={3} dot={false} />
                           </LineChart>
                        </ResponsiveContainer>
                     </div>
                  </div>
                )}
            </div>
         </div>

         {/* Debts List */}
         <div className="space-y-4">
             <h3 className="text-xl font-bold text-white flex items-center gap-2">
               <Layers className="w-5 h-5 text-slate-400" /> Suas Dívidas
             </h3>
             
             {debts.length === 0 ? (
               <div className="text-center py-12 text-slate-500 bg-[#151F32] rounded-2xl border border-dashed border-slate-700">
                  Nenhuma dívida registrada.
               </div>
             ) : (
               debts.map(debt => {
                 const percentPaid = ((debt.totalAmount - debt.currentAmount) / debt.totalAmount) * 100;
                 return (
                   <div key={debt.id} className="bg-[#151F32] p-5 rounded-2xl border border-slate-800 shadow-sm hover:border-slate-600 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                         <div>
                            <h4 className="font-bold text-white text-lg">{debt.name}</h4>
                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                               <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-[#FF4D4D]" /> {debt.interestRate}% a.m.</span>
                               <span className="flex items-center gap-1"><CalendarClock className="w-3 h-3" /> Dia {debt.dueDate}</span>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className="text-xs text-slate-500">Saldo Devedor</p>
                            <p className="text-xl font-bold text-white">R$ {debt.currentAmount.toFixed(2)}</p>
                         </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="relative w-full h-2 bg-[#0B111A] rounded-full overflow-hidden mt-2 mb-4">
                         <div 
                           className="h-full bg-gradient-to-r from-[#9A4DFF] to-blue-500" 
                           style={{width: `${percentPaid}%`}}
                         ></div>
                      </div>

                      <div className="flex items-center justify-between">
                         <div className="text-xs text-slate-500">
                            Min: R$ {debt.minPayment.toFixed(2)}
                         </div>
                         <div className="flex gap-2">
                            <button 
                              onClick={() => openPayModal(debt)}
                              className="flex items-center gap-1 bg-emerald-900/20 text-emerald-400 border border-emerald-900/50 hover:bg-emerald-900/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                            >
                               <CheckCircle className="w-3 h-3" /> Pagar
                            </button>
                            <button 
                              onClick={() => handleDelete(debt.id)}
                              className="text-slate-500 hover:text-[#FF4D4D] p-1.5 rounded-lg hover:bg-slate-800"
                            >
                               <Trash2 className="w-4 h-4" />
                            </button>
                         </div>
                      </div>
                   </div>
                 );
               })
             )}
         </div>

      </div>
    </div>
  );
};