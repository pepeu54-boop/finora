import React, { useState, useMemo } from 'react';
import { CreditCard, Plus, Trash2, CreditCard as CardIcon, Calendar, CheckCircle, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { CreditCard as CreditCardType, Transaction, ACCOUNTS } from '../types';
import { lancamentosService } from '../services/lancamentos';

interface CreditCardsProps {
  cards: CreditCardType[];
  setCards: React.Dispatch<React.SetStateAction<CreditCardType[]>>;
  transactions: Transaction[];
  onAdd?: (card: any) => void;
  onDelete?: (id: string) => void;
  onUpdate?: () => void; // Nova prop para atualizar dados globais
}

export const CreditCards: React.FC<CreditCardsProps> = ({ cards, setCards, transactions, onAdd, onDelete, onUpdate }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newCard, setNewCard] = useState<Partial<CreditCardType>>({ name: '', limit: 0, closingDay: 1, dueDay: 10, color: '#6366f1' });
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  
  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<{cardId: string, month: number, year: number, amount: number, transactionIds: string[]} | null>(null);
  const [paymentAccount, setPaymentAccount] = useState(ACCOUNTS[0]);

  // --- Handlers ---
  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCard.name || !newCard.limit) return;
    
    if (onAdd) {
        onAdd(newCard);
    } else {
        setCards([...cards, { ...newCard, id: crypto.randomUUID() } as CreditCardType]);
    }
    
    setIsAdding(false);
    setNewCard({ name: '', limit: 0, closingDay: 1, dueDay: 10, color: '#6366f1' });
  };

  const handleDelete = (id: string) => {
      // Check for unpaid invoices logic could be added here
      if(onDelete) onDelete(id);
      else setCards(cards.filter(c => c.id !== id));
  }

  const handlePayInvoice = async () => {
    if (!selectedInvoice) return;
    setLoadingPayment(true);
    try {
      await lancamentosService.payInvoice(
        selectedInvoice.cardId, 
        selectedInvoice.amount, 
        paymentAccount, 
        selectedInvoice.transactionIds
      );
      
      setPaymentModalOpen(false);
      setSelectedInvoice(null);
      
      // Se tiver função de update, chama ela. Se não, fallback pro reload.
      if (onUpdate) {
        onUpdate();
        // Pequeno delay para garantir UX fluida
        setTimeout(() => alert("Fatura paga com sucesso!"), 100);
      } else {
        alert("Fatura paga com sucesso! O sistema será atualizado.");
        window.location.reload(); 
      }
    } catch (e: any) {
      console.error(e);
      alert(`Erro ao pagar fatura: ${e.message || 'Tente novamente.'}`);
    } finally {
      setLoadingPayment(false);
    }
  };

  const openPaymentModal = (cardId: string, invoice: any) => {
    setSelectedInvoice({
      cardId, 
      month: invoice.month, 
      year: invoice.year, 
      amount: invoice.total,
      transactionIds: invoice.items.map((t: Transaction) => t.id)
    });
    setPaymentModalOpen(true);
  };

  // --- Calculations ---
  
  // Calculate Available Limit: Limit - (All unpaid expenses on this card)
  const getCardStats = (cardId: string, limit: number) => {
    const unpaidTotal = transactions
      .filter(t => t.cardId === cardId && !t.isPaid)
      .reduce((acc, curr) => acc + curr.amount, 0);
    
    return {
      used: unpaidTotal,
      available: limit - unpaidTotal
    };
  };

  // Group transactions by Invoice (Month/Year)
  const getInvoices = (cardId: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return [];

    const cardTrans = transactions.filter(t => t.cardId === cardId);
    
    const groups: Record<string, { month: number, year: number, total: number, items: Transaction[], isPaid: boolean }> = {};
    
    cardTrans.forEach(t => {
      // Use UTC to safely interpret YYYY-MM-DD regardless of local timezone
      const d = new Date(t.date);
      const dayOfMonth = d.getUTCDate();
      let invoiceMonth = d.getUTCMonth();
      let invoiceYear = d.getUTCFullYear();
      
      // LOGIC: If date day >= closingDay, it moves to NEXT month's invoice.
      if (dayOfMonth >= card.closingDay) {
          invoiceMonth++;
          if (invoiceMonth > 11) {
              invoiceMonth = 0;
              invoiceYear++;
          }
      }

      const key = `${invoiceMonth}-${invoiceYear}`;
      
      if (!groups[key]) {
        groups[key] = { 
          month: invoiceMonth, 
          year: invoiceYear, 
          total: 0, 
          items: [],
          isPaid: true // Start true, if any item is unpaid, set false
        };
      }
      
      groups[key].items.push(t);
      groups[key].total += t.amount;
      if (!t.isPaid) groups[key].isPaid = false;
    });

    return Object.values(groups).sort((a,b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  };

  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      
      {/* Payment Modal */}
      {paymentModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
           <div className="bg-[#151F32] p-6 rounded-2xl w-full max-w-md border border-slate-700 shadow-2xl animate-fade-in">
              <h3 className="text-xl font-bold text-white mb-4">Pagar Fatura</h3>
              <p className="text-slate-400 mb-6">
                Fatura de {new Date(selectedInvoice.year, selectedInvoice.month).toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'})}
                <br />
                <span className="text-2xl font-bold text-white mt-2 block">R$ {selectedInvoice.amount.toFixed(2)}</span>
              </p>
              
              <label className="block text-sm text-slate-500 mb-2">Pagar com:</label>
              <select 
                value={paymentAccount} 
                onChange={e => setPaymentAccount(e.target.value)} 
                className="w-full bg-[#0B111A] border border-slate-700 rounded-xl p-3 text-white mb-6 focus:border-[#00D084] outline-none"
              >
                {ACCOUNTS.map(acc => <option key={acc} value={acc}>{acc}</option>)}
              </select>

              <div className="flex gap-3">
                <button 
                  onClick={() => setPaymentModalOpen(false)} 
                  disabled={loadingPayment}
                  className="flex-1 bg-slate-800 text-white py-3 rounded-xl hover:bg-slate-700 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handlePayInvoice} 
                  disabled={loadingPayment}
                  className="flex-1 bg-[#00D084] text-[#0B111A] py-3 rounded-xl font-bold hover:bg-[#00b371] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loadingPayment ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar'}
                </button>
              </div>
           </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Gerenciar Cartões</h2>
          <p className="text-slate-400">Controle limites, parcelas e faturas.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-[#9A4DFF] text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-[#8339ea] transition-colors shadow-lg shadow-purple-900/40"
        >
          <Plus className="w-4 h-4" /> Novo Cartão
        </button>
      </div>

      {/* Add Form */}
      {isAdding && (
        <form onSubmit={handleAddCard} className="bg-[#151F32] p-6 rounded-2xl border border-slate-800 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
          <input 
            placeholder="Nome do Cartão (ex: Nubank)" 
            className="input-field border border-slate-700 bg-[#0B111A] text-white p-2 rounded-lg"
            value={newCard.name}
            onChange={e => setNewCard({...newCard, name: e.target.value})}
            required
          />
          <input 
            type="number"
            placeholder="Limite Total (R$)" 
            className="input-field border border-slate-700 bg-[#0B111A] text-white p-2 rounded-lg"
            value={newCard.limit || ''}
            onChange={e => setNewCard({...newCard, limit: Number(e.target.value)})}
            required
          />
          <div className="flex gap-4">
            <label className="text-xs text-slate-400 block w-1/2">
              Fechamento dia:
              <input 
                type="number" min="1" max="28"
                className="w-full border border-slate-700 bg-[#0B111A] text-white p-2 rounded-lg mt-1"
                value={newCard.closingDay}
                onChange={e => setNewCard({...newCard, closingDay: Number(e.target.value)})}
              />
            </label>
            <label className="text-xs text-slate-400 block w-1/2">
              Vencimento dia:
              <input 
                type="number" min="1" max="28"
                className="w-full border border-slate-700 bg-[#0B111A] text-white p-2 rounded-lg mt-1"
                value={newCard.dueDay}
                onChange={e => setNewCard({...newCard, dueDay: Number(e.target.value)})}
              />
            </label>
          </div>
          <button type="submit" className="col-span-full bg-[#00D084] text-[#0B111A] py-2 rounded-lg font-bold">Salvar Cartão</button>
        </form>
      )}

      {/* Cards List */}
      <div className="space-y-6">
        {cards.map(card => {
          const stats = getCardStats(card.id, card.limit);
          const invoices = getInvoices(card.id);
          const isExpanded = expandedCardId === card.id;

          // Find current invoice (first unpaid or current month)
          const currentInvoice = invoices.find(inv => 
            !inv.isPaid && (inv.month === currentMonth && inv.year === currentYear)
          ) || invoices.find(inv => !inv.isPaid); // Or just next unpaid

          return (
            <div key={card.id} className="bg-[#151F32] border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
              
              {/* Card Header (Click to expand) */}
              <div 
                onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                className="p-6 cursor-pointer hover:bg-slate-800/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                {/* Visual Card Representation */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-10 rounded bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600 flex items-center justify-center shadow-inner">
                    <CardIcon className="text-slate-400 w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{card.name}</h3>
                    <p className="text-xs text-slate-500">
                      Fecha dia {card.closingDay} • Vence dia {card.dueDay}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-8 text-sm">
                  <div>
                    <p className="text-slate-500">Limite Disp.</p>
                    <p className="font-bold text-[#00D084]">R$ {stats.available.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Fatura Atual</p>
                    <p className="font-bold text-[#FF4D4D]">
                       R$ {currentInvoice ? currentInvoice.total.toFixed(2) : '0.00'}
                    </p>
                  </div>
                  <div className="hidden md:block">
                     <p className="text-slate-500">Limite Total</p>
                     <p className="font-medium text-slate-300">R$ {card.limit.toFixed(2)}</p>
                  </div>
                </div>
                
                <div className="text-slate-500">
                   {isExpanded ? <ChevronUp /> : <ChevronDown />}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="bg-[#0B111A] border-t border-slate-800 p-6 animate-fade-in">
                  <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#9A4DFF]" /> Histórico de Faturas
                  </h4>
                  
                  {invoices.length === 0 ? (
                    <p className="text-slate-500 text-sm">Nenhuma fatura registrada.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {invoices.map((inv, idx) => {
                         const date = new Date(inv.year, inv.month);
                         // Check status logic
                         const isCurrent = inv.month === currentMonth && inv.year === currentYear;
                         
                         return (
                           <div key={idx} className={`p-4 rounded-xl border ${inv.isPaid ? 'border-emerald-900/30 bg-emerald-900/10' : isCurrent ? 'border-orange-900/50 bg-orange-900/10' : 'border-slate-800 bg-[#151F32]'}`}>
                              <div className="flex justify-between items-start mb-2">
                                <span className={`text-sm font-bold capitalize ${inv.isPaid ? 'text-emerald-500' : 'text-slate-200'}`}>
                                  {date.toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'})}
                                </span>
                                {inv.isPaid && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                              </div>
                              
                              <div className="mb-3 space-y-1">
                                {inv.items.slice(0, 3).map(item => (
                                  <div key={item.id} className="flex justify-between text-xs text-slate-400">
                                    <span className="truncate max-w-[120px]">{item.description}</span>
                                    <span>{item.amount.toFixed(2)}</span>
                                  </div>
                                ))}
                                {inv.items.length > 3 && <p className="text-xs text-slate-600 text-center pt-1">+ {inv.items.length - 3} itens</p>}
                              </div>

                              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                                <span className="font-bold text-white">Total: R$ {inv.total.toFixed(2)}</span>
                                {!inv.isPaid && (
                                  <button 
                                    onClick={() => openPaymentModal(card.id, inv)}
                                    className="text-xs bg-[#00D084] text-[#0B111A] px-3 py-1.5 rounded-lg font-bold hover:bg-[#00b371] shadow-lg shadow-emerald-900/20"
                                  >
                                    Pagar
                                  </button>
                                )}
                              </div>
                           </div>
                         );
                      })}
                    </div>
                  )}

                  <div className="mt-6 flex justify-end">
                    <button 
                      onClick={() => handleDelete(card.id)}
                      className="text-xs text-[#FF4D4D] hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Excluir Cartão
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        
        {cards.length === 0 && (
          <div className="text-center py-12 text-slate-500 bg-[#151F32] rounded-2xl border border-dashed border-slate-700">
            Nenhum cartão cadastrado. Clique em "Novo Cartão" para começar.
          </div>
        )}
      </div>
    </div>
  );
};