import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, ListOrdered, CreditCard as CardIcon, Calendar, TrendingUp, Target, 
  PieChart as PieChartIcon, LifeBuoy, FileText, Settings as SettingsIcon, Menu, Bell, AlertCircle, X,
  FileUp, Check, Upload
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { Transaction, FinancialSummary, Goal, CreditCard, Budget, Debt, Habit, Notification, ACCOUNTS } from './types';

// Services
import { authService } from './services/auth';
import { lancamentosService } from './services/lancamentos';
import { cartoesService } from './services/cartoes';
import { metasService } from './services/metas';
import { orcamentosService } from './services/orcamentos';
import { dividasService } from './services/dividas';
import { supabase } from './services/supabase';

// Components
import { SummaryCard } from './components/SummaryCard';
import { TransactionForm } from './components/TransactionForm';
import { Reports } from './components/Reports';
import { TransactionList } from './components/TransactionList';
import { CreditCards } from './components/CreditCards';
import { MonthlySummary } from './components/MonthlySummary';
import { CashFlow } from './components/CashFlow';
import { Budgets } from './components/Budgets';
import { DebtAssistant } from './components/DebtAssistant';
import { Settings } from './components/Settings';
import { Auth } from './components/Auth';
import { SystemCheck } from './components/SystemCheck';
import { Dashboard } from './components/Dashboard';
import { Goals } from './components/Goals';
import { DatabaseSetup } from './components/DatabaseSetup';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'cards' | 'summary' | 'cashflow' | 'goals' | 'budgets' | 'debts' | 'reports' | 'settings' | 'test'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Transaction Modal State
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  // Error State for DB
  const [dbError, setDbError] = useState(false);

  // New Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Data States
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Import State
  const [csvContent, setCsvContent] = useState('');

  // --- Auth & Data Fetching ---

  useEffect(() => {
    // Check active session
    authService.getSession().then((s) => {
      setSession(s);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchData = async () => {
    if (!session) return;
    setLoading(true);
    setDbError(false);
    try {
      // 1. Schema Integrity Check
      // Verifica se a View existe
      const { error: viewError } = await supabase.from('view_fluxo_diario').select('*').limit(1);
      if (viewError) throw { code: 'MISSING_SCHEMA', message: 'Views ausentes' };

      // Verifica se a coluna natureza existe (tentando selecionar ela)
      const { error: colError } = await supabase.from('lancamentos').select('natureza').limit(1);
      if (colError) throw { code: 'MISSING_SCHEMA', message: 'Coluna natureza ausente' };

      // 2. Data Loading
      const [t, g, c, b, d] = await Promise.all([
        lancamentosService.getAll(),
        metasService.getAll(),
        cartoesService.getAll(),
        orcamentosService.getAll(),
        dividasService.getAll(),
      ]);
      setTransactions(t);
      setGoals(g);
      setCards(c);
      setBudgets(b);
      setDebts(d);
      
      // Run Automation Checks (Client-side Jobs)
      await runSystemJobs(g, t, b);

    } catch (err: any) {
      console.error("Erro ao carregar dados:", JSON.stringify(err, null, 2));
      // Captura erros de tabela ou coluna faltando
      if (
          err.code === 'PGRST205' || // Table not found
          err.code === 'PGRST204' || // Column not found
          err.code === '42P01' ||    // Undefined table
          err.code === 'MISSING_SCHEMA' // Custom check
      ) {
          setDbError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  // --- System Jobs & Automation (Recurrences, Notifications) ---

  const runSystemJobs = async (currentGoals: Goal[], currentTransactions: Transaction[], currentBudgets: Budget[]) => {
      // 1. Goal Automation
      await checkGoalAutomations(currentGoals, currentTransactions);
      
      // 2. Recurrence Engine (Mocking a server-side cron)
      await checkRecurringTransactions(currentTransactions);
      
      // 3. Generate Notifications
      generateNotifications(currentTransactions, currentBudgets);
  };

  const checkRecurringTransactions = async (currentTransactions: Transaction[]) => {
      const today = new Date();
      // FIX: Horizonte expandido para 12 meses (Mês Atual + 11 futuros)
      const monthsToCheck = Array.from({length: 12}, (_, i) => i); 

      let newTx: Transaction[] = [];
      let updatesMade = false;

      // Find templates (recurring active transactions that are parents)
      const templates = currentTransactions.filter(t => t.isRecurring && !t.recurrenceParentId);

      for (const t of templates) {
         if (t.frequency && t.frequency !== 'monthly') continue; 

         // UTC Safe Day extraction
         const dueDay = parseInt(t.date.split('-')[2]);

         for (const offset of monthsToCheck) {
             // 1. Calcular Data Alvo (Mês Atual ou Próximo)
             const targetBaseDate = new Date(today.getFullYear(), today.getMonth() + offset, 1);
             const targetYear = targetBaseDate.getFullYear();
             const targetMonth = targetBaseDate.getMonth();

             // Criar data preservando o dia de vencimento
             const targetDate = new Date(targetYear, targetMonth, dueDay, 12, 0, 0);
             
             // Ajuste para fim de mês
             if (targetDate.getMonth() !== targetMonth) {
                 targetDate.setDate(0); 
             }
             
             // GERAÇÃO DE STRING LOCAL (EVITA UTC SLIP)
             const tzOffset = targetDate.getTimezoneOffset() * 60000;
             const targetDateStr = new Date(targetDate.getTime() - tzOffset).toISOString().split('T')[0];

             // 2. Validações de Regra de Negócio
             if (targetDateStr <= t.date) continue;
             if (t.recurrenceEndDate && targetDateStr > t.recurrenceEndDate) continue;

             // 3. Verificar Duplicidade
             const alreadyExists = currentTransactions.some(child => {
                 if (child.recurrenceParentId !== t.id) return false;
                 const [y, m] = child.date.split('-');
                 return parseInt(m) - 1 === targetMonth && parseInt(y) === targetYear;
             }) || newTx.some(child => {
                 if (child.recurrenceParentId !== t.id) return false;
                 const [y, m] = child.date.split('-');
                 return parseInt(m) - 1 === targetMonth && parseInt(y) === targetYear;
             });

             if (!alreadyExists) {
                 console.log(`Gerando recorrência automática: ${t.description} para ${targetDateStr}`);
                 const payload = {
                     description: t.description,
                     amount: t.amount,
                     type: t.type,
                     category: t.category,
                     account: t.account,
                     tags: [...(t.tags || []), 'auto-recorrente'],
                     date: targetDateStr,
                     isRecurring: false,
                     recurrenceParentId: t.id,
                     nature: 'fixed' as const
                 };
                 try {
                    const created = await lancamentosService.create(payload);
                    newTx.push(...created);
                    updatesMade = true;
                 } catch(e) { console.error("Falha na recorrência", e); }
             }
         }
      }

      if (updatesMade) {
          setTransactions(prev => [...newTx, ...prev]);
      }
  };

  const generateNotifications = (currentTransactions: Transaction[], currentBudgets: Budget[]) => {
      const notifs: Notification[] = [];
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);

      // 1. Check Budgets
      currentBudgets.forEach(b => {
          const spent = currentTransactions
              .filter(t => t.type === 'expense' && t.category === b.category && new Date(t.date).getMonth() === today.getMonth())
              .reduce((acc, t) => acc + t.amount, 0);
          
          if (spent > b.limit) {
              notifs.push({
                  id: `budget-exceed-${b.id}`,
                  title: 'Orçamento Excedido',
                  message: `Você excedeu o limite de ${b.category} em R$ ${(spent - b.limit).toFixed(2)}.`,
                  type: 'critical',
                  date: today.toISOString(),
                  read: false
              });
          } else if (spent > b.limit * 0.9) {
              notifs.push({
                  id: `budget-warn-${b.id}`,
                  title: 'Atenção ao Orçamento',
                  message: `Você já consumiu 90% do orçamento de ${b.category}.`,
                  type: 'warning',
                  date: today.toISOString(),
                  read: false
              });
          }
      });

      // 2. Check Bills (Simulated by Recurring Expenses)
      currentTransactions
          .filter(t => t.isRecurring && t.type === 'expense')
          .forEach(t => {
              const day = parseInt(t.date.split('-')[2]);
              const dueThisMonth = new Date(today.getFullYear(), today.getMonth(), day);
              
              if (dueThisMonth >= today && dueThisMonth <= nextWeek) {
                  notifs.push({
                      id: `bill-due-${t.id}`,
                      title: 'Conta a Vencer',
                      message: `A conta "${t.description}" vence dia ${day}.`,
                      type: 'info',
                      date: dueThisMonth.toISOString(),
                      read: false
                  });
              }
          });

      setNotifications(notifs);
  };

  const checkGoalAutomations = async (currentGoals: Goal[], currentTransactions: Transaction[]) => {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonthStr = `${today.getFullYear()}-${today.getMonth()}`; 
    
    let updatesMade = false;
    const newTransactions: Transaction[] = [];

    for (const goal of currentGoals) {
      if (goal.status === 'active' && goal.autoContributionDay && goal.autoContributionAmount) {
        if (currentDay >= goal.autoContributionDay) {
          const hasTrans = currentTransactions.some(t => {
            const tDate = new Date(t.date);
            const tKey = `${tDate.getFullYear()}-${tDate.getMonth()}`;
            return tKey === currentMonthStr && t.tags?.includes(`meta:${goal.id}`);
          });

          if (!hasTrans) {
            try {
              const newTx = {
                 description: `Aporte Automático: ${goal.name}`,
                 amount: goal.autoContributionAmount,
                 type: 'transfer' as const,
                 category: 'Investimento',
                 account: 'Carteira',
                 tags: [`meta:${goal.id}`, 'auto'],
                 date: new Date().toISOString().split('T')[0],
                 isRecurring: true,
                 goalId: goal.id,
                 nature: 'fixed' as const
              };
              
              const created = await lancamentosService.create(newTx);
              newTransactions.push(...created);
              
              const newAmount = (goal.currentAmount || 0) + goal.autoContributionAmount;
              await metasService.updateProgress(goal.id, newAmount);
              
              updatesMade = true;
            } catch (e) {
              console.error("Automation failed for", goal.name, e);
            }
          }
        }
      }
    }

    if (updatesMade) {
      const [t, g] = await Promise.all([lancamentosService.getAll(), metasService.getAll()]);
      setTransactions(t);
      setGoals(g);
    }
  };


  const upcomingBills = useMemo(() => {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    return transactions
      .filter(t => t.isRecurring && t.type === 'expense')
      .map(t => {
        const day = parseInt(t.date.split('-')[2]);
        const currentMonthBill = new Date(today.getFullYear(), today.getMonth(), day);
        const nextMonthBill = new Date(today.getFullYear(), today.getMonth() + 1, day);
        
        let targetDate = null;
        if (currentMonthBill >= today && currentMonthBill <= nextWeek) targetDate = currentMonthBill;
        else if (nextMonthBill >= today && nextMonthBill <= nextWeek) targetDate = nextMonthBill;

        return { ...t, targetDate };
      })
      .filter(t => t.targetDate !== null)
      .sort((a, b) => (a.targetDate!.getTime() - b.targetDate!.getTime()));
  }, [transactions]);

  // --- Handlers ---
  
  const handleSaveTransaction = async (data: Omit<Transaction, 'id'>, cardDetails?: CreditCard) => {
    try {
      if (editingTransaction) {
        // UPDATE MODE
        const updated = await lancamentosService.update(editingTransaction.id, data);
        
        // Update local state
        setTransactions(prev => prev.map(t => t.id === editingTransaction.id ? updated : t).sort((a, b) => b.date.localeCompare(a.date)));
      } else {
        // CREATE MODE
        const newTransactions = await lancamentosService.create(data, cardDetails);
        
        // Update local state
        const updatedList = [...newTransactions, ...transactions].sort((a, b) => b.date.localeCompare(a.date));
        setTransactions(updatedList);
        
        if (data.isRecurring) {
           await checkRecurringTransactions(updatedList);
        }
      }

      setIsTransactionModalOpen(false);
      setEditingTransaction(null);
      
      setTimeout(() => generateNotifications(transactions, budgets), 500);
    } catch (e) { 
      console.error(e);
      throw e; 
    }
  };

  const handleEditTransaction = (t: Transaction) => {
    setEditingTransaction(t);
    setIsTransactionModalOpen(true);
  };

  const handleImportCSV = async () => {
      if (!csvContent) return;
      
      const lines = csvContent.split('\n');
      const created: Transaction[] = [];
      
      try {
          for (const line of lines) {
              if (!line.trim() || line.startsWith('Date')) continue; // Skip header/empty
              
              // Simple format: Date,Description,Amount,Type,Category,Account
              const cols = line.split(',');
              if (cols.length < 3) continue;

              const payload = {
                  date: cols[0].trim(),
                  description: cols[1].trim().replace(/"/g, ''),
                  amount: parseFloat(cols[2].trim()),
                  type: (cols[3]?.trim().toLowerCase() === 'income' ? 'income' : 'expense') as any,
                  category: cols[4]?.trim() || 'Outros',
                  account: cols[5]?.trim() || 'Carteira',
                  tags: ['importado'],
                  isRecurring: false,
                  nature: 'variable' as const
              };
              
              const res = await lancamentosService.create(payload);
              created.push(...res);
          }
          
          setTransactions(prev => [...created, ...prev]);
          setIsImportModalOpen(false);
          setCsvContent('');
          alert(`${created.length} transações importadas com sucesso!`);
      } catch (e) {
          alert("Erro na importação. Verifique o formato do CSV.");
      }
  };

  const handleDeleteTransaction = async (id: string) => {
    if(!confirm("Tem certeza que deseja excluir?")) return;
    try {
      await lancamentosService.delete(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch (e) { alert("Erro ao excluir"); }
  };

  const handleAddCard = async (card: any) => {
    try {
      const newCard = await cartoesService.create(card);
      setCards(prev => [...prev, newCard]);
    } catch (e) { alert("Erro ao adicionar cartão"); }
  }
  const handleDeleteCard = async (id: string) => {
    await cartoesService.delete(id);
    setCards(prev => prev.filter(c => c.id !== id));
  }

  const handleAddBudget = async (budget: any) => {
    const newB = await orcamentosService.create(budget);
    setBudgets(prev => [...prev, newB]);
  }
  const handleDeleteBudget = async (id: string) => {
    await orcamentosService.delete(id);
    setBudgets(prev => prev.filter(b => b.id !== id));
  }

  const handleAddDebt = async (debt: any) => {
    const newD = await dividasService.create(debt);
    setDebts(prev => [...prev, newD]);
  }
  const handleDeleteDebt = async (id: string) => {
    await dividasService.delete(id);
    setDebts(prev => prev.filter(d => d.id !== id));
  }

  // --- Render ---
  
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#0B111A]"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#9A4DFF]"></div></div>;
  
  // Show Setup if DB is missing
  if (dbError) return <DatabaseSetup />;

  if (!session) return <Auth />;

  const SidebarItem = ({ id, icon: Icon, label }: { id: typeof activeTab, icon: any, label: string }) => (
    <button
      onClick={() => { setActiveTab(id); setIsSidebarOpen(false); }}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        activeTab === id ? 'bg-[#9A4DFF] text-white shadow-lg shadow-purple-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span className="font-medium text-sm">{label}</span>
    </button>
  );

  return (
    <div className="flex min-h-screen bg-[#0B111A] text-slate-200 font-sans">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />}
      
      {/* Transaction Modal */}
      {isTransactionModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
           <div className="w-full max-w-2xl bg-[#151F32] rounded-2xl shadow-2xl border border-slate-700 relative overflow-hidden">
             <button 
               onClick={() => { setIsTransactionModalOpen(false); setEditingTransaction(null); }}
               className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-lg transition-colors z-10"
             >
               <X className="w-5 h-5" />
             </button>
             <div className="p-1">
                <TransactionForm 
                  onAdd={handleSaveTransaction} 
                  initialData={editingTransaction}
                  onCancel={() => { setIsTransactionModalOpen(false); setEditingTransaction(null); }}
                />
             </div>
           </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="w-full max-w-lg bg-[#151F32] rounded-2xl shadow-2xl border border-slate-700 p-6">
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                          <FileUp className="w-5 h-5 text-[#9A4DFF]" /> Importar CSV
                      </h3>
                      <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                  </div>
                  
                  <p className="text-sm text-slate-400 mb-4">
                      Cole o conteúdo do seu CSV abaixo. Formato esperado:<br/>
                      <code className="text-xs bg-[#0B111A] p-1 rounded text-slate-300">YYYY-MM-DD, Description, Amount, Type(income/expense), Category, Account</code>
                  </p>

                  <textarea 
                      className="w-full h-40 bg-[#0B111A] border border-slate-700 rounded-xl p-3 text-xs text-slate-300 font-mono mb-4 focus:border-[#9A4DFF] outline-none"
                      placeholder={`2024-03-01, Salário, 5000, income, Salário, Nubank\n2024-03-02, Mercado, 450.50, expense, Alimentação, Carteira`}
                      value={csvContent}
                      onChange={e => setCsvContent(e.target.value)}
                  />

                  <div className="flex justify-end gap-3">
                      <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancelar</button>
                      <button 
                          onClick={handleImportCSV}
                          disabled={!csvContent}
                          className="px-4 py-2 bg-[#00D084] text-[#0B111A] rounded-lg font-bold hover:bg-[#00b371] disabled:opacity-50"
                      >
                          Processar Importação
                      </button>
                  </div>
              </div>
          </div>
      )}

      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-[#0D1624] border-r border-slate-800 z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-gradient-to-tr from-[#9A4DFF] to-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-900/40">F</div>
            <h1 className="text-xl font-bold text-white tracking-tight">Finora</h1>
          </div>
          <nav className="space-y-1 overflow-y-auto max-h-[calc(100vh-180px)] custom-scrollbar pb-4">
            <SidebarItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <SidebarItem id="transactions" icon={ListOrdered} label="Lançamentos" />
            <SidebarItem id="cards" icon={CardIcon} label="Cartões" />
            <SidebarItem id="summary" icon={Calendar} label="Resumo Mensal" />
            <SidebarItem id="cashflow" icon={TrendingUp} label="Fluxo de Caixa" />
            <SidebarItem id="goals" icon={Target} label="Metas" />
            <SidebarItem id="budgets" icon={PieChartIcon} label="Orçamentos" />
            <SidebarItem id="debts" icon={LifeBuoy} label="Dívidas" />
            <SidebarItem id="reports" icon={FileText} label="Relatórios" />
            <SidebarItem id="settings" icon={SettingsIcon} label="Configurações" />
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-slate-800 bg-[#0D1624]">
          <div className="flex items-center gap-3 bg-[#151F32] p-3 rounded-xl border border-slate-700/50">
             <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-[#9A4DFF] font-bold">{session.user.email?.charAt(0).toUpperCase()}</div>
             <div className="flex-1 min-w-0">
               <p className="text-sm font-semibold truncate text-slate-200">{session.user.email}</p>
               <button onClick={() => authService.logout()} className="text-xs text-[#FF4D4D] hover:underline">Sair</button>
             </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 h-screen overflow-y-auto">
        <header className="sticky top-0 z-30 bg-[#0B111A]/80 backdrop-blur-md border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-400 hover:bg-slate-800 rounded-lg"><Menu className="w-6 h-6" /></button>
          <h2 className="text-lg font-semibold text-white capitalize">
            {activeTab === 'dashboard' ? 'Painel de Controle' : activeTab}
          </h2>
          <div className="flex items-center gap-4 relative">
             <div 
                className="relative p-2 text-slate-400 hover:bg-slate-800 rounded-full cursor-pointer transition-colors"
                onClick={() => setShowNotifications(!showNotifications)}
             >
               <Bell className="w-5 h-5" />
               {notifications.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-[#FF4D4D] rounded-full animate-pulse"></span>}
             </div>
             
             {/* Notification Dropdown */}
             {showNotifications && (
                 <div className="absolute top-12 right-0 w-80 bg-[#151F32] border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50">
                     <div className="p-3 border-b border-slate-700 font-bold text-white text-sm">Notificações</div>
                     <div className="max-h-64 overflow-y-auto custom-scrollbar">
                         {notifications.length === 0 ? (
                             <p className="p-4 text-center text-xs text-slate-500">Nenhuma notificação.</p>
                         ) : (
                             notifications.map((n, idx) => (
                                 <div key={idx} className="p-3 border-b border-slate-800 hover:bg-[#1E293B]">
                                     <div className="flex justify-between items-start mb-1">
                                         <p className={`text-xs font-bold ${n.type === 'critical' ? 'text-[#FF4D4D]' : n.type === 'warning' ? 'text-amber-400' : 'text-blue-400'}`}>{n.title}</p>
                                         <span className="text-[10px] text-slate-500">{new Date(n.date).getDate()}/{new Date(n.date).getMonth()+1}</span>
                                     </div>
                                     <p className="text-xs text-slate-300">{n.message}</p>
                                 </div>
                             ))
                         )}
                     </div>
                 </div>
             )}
          </div>
        </header>

        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          {activeTab === 'dashboard' && (
            <Dashboard 
              transactions={transactions}
              budgets={budgets}
              goals={goals}
              debts={debts}
              onNewTransaction={() => { setEditingTransaction(null); setIsTransactionModalOpen(true); }}
              onNewGoal={() => setActiveTab('goals')}
              onPayDebt={() => setActiveTab('debts')}
              onImport={() => setIsImportModalOpen(true)}
            />
          )}

          {activeTab === 'transactions' && (
            <div className="max-w-4xl mx-auto animate-fade-in">
              <TransactionForm onAdd={handleSaveTransaction} />
              <TransactionList 
                transactions={transactions} 
                onDelete={handleDeleteTransaction} 
                onEdit={handleEditTransaction}
              />
            </div>
          )}

          {activeTab === 'cards' && (
             <CreditCards 
                cards={cards} 
                setCards={() => {}} 
                transactions={transactions} 
                onAdd={handleAddCard} 
                onDelete={handleDeleteCard} 
                onUpdate={fetchData} // Passando a função de atualização global
             />
          )}

          {activeTab === 'summary' && <MonthlySummary transactions={transactions} />}
          {activeTab === 'cashflow' && <CashFlow transactions={transactions} />}

          {activeTab === 'goals' && (
             <Goals goals={goals} setGoals={setGoals} transactions={transactions} onAddTransaction={handleSaveTransaction} />
          )}

          {activeTab === 'budgets' && (
             <Budgets budgets={budgets} setBudgets={() => {}} transactions={transactions} onAdd={handleAddBudget} onDelete={handleDeleteBudget} />
          )}

          {activeTab === 'debts' && (
             <DebtAssistant debts={debts} setDebts={() => {}} onAdd={handleAddDebt} onDelete={handleDeleteDebt} />
          )}

          {activeTab === 'reports' && <Reports transactions={transactions} debts={debts} budgets={budgets} cards={cards} />}
          
          {activeTab === 'settings' && (
             <div className="space-y-6">
               <Settings />
               {/* Test Section */}
               <div className="max-w-2xl mx-auto">
                 <h3 className="font-bold text-slate-200 mb-4">Zona de Testes</h3>
                 <SystemCheck />
                 <div className="mt-4 flex gap-2">
                    <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 bg-[#1E293B] border border-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-slate-700">
                        <FileUp className="w-4 h-4" /> Testar Importação
                    </button>
                 </div>
               </div>
             </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;