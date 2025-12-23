import { supabase } from './supabase';
import { Budget } from '../types';

const TABLE = 'orcamentos';

const mapToApp = (row: any): Budget => ({
  id: row.id,
  category: row.categoria,
  limit: Number(row.limite),
  rolloverEnabled: row.acumular_saldo || false,
  frequency: row.frequencia || 'monthly',
  paused: row.pausado || false,
  startDate: row.data_inicio,
  endDate: row.data_fim,
});

export const orcamentosService = {
  async getAll() {
    const { data, error } = await supabase.from(TABLE).select('*');
    if (error) throw error;
    return (data || []).map(mapToApp);
  },

  async create(budget: Partial<Budget>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not found");

    const payload = {
      user_id: user.id,
      categoria: budget.category,
      limite: budget.limit,
      acumular_saldo: budget.rolloverEnabled,
      frequencia: budget.frequency,
      pausado: budget.paused,
      data_inicio: budget.startDate,
      data_fim: budget.endDate
    };

    const { data, error } = await supabase.from(TABLE).insert([payload]).select();
    if (error) throw error;
    return mapToApp(data[0]);
  },

  async update(id: string, budget: Partial<Budget>) {
     const payload: any = {};
     if (budget.category !== undefined) payload.categoria = budget.category;
     if (budget.limit !== undefined) payload.limite = budget.limit;
     if (budget.rolloverEnabled !== undefined) payload.acumular_saldo = budget.rolloverEnabled;
     if (budget.frequency !== undefined) payload.frequencia = budget.frequency;
     if (budget.paused !== undefined) payload.pausado = budget.paused;
     
     const { data, error } = await supabase.from(TABLE).update(payload).eq('id', id).select();
     if (error) throw error;
     return mapToApp(data[0]);
  },

  async delete(id: string) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  }
};