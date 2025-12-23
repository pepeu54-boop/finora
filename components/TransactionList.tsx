import React, { useState, useMemo } from 'react';
import { Search, Filter, Trash2, Repeat, X, ArrowRight, Wallet, ArrowRightLeft, CreditCard, Edit2, Calendar } from 'lucide-react';
import { Transaction, TransactionType, ACCOUNTS } from '../types';

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit?: (transaction: Transaction) => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({ transactions, onDelete, onEdit }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [filterAccount, setFilterAccount] = useState('all');
  
  // Estado do Filtro de Mês: Inicializa com o mês atual (YYYY-MM)
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 7);
  });

  const [displayCount, setDisplayCount] = useState(15);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            t.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || t.type === filterType;
      const matchesAccount = filterAccount === 'all' || t.account === filterAccount || t.category === filterAccount;
      
      // Lógica de Filtro de Mês: Se estiver vazio (todos), passa. Senão, verifica prefixo.
      const matchesMonth = !filterMonth || t.date.startsWith(filterMonth);

      return matchesSearch && matchesType && matchesAccount && matchesMonth;
    });
  }, [transactions, searchTerm, filterType, filterAccount, filterMonth]);

  const visibleTransactions = filteredTransactions.slice(0, displayCount);

  const handleLoadMore = () => {
    setDisplayCount(prev => prev + 15);
  };

  const getIcon = (t: Transaction) => {
    if (t.type === 'transfer') return <ArrowRightLeft className="w-4 h-4 text-[#00B7FF]" />;
    if (t.cardId) return <CreditCard className="w-4 h-4 text-orange-400" />;
    return <Wallet className="w-4 h-4 text-slate-400" />;
  };

  // Helper to parse date string correctly for display
  const getDisplayDate = (dateStr: string) => {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
          const day = parts[2];
          const monthIndex = parseInt(parts[1]) - 1;
          const monthNames = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
          return { day, month: monthNames[monthIndex] };
      }
      return { day: '??', month: '???' };
  };

  const clearFilters = () => {
      setSearchTerm(''); 
      setFilterType('all'); 
      setFilterAccount('all');
      setFilterMonth(''); // Limpa o mês para ver "Todo o histórico"
  };

  return (
    <div className="space-y-4">
      {/* Filters Header */}
      <div className="bg-[#151F32] p-4 rounded-2xl border border-slate-800 shadow-sm space-y-4 md:space-y-0 md:flex md:items-center md:justify-between gap-4 animate-fade-in">
        
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Buscar..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-[#0B111A] border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#9A4DFF] placeholder-slate-500"
          />
        </div>

        {/* Filters Group */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          
          {/* Seletor de Mês */}
          <div className="relative">
             <input 
               type="month"
               value={filterMonth}
               onChange={(e) => setFilterMonth(e.target.value)}
               className="bg-[#0B111A] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-[#9A4DFF] w-[150px]"
             />
             {/* Fallback visual label if empty (All Time) */}
             {!filterMonth && (
                 <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 pointer-events-none bg-[#0B111A] pr-2">
                     Todo Período
                 </span>
             )}
          </div>

          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value as any)}
            className="bg-[#0B111A] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none"
          >
            <option value="all">Todos Tipos</option>
            <option value="income">Entradas</option>
            <option value="expense">Saídas</option>
            <option value="transfer">Transferências</option>
          </select>

          <select 
            value={filterAccount} 
            onChange={(e) => setFilterAccount(e.target.value)}
            className="bg-[#0B111A] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none"
          >
            <option value="all">Todas Contas</option>
            {ACCOUNTS.map(acc => <option key={acc} value={acc}>{acc}</option>)}
          </select>
          
          {(searchTerm || filterType !== 'all' || filterAccount !== 'all' || filterMonth !== '') && (
             <button 
              onClick={clearFilters}
              className="p-2.5 text-slate-400 hover:text-[#FF4D4D] hover:bg-red-900/20 rounded-xl transition-colors"
              title="Limpar Filtros"
             >
               <X className="w-4 h-4" />
             </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="bg-[#151F32] rounded-2xl border border-slate-800 shadow-lg overflow-hidden animate-fade-in">
        {visibleTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Filter className="w-12 h-12 mb-4 opacity-20" />
            <p>Nenhum lançamento encontrado para os filtros selecionados.</p>
            {filterMonth && (
                <button onClick={() => setFilterMonth('')} className="text-[#9A4DFF] text-sm mt-2 hover:underline">
                    Ver todo o histórico
                </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {visibleTransactions.map(t => {
                const { day, month } = getDisplayDate(t.date);
                return (
                  <div key={t.id} className="p-4 hover:bg-[#1E293B] transition-colors flex items-center justify-between group">
                    {/* Left: Date & Icon */}
                    <div className="flex items-center gap-4">
                       <div className="flex flex-col items-center justify-center w-12 h-12 bg-[#0B111A] rounded-xl border border-slate-700 text-xs font-bold text-slate-400">
                          <span>{day}</span>
                          <span className="uppercase text-[10px]">{month}</span>
                       </div>
                       
                       <div>
                         <p className="font-semibold text-white flex items-center gap-2">
                           {t.description}
                           {t.isRecurring && <Repeat className="w-3 h-3 text-[#9A4DFF]" />}
                           {t.type === 'transfer' && <span className="text-[10px] bg-[#00B7FF]/20 text-[#00B7FF] px-1.5 py-0.5 rounded uppercase">Transf</span>}
                         </p>
                         <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                           <span className="flex items-center gap-1">{getIcon(t)} {t.account}</span>
                           <span>•</span>
                           <span className="bg-slate-800 px-1.5 rounded text-slate-400">{t.category}</span>
                           {t.tags && t.tags.length > 0 && (
                             <>
                               <span>•</span>
                               <span className="text-slate-500">#{t.tags[0]} {t.tags.length > 1 && `+${t.tags.length-1}`}</span>
                             </>
                           )}
                         </div>
                       </div>
                    </div>

                    {/* Right: Amount & Actions */}
                    <div className="flex items-center gap-4">
                      <span className={`font-bold text-base md:text-lg ${
                        t.type === 'income' ? 'text-[#00D084]' : 
                        t.type === 'expense' ? 'text-[#FF4D4D]' : 'text-slate-200'
                      }`}>
                        {t.type === 'expense' ? '-' : t.type === 'income' ? '+' : ''} R$ {t.amount.toFixed(2)}
                      </span>
                      
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          {onEdit && (
                              <button 
                                onClick={() => onEdit(t)}
                                className="p-2 text-slate-600 hover:text-white hover:bg-slate-700 rounded-lg"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                          )}
                          <button 
                            onClick={() => onDelete(t.id)}
                            className="p-2 text-slate-600 hover:text-[#FF4D4D] hover:bg-red-900/20 rounded-lg"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                      </div>
                    </div>
                  </div>
                );
            })}
          </div>
        )}
        
        {/* Load More */}
        {filteredTransactions.length > displayCount && (
          <div className="p-4 bg-[#0B111A] border-t border-slate-800 text-center">
            <button 
              onClick={handleLoadMore}
              className="text-[#9A4DFF] text-sm font-medium hover:underline flex items-center justify-center gap-1 mx-auto"
            >
              Carregar mais lançamentos
            </button>
          </div>
        )}
        
        <div className="px-4 py-2 bg-[#0D1624] border-t border-slate-800 text-xs text-slate-500 flex justify-between">
           <span>Total visível: {visibleTransactions.length}</span>
           <span>Total encontrado: {filteredTransactions.length}</span>
        </div>
      </div>
    </div>
  );
};