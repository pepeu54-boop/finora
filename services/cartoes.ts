import { supabase } from './supabase';
import { CreditCard } from '../types';

const TABLE = 'cartoes';

const mapToApp = (row: any): CreditCard => ({
  id: row.id,
  name: row.nome,
  limit: Number(row.limite),
  closingDay: row.dia_fechamento,
  dueDay: row.dia_vencimento,
  color: row.cor || '#6366f1'
});

export const cartoesService = {
  async getAll() {
    const { data, error } = await supabase.from(TABLE).select('*');
    if (error) throw error;
    return (data || []).map(mapToApp);
  },

  async create(card: Partial<CreditCard>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not found");

    const payload = {
      user_id: user.id,
      nome: card.name,
      limite: card.limit,
      dia_fechamento: card.closingDay,
      dia_vencimento: card.dueDay,
      cor: card.color
    };

    const { data, error } = await supabase.from(TABLE).insert([payload]).select();
    if (error) throw error;
    return mapToApp(data[0]);
  },

  async delete(id: string) {
    const { error } = await supabase.from(TABLE).delete().eq('id', id);
    if (error) throw error;
  }
};
