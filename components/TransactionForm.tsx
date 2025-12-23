import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Loader2, Sparkles, Tag, Repeat, Image as ImageIcon, Layers, X, Anchor, CalendarClock, Save
} from 'lucide-react';
import { TransactionType, TransactionNature, INCOME_CATEGORIES, EXPENSE_CATEGORIES, ACCOUNTS, CreditCard as CreditCardType, Transaction } from '../types';
import { suggestCategory } from '../services/geminiService';
import { cartoesService } from '../services/cartoes';

interface TransactionFormProps {
  onAdd: (data: any, cardDetails?: CreditCardType) => Promise<void> | void;
  initialData?: Transaction | null;
  onCancel?: () => void;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({ onAdd, initialData, onCancel }) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [nature, setNature] = useState<TransactionNature>('variable'); 
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  
  // FIX: Date initialization to Local Time instead of UTC
  const [date, setDate] = useState(() => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  });

  const [loading, setLoading] = useState(false);
  
  // Payment Method State
  const [paymentMethod, setPaymentMethod] = useState<'account' | 'credit_card'>('account');
  const [account, setAccount] = useState(ACCOUNTS[0]);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [cards, setCards] = useState<CreditCardType[]>([]);
  
  // Installments
  const [installments, setInstallments] = useState(1);

  const [targetAccount, setTargetAccount] = useState(ACCOUNTS[1]); // For transfers
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'daily'|'weekly'|'monthly'|'yearly'>('monthly');
  const [recurrenceEnd, setRecurrenceEnd] = useState('');

  // Attachment
  const [attachment, setAttachment] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSuggesting, setIsSuggesting] = useState(false);

  // Load cards
  useEffect(() => {
    cartoesService.getAll().then(setCards);
  }, []);

  // Populate form if editing
  useEffect(() => {
    if (initialData) {
      setDescription(initialData.description);
      setAmount(initialData.amount.toString());
      setDate(initialData.date); // Assumes already YYYY-MM-DD from DB/Service
      setType(initialData.type);
      setNature(initialData.nature);
      setCategory(initialData.category);
      setTags(initialData.tags || []);
      setIsRecurring(initialData.isRecurring);
      setFrequency(initialData.frequency || 'monthly');
      setRecurrenceEnd(initialData.recurrenceEndDate || '');
      setAttachment(initialData.attachmentUrl || null);

      if (initialData.type === 'transfer') {
        // Transfer logic implies account and category trickery in backend, 
        // but for editing simply:
        setAccount(initialData.account); 
        // Target account is stored in category for Transfers in this simplified model
        setTargetAccount(initialData.category); 
        setPaymentMethod('account');
      } else {
        if (initialData.cardId) {
          setPaymentMethod('credit_card');
          setSelectedCardId(initialData.cardId);
        } else {
          setPaymentMethod('account');
          setAccount(initialData.account);
        }
      }
    } else {
      // Reset defaults
      setDescription('');
      setAmount('');
      setTags([]);
      setInstallments(1);
      setAttachment(null);
      setIsRecurring(false);
      // Keep date as today or user selection? Resetting to today:
      const d = new Date();
      const offset = d.getTimezoneOffset() * 60000;
      setDate(new Date(d.getTime() - offset).toISOString().split('T')[0]);
    }
  }, [initialData]);

  // Set initial category based on type (Only if not editing)
  useEffect(() => {
    if (!initialData) {
      if (type === 'income') setCategory(INCOME_CATEGORIES[0]);
      else if (type === 'expense') {
        const firstKey = Object.keys(EXPENSE_CATEGORIES)[0];
        setCategory(EXPENSE_CATEGORIES[firstKey as keyof typeof EXPENSE_CATEGORIES][0]);
      }
    }
  }, [type, initialData]);

  // Auto-set nature if recurring
  useEffect(() => {
      if (isRecurring) setNature('fixed');
  }, [isRecurring]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    setLoading(true);
    const finalCategory = type === 'transfer' ? targetAccount : (category || 'Outros');
    const selectedCard = cards.find(c => c.id === selectedCardId);

    try {
      await onAdd({
        description,
        amount: parseFloat(amount),
        type,
        nature, 
        category: finalCategory,
        account: paymentMethod === 'account' ? account : 'Cartão de Crédito', 
        cardId: paymentMethod === 'credit_card' ? selectedCardId : undefined,
        installmentTotal: paymentMethod === 'credit_card' ? installments : 1,
        tags,
        date,
        isRecurring,
        frequency: isRecurring ? frequency : undefined,
        recurrenceEndDate: isRecurring ? recurrenceEnd : undefined,
        attachmentUrl: attachment || undefined
      }, selectedCard);

      if (!initialData) {
        // Reset basics only if successful and NOT editing
        setDescription('');
        setAmount('');
        setTags([]);
        setInstallments(1);
        setAttachment(null);
      }
    } catch (error) {
      console.error("Failed to add/update transaction", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestCategory = async () => {
    if (!description || type === 'transfer') return;
    setIsSuggesting(true);
    const suggested = await suggestCategory(description, type === 'income' ? 'income' : 'expense');
    setCategory(suggested); 
    setIsSuggesting(false);
  };

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) { 
        alert("O arquivo é muito grande. Máximo 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setAttachment(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="bg-[#151F32] p-6 rounded-2xl shadow-lg border border-slate-800 mb-8 animate-fade-in">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h3 className="font-bold text-white text-lg flex items-center gap-2">
           <div className={`p-2 rounded-lg ${initialData ? 'bg-amber-500/10' : 'bg-[#9A4DFF]/10'}`}>
             {initialData ? <Save className="w-5 h-5 text-amber-500" /> : <Plus className="w-5 h-5 text-[#9A4DFF]" />}
           </div>
           {initialData ? 'Editar Lançamento' : 'Novo Lançamento'}
        </h3>
        
        <div className="flex bg-[#0B111A] p-1 rounded-xl border border-slate-700 w-full sm:w-auto">
          <button type="button" onClick={() => setType('expense')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${type === 'expense' ? 'bg-[#1E293B] text-[#FF4D4D] shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>Saída</button>
          <button type="button" onClick={() => setType('income')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${type === 'income' ? 'bg-[#1E293B] text-[#00D084] shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>Entrada</button>
          <button type="button" onClick={() => setType('transfer')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${type === 'transfer' ? 'bg-[#1E293B] text-[#00B7FF] shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}>Transf.</button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Row 1: Amount & Desc */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <div className="relative">
             <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">R$</span>
             <input
               type="number" step="0.01" placeholder="0,00"
               value={amount} onChange={(e) => setAmount(e.target.value)}
               className="w-full pl-10 pr-4 h-12 bg-[#0B111A] border border-slate-700 rounded-xl text-white text-lg font-bold focus:ring-2 focus:ring-[#9A4DFF] focus:outline-none"
               required
             />
           </div>
           <div className="relative">
             <input
               type="text" placeholder={type === 'transfer' ? "Motivo da transferência" : "Descrição (ex: Mercado)"}
               value={description} onChange={(e) => setDescription(e.target.value)}
               className="w-full h-12 px-4 bg-[#0B111A] border border-slate-700 rounded-xl text-slate-200 focus:ring-2 focus:ring-[#9A4DFF] focus:outline-none"
               required
             />
             {type !== 'transfer' && (
               <button type="button" onClick={handleSuggestCategory} disabled={!description || isSuggesting} className="absolute right-2 top-2 p-2 text-[#9A4DFF] hover:bg-[#9A4DFF]/10 rounded-lg transition-colors disabled:opacity-50">
                 {isSuggesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
               </button>
             )}
           </div>
        </div>

        {/* Row 2: Nature, Accounts / Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           
           {/* Nature Selection */}
           <div className="md:col-span-1">
               <label className="text-xs text-slate-500 ml-1 mb-1 block">Natureza</label>
               <div className="flex bg-[#0B111A] p-1 rounded-xl border border-slate-700 h-11 items-center">
                  <button type="button" onClick={() => setNature('variable')} className={`flex-1 h-full rounded-lg text-xs font-bold ${nature === 'variable' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>Variável</button>
                  <button type="button" onClick={() => setNature('fixed')} className={`flex-1 h-full rounded-lg text-xs font-bold ${nature === 'fixed' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>Fixo</button>
               </div>
           </div>

           {/* Source Selection */}
           <div className="md:col-span-1">
             <label className="text-xs text-slate-500 ml-1 mb-1 block">
               {type === 'transfer' ? 'Conta Origem' : 'Método'}
             </label>
             
             {type === 'transfer' ? (
                <select value={account} onChange={e => setAccount(e.target.value)} className="w-full h-11 px-3 bg-[#0B111A] border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-[#9A4DFF]">
                  {ACCOUNTS.map(acc => <option key={acc} value={acc}>{acc}</option>)}
                </select>
             ) : (
               <div className="flex gap-2">
                 <button 
                   type="button"
                   onClick={() => setPaymentMethod('account')}
                   className={`flex-1 h-11 rounded-xl text-sm border flex items-center justify-center gap-1 ${paymentMethod === 'account' ? 'bg-[#9A4DFF]/20 border-[#9A4DFF] text-[#9A4DFF]' : 'bg-[#0B111A] border-slate-700 text-slate-400'}`}
                 >
                   Conta
                 </button>
                 {type === 'expense' && (
                   <button 
                     type="button"
                     onClick={() => { setPaymentMethod('credit_card'); if(cards.length > 0) setSelectedCardId(cards[0].id); }}
                     className={`flex-1 h-11 rounded-xl text-sm border flex items-center justify-center gap-1 ${paymentMethod === 'credit_card' ? 'bg-orange-900/20 border-orange-500 text-orange-500' : 'bg-[#0B111A] border-slate-700 text-slate-400'}`}
                   >
                     Cartão
                   </button>
                 )}
               </div>
             )}
           </div>

           {/* Conditional: Account Select or Card Select */}
           <div className="md:col-span-1">
              {paymentMethod === 'account' || type === 'income' || type === 'transfer' ? (
                 <>
                  <label className="text-xs text-slate-500 ml-1 mb-1 block">
                    {type === 'transfer' ? 'Conta Destino' : 'Conta'}
                  </label>
                  {type === 'transfer' ? (
                    <select value={targetAccount} onChange={e => setTargetAccount(e.target.value)} className="w-full h-11 px-3 bg-[#0B111A] border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-[#9A4DFF]">
                      {ACCOUNTS.filter(a => a !== account).map(acc => <option key={acc} value={acc}>{acc}</option>)}
                    </select>
                  ) : (
                    <select value={account} onChange={e => setAccount(e.target.value)} className="w-full h-11 px-3 bg-[#0B111A] border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-[#9A4DFF]">
                      {ACCOUNTS.map(acc => <option key={acc} value={acc}>{acc}</option>)}
                    </select>
                  )}
                 </>
              ) : (
                <>
                  <label className="text-xs text-slate-500 ml-1 mb-1 block">Selecione o Cartão</label>
                  <select value={selectedCardId} onChange={e => setSelectedCardId(e.target.value)} className="w-full h-11 px-3 bg-[#0B111A] border border-orange-900/50 rounded-xl text-white focus:outline-none focus:border-orange-500">
                    {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </>
              )}
           </div>

           {/* Date */}
           <div>
             <label className={`text-xs ml-1 mb-1 block flex items-center gap-1 ${isRecurring ? 'text-[#9A4DFF] font-bold' : 'text-slate-500'}`}>
               {isRecurring ? <CalendarClock className="w-3 h-3"/> : null}
               {isRecurring ? 'Data de Início' : 'Data'}
             </label>
             <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full h-11 px-3 bg-[#0B111A] border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-[#9A4DFF]" />
           </div>
        </div>

        {/* Row 3: Category & Installments */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {type !== 'transfer' && (
             <div>
               <label className="text-xs text-slate-500 ml-1 mb-1 block">Categoria</label>
               <select value={category} onChange={e => setCategory(e.target.value)} className="w-full h-11 px-3 bg-[#0B111A] border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-[#9A4DFF]">
                 {type === 'income' ? (
                   INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)
                 ) : (
                   Object.entries(EXPENSE_CATEGORIES).map(([g, subs]) => (
                     <optgroup key={g} label={g}>{subs.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                   ))
                 )}
               </select>
             </div>
           )}

           {/* Installments (Only visible for Credit Card Expense AND Not Editing) */}
           {/* Cannot edit installments easily after creation due to multiple records */}
           {paymentMethod === 'credit_card' && type === 'expense' && !initialData && (
             <div>
               <label className="text-xs text-slate-500 ml-1 mb-1 block flex items-center gap-2">
                 <Layers className="w-3 h-3" /> Parcelas
               </label>
               <select 
                 value={installments} 
                 onChange={e => setInstallments(Number(e.target.value))} 
                 className="w-full h-11 px-3 bg-[#0B111A] border border-orange-900/50 rounded-xl text-white focus:outline-none focus:border-orange-500"
               >
                 <option value={1}>À vista (1x)</option>
                 {[2,3,4,5,6,9,10,12,18,24].map(n => (
                   <option key={n} value={n}>{n}x de R$ {(parseFloat(amount || '0') / n).toFixed(2)}</option>
                 ))}
               </select>
             </div>
           )}
        </div>

        {/* Row 4: Tags & Extras */}
        <div className="flex flex-col md:flex-row gap-4">
           <div className="flex-1 relative">
             <Tag className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
             <input 
               type="text" placeholder="Adicionar tags (Enter)" 
               value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={addTag}
               className="w-full h-10 pl-9 pr-4 bg-[#0B111A] border border-slate-700 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-[#9A4DFF]"
             />
             {tags.length > 0 && (
               <div className="flex flex-wrap gap-2 mt-2">
                 {tags.map(t => (
                   <span key={t} className="bg-slate-800 text-slate-300 text-xs px-2 py-1 rounded-md border border-slate-700 flex items-center gap-1">
                     #{t} <button type="button" onClick={() => setTags(tags.filter(tag => tag !== t))} className="hover:text-red-400"><span className="sr-only">Remover</span>&times;</button>
                   </span>
                 ))}
               </div>
             )}
           </div>
           
           <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-sm select-none bg-[#0B111A] px-3 py-2 rounded-xl border border-slate-700 hover:border-[#9A4DFF] transition-colors">
                <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)} className="hidden" />
                <Repeat className={`w-4 h-4 ${isRecurring ? 'text-[#9A4DFF]' : 'text-slate-500'}`} />
                <span>Recorrente</span>
              </label>

              <label className={`flex items-center gap-2 cursor-pointer text-sm select-none bg-[#0B111A] px-3 py-2 rounded-xl border transition-colors ${attachment ? 'border-[#00D084] text-[#00D084]' : 'border-slate-700 text-slate-300 hover:border-[#9A4DFF]'}`}>
                 <ImageIcon className="w-4 h-4" />
                 <span>{attachment ? 'Anexado' : 'Anexo'}</span>
                 <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
                 {attachment && (
                   <button 
                    type="button" 
                    onClick={(e) => { e.preventDefault(); setAttachment(null); if(fileInputRef.current) fileInputRef.current.value = ''; }} 
                    className="ml-1 hover:text-red-500"
                   >
                     <X className="w-3 h-3" />
                   </button>
                 )}
              </label>
           </div>
        </div>

        {/* Recurrence Options */}
        {isRecurring && (
           <div className="bg-[#0B111A] p-4 rounded-xl border border-slate-700 animate-fade-in relative">
              <div className="absolute top-0 right-0 p-2 opacity-10">
                 <Repeat className="w-12 h-12 text-[#9A4DFF]" />
              </div>
              <p className="text-xs text-slate-400 mb-3 border-b border-slate-800 pb-2">
                 {initialData 
                   ? 'Editando recorrência: Alterações aqui afetarão apenas esta transação ou futuras geradas, dependendo da implementação.' 
                   : 'Este lançamento servirá como "molde". Ele será gerado automaticamente nos próximos meses a partir da data de início.'}
              </p>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Frequência</label>
                  <select value={frequency} onChange={e => setFrequency(e.target.value as any)} className="bg-[#151F32] border border-slate-600 text-slate-200 rounded-lg px-3 py-1.5 text-sm">
                    <option value="daily">Diária</option>
                    <option value="weekly">Semanal</option>
                    <option value="monthly">Mensal</option>
                    <option value="yearly">Anual</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Data Final (opcional)</label>
                  <input type="date" value={recurrenceEnd} onChange={e => setRecurrenceEnd(e.target.value)} className="bg-[#151F32] border border-slate-600 text-slate-200 rounded-lg px-3 py-1.5 text-sm" />
                </div>
              </div>
           </div>
        )}

        <div className="pt-2 flex gap-3">
           {initialData && onCancel && (
               <button 
                 type="button" 
                 onClick={onCancel}
                 className="flex-1 bg-slate-800 text-slate-300 py-3.5 rounded-xl font-bold hover:bg-slate-700"
               >
                 Cancelar
               </button>
           )}
           <button type="submit" disabled={loading} className={`flex-1 bg-[#00D084] hover:bg-[#00b371] text-[#0B111A] py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2`}>
             {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
             {initialData ? 'Salvar Alterações' : (paymentMethod === 'credit_card' && installments > 1 
               ? `Gerar ${installments} Parcelas` 
               : isRecurring ? 'Salvar Recorrência' : 'Confirmar Lançamento')}
           </button>
        </div>
      </form>
    </div>
  );
};