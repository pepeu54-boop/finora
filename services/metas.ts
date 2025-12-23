import { supabase } from './supabase';
import { Goal } from '../types';

const TABLE = 'metas';

const mapToApp = (row: any): Goal => ({
  id: row.id,
  name: row.nome,
  targetAmount: Number(row.valor_alvo),
  currentAmount: Number(row.valor_atual),
  deadline: row.prazo,
  color: row.cor || '#10b981',
  targetAccount: row.conta_alvo || 'Investimentos',
  autoContributionAmount: row.aporte_auto_valor ? Number(row.aporte_auto_valor) : undefined,
  autoContributionDay: row.aporte_auto_dia,
  priority: row.prioridade || 'medium',
  status: row.status || 'active'
});

export const metasService = {
  async getAll() {
    const { data, error } = await supabase.from(TABLE).select('*');
    if (error) throw error;
    return (data || []).map(mapToApp);
  },

  async create(goal: Partial<Goal>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not found");

    const payload = {
      user_id: user.id,
      nome: goal.name,
      valor_alvo: goal.targetAmount,
      valor_atual: goal.currentAmount || 0,
      prazo: goal.deadline,
      cor: goal.color,
      conta_alvo: goal.targetAccount,
      aporte_auto_valor: goal.autoContributionAmount,
      aporte_auto_dia: goal.autoContributionDay,
      prioridade: goal.priority,
      status: goal.status
    };

    const { data, error } = await supabase.from(TABLE).insert([payload]).select();
    if (error) throw error;
    return mapToApp(data[0]);
  },

  async updateProgress(id: string, newAmount: number) {
    const { error } = await supabase
        .from(TABLE)
        .update({ valor_atual: newAmount })
        .eq('id', id);
    if (error) throw error;
  },

  async delete(id: string) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  }
};