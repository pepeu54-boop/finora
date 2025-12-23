import { supabase } from './supabase';
import { Transaction, CreditCard, DailyFlowView, SemiannualView } from '../types';
import { closuresService } from './closures';

const TABLE = 'lancamentos';

const mapToApp = (row: any): Transaction => ({
  id: row.id,
  description: row.descricao,
  amount: Number(row.valor),
  date: row.data,
  type: row.tipo as any,
  nature: (row.natureza === 'fixo' ? 'fixed' : 'variable'),
  category: row.categoria,
  account: row.conta || 'Carteira',
  tags: row.tags || [],
  attachmentUrl: row.anexo_url,
  isRecurring: row.recorrente,
  frequency: row.frequencia,
  recurrenceEndDate: row.data_fim_recorrencia,
  recurrenceParentId: row.recurrence_parent_id,
  cardId: row.cartao_id || undefined,
  transactionGroupId: row.transaction_group_id,
  isPaid: row.pago || false,
  installmentCurrent: row.parcela_atual,
  installmentTotal: row.parcela_total,
});

const mapToDB = (t: Partial<Transaction>, userId: string) => ({
  user_id: userId,
  descricao: t.description,
  valor: t.amount,
  data: t.date,
  tipo: t.type,
  natureza: t.nature === 'fixed' ? 'fixo' : 'variavel',
  categoria: t.category,
  conta: t.account,
  tags: t.tags || [],
  anexo_url: t.attachmentUrl,
  recorrente: t.isRecurring,
  frequencia: t.frequency,
  data_fim_recorrencia: t.recurrenceEndDate,
  recurrence_parent_id: t.recurrenceParentId,
  cartao_id: t.cardId || null,
  transaction_group_id: t.transactionGroupId || null,
  pago: t.isPaid || false,
  parcela_atual: t.installmentCurrent || null,
  parcela_total: t.installmentTotal || null,
});

// Helper to check closure
const checkClosed = async (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00'); // Force noon to check correct month
    const closure = await closuresService.getClosure(d.getMonth(), d.getFullYear());
    if (closure?.isClosed) {
        throw new Error(`O mês de ${d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric'})} está fechado. Reabra para fazer alterações.`);
    }
};

export const lancamentosService = {
  async getAll() {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('data', { ascending: false });
    
    if (error) {
      console.error("Supabase Error getAll:", JSON.stringify(error, null, 2));
      throw error;
    }
    return (data || []).map(mapToApp);
  },

  // Busca direto da View do Banco de Dados
  async getDailyFlow(): Promise<DailyFlowView[]> {
    const { data, error } = await supabase
      .from('view_fluxo_diario')
      .select('*')
      .order('data', { ascending: true });
    
    if (error) {
       console.error("Error fetching daily flow view:", error);
       return [];
    }
    return data || [];
  },

  async getSemiannualFlow(): Promise<SemiannualView[]> {
      const { data, error } = await supabase
        .from('view_semestral')
        .select('*')
        .order('ano', { ascending: false })
        .order('semestre', { ascending: false });
      
      if (error) {
          console.error("Error fetching semiannual view:", error);
          return [];
      }
      return data || [];
  },

  async create(transaction: Omit<Transaction, 'id'>, cardDetails?: CreditCard): Promise<Transaction[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    // Check closure for the transaction date
    try {
        await checkClosed(transaction.date);
    } catch (e) {
        throw e;
    }

    // Default nature if missing
    if (!transaction.nature) transaction.nature = transaction.isRecurring ? 'fixed' : 'variable';

    // Lógica 1: Transferência
    if (transaction.type === 'transfer') {
      const groupId = crypto.randomUUID();
      const debitTx = {
        ...transaction,
        type: 'expense' as const,
        description: `Transf. para ${transaction.category}`,
        category: 'Transferência',
        transactionGroupId: groupId,
        isPaid: true 
      };
      const creditTx = {
        ...transaction,
        type: 'income' as const,
        account: transaction.category,
        description: `Transf. de ${transaction.account}`,
        category: 'Transferência',
        transactionGroupId: groupId,
        isPaid: true
      };
      const payload1 = mapToDB(debitTx, user.id);
      const payload2 = mapToDB(creditTx, user.id);
      
      const { data, error } = await supabase.from(TABLE).insert([payload1, payload2]).select();
      if (error) {
        console.error("Supabase Error create transfer:", JSON.stringify(error, null, 2));
        throw error;
      }
      return (data || []).map(mapToApp);
    }

    // Lógica 2: Cartão de Crédito com Parcelamento
    if (transaction.cardId && cardDetails && transaction.installmentTotal && transaction.installmentTotal > 1) {
      const installments = [];
      const groupId = crypto.randomUUID();
      
      // Cálculo preciso das parcelas (evitar dízimas e perda de centavos)
      const totalAmount = transaction.amount;
      const count = transaction.installmentTotal;
      const baseAmount = Math.floor((totalAmount / count) * 100) / 100;
      const remainder = Number((totalAmount - (baseAmount * count)).toFixed(2));
      
      let purchaseDate = new Date(transaction.date + 'T12:00:00');
      let firstDueDateMonth = purchaseDate.getMonth();
      let firstDueDateYear = purchaseDate.getFullYear();

      if (purchaseDate.getDate() >= cardDetails.closingDay) {
         firstDueDateMonth++;
         if (firstDueDateMonth > 11) {
             firstDueDateMonth = 0;
             firstDueDateYear++;
         }
      }

      for (let i = 0; i < count; i++) {
        let targetMonth = firstDueDateMonth + i;
        let targetYear = firstDueDateYear + Math.floor(targetMonth / 12);
        targetMonth = targetMonth % 12;

        const dueDate = new Date(targetYear, targetMonth, cardDetails.dueDay, 12, 0, 0);
        
        const installmentValue = (i === count - 1) 
            ? Number((baseAmount + remainder).toFixed(2)) 
            : baseAmount;

        installments.push(mapToDB({
          ...transaction,
          description: `${transaction.description} (${i+1}/${count})`,
          amount: installmentValue,
          date: dueDate.toISOString().split('T')[0], // YYYY-MM-DD
          installmentCurrent: i + 1,
          transactionGroupId: groupId,
          isPaid: false,
          nature: 'fixed' // Parcelamento geralmente é fixo
        }, user.id));
      }
      
      const { data, error } = await supabase.from(TABLE).insert(installments).select();
      if (error) {
        console.error("Supabase Error create installments:", JSON.stringify(error, null, 2));
        throw error;
      }
      return (data || []).map(mapToApp);
    }

    // Lógica 3: Transação Normal
    const payload = mapToDB({
        ...transaction,
        isPaid: !transaction.cardId 
    }, user.id);
    
    const { data, error } = await supabase.from(TABLE).insert([payload]).select();
    if (error) {
       console.error("Supabase Error create normal:", JSON.stringify(error, null, 2));
       throw error;
    }
    return (data || []).map(mapToApp);
  },

  async update(id: string, transaction: Partial<Transaction>): Promise<Transaction> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    // Verificar fechamento na data NOVA e na data ANTIGA (se mudou) é complexo,
    // por enquanto verificamos apenas a data que está sendo salva.
    if (transaction.date) {
        try {
            await checkClosed(transaction.date);
        } catch (e) {
            throw e;
        }
    }

    // Preparar payload apenas com campos definidos
    const payload: any = {};
    if (transaction.description !== undefined) payload.descricao = transaction.description;
    if (transaction.amount !== undefined) payload.valor = transaction.amount;
    if (transaction.date !== undefined) payload.data = transaction.date;
    if (transaction.type !== undefined) payload.tipo = transaction.type;
    if (transaction.nature !== undefined) payload.natureza = transaction.nature === 'fixed' ? 'fixo' : 'variavel';
    if (transaction.category !== undefined) payload.categoria = transaction.category;
    if (transaction.account !== undefined) payload.conta = transaction.account;
    if (transaction.tags !== undefined) payload.tags = transaction.tags;
    if (transaction.isPaid !== undefined) payload.pago = transaction.isPaid;
    if (transaction.cardId !== undefined) payload.cartao_id = transaction.cardId;
    if (transaction.isRecurring !== undefined) payload.recorrente = transaction.isRecurring;
    if (transaction.frequency !== undefined) payload.frequencia = transaction.frequency;

    const { data, error } = await supabase
        .from(TABLE)
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return mapToApp(data);
  },

  async payInvoice(cardId: string, totalAmount: number, paymentAccount: string, transactionIds: string[]) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    // UTC Safe Local Date Generation
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    const today = new Date(d.getTime() - offset).toISOString().split('T')[0];

    await checkClosed(today);

    if (transactionIds && transactionIds.length > 0) {
        const { error: updateError } = await supabase
        .from(TABLE)
        .update({ pago: true })
        .in('id', transactionIds);
        
        if (updateError) throw updateError;
    }

    const paymentTx = {
      description: "Pagamento de Fatura",
      amount: totalAmount,
      type: 'expense' as const,
      nature: 'variable' as const, // Pagamento varia conforme uso
      category: 'Pagamento de Cartão',
      account: paymentAccount,
      date: today,
      isPaid: true,
      tags: ['fatura']
    };
    
    const payload = mapToDB(paymentTx, user.id);
    const { data, error } = await supabase.from(TABLE).insert([payload]).select();
    
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Falha ao registrar pagamento.");
    
    return mapToApp(data[0]);
  },

  async delete(id: string) {
    const { data: tx } = await supabase.from(TABLE).select('data').eq('id', id).single();
    if (tx) {
        await checkClosed(tx.data);
    }

    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
    return true;
  }
};