import { supabase } from './supabase';
import { MonthlyClosure } from '../types';

const TABLE = 'fechamentos';

export const closuresService = {
  async getClosure(month: number, year: number): Promise<MonthlyClosure | null> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('mes', month)
      .eq('ano', year)
      .maybeSingle();

    if (error) return null; // Fail gracefully if table doesn't exist
    if (!data) return null;

    return {
      id: data.id,
      month: data.mes,
      year: data.ano,
      isClosed: data.fechado,
      closedAt: data.created_at
    };
  },

  async toggleClosure(month: number, year: number, isClosed: boolean) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    // Check if exists
    const existing = await this.getClosure(month, year);

    if (existing && existing.id) {
        const { error } = await supabase
            .from(TABLE)
            .update({ fechado: isClosed })
            .eq('id', existing.id);
        if (error) throw error;
    } else {
        const { error } = await supabase
            .from(TABLE)
            .insert([{
                user_id: user.id,
                mes: month,
                ano: year,
                fechado: isClosed
            }]);
        if (error) throw error;
    }
    
    return isClosed;
  }
};
