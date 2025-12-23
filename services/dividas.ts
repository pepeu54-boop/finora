import { supabase } from './supabase';
import { Debt } from '../types';

const TABLE = 'dividas';

const mapToApp = (row: any): Debt => ({
  id: row.id,
  name: row.titulo,
  totalAmount: Number(row.valor_total),
  // If user paid partially, currentAmount reflects remaining
  currentAmount: Number(row.valor_restante !== null ? row.valor_restante : row.valor_total),
  interestRate: Number(row.juros),
  minPayment: Number(row.parcela_minima || 0),
  dueDate: Number(row.dia_vencimento || 10),
  category: row.categoria || 'other'
});

export const dividasService = {
  async getAll() {
    const { data, error } = await supabase.from(TABLE).select('*');
    if (error) throw error;
    return (data || []).map(mapToApp);
  },

  async create(debt: Partial<Debt>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not found");

    const payload = {
      user_id: user.id,
      titulo: debt.name,
      valor_total: debt.totalAmount,
      valor_restante: debt.totalAmount, // Starts full
      juros: debt.interestRate,
      parcela_minima: debt.minPayment,
      dia_vencimento: debt.dueDate,
      categoria: debt.category
    };

    const { data, error } = await supabase.from(TABLE).insert([payload]).select();
    if (error) throw error;
    return mapToApp(data[0]);
  },

  // Deduct amount from debt balance
  async registerPayment(id: string, currentBalance: number, paymentAmount: number) {
     const newBalance = Math.max(0, currentBalance - paymentAmount);
     
     const { error } = await supabase
       .from(TABLE)
       .update({ valor_restante: newBalance })
       .eq('id', id);
     
     if (error) throw error;
     return newBalance;
  },

  async delete(id: string) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  }
};