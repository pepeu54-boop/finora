import React, { useState } from 'react';
import { Plus, Check, Flame, Calendar, Trash2 } from 'lucide-react';
import { Habit } from '../types';

interface HabitTrackerProps {
  habits: Habit[];
  setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
}

const COLORS = ['bg-[#9A4DFF]', 'bg-[#00D084]', 'bg-[#FF4D4D]', 'bg-amber-500', 'bg-blue-500'];

export const HabitTracker: React.FC<HabitTrackerProps> = ({ habits, setHabits }) => {
  const [newHabitName, setNewHabitName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const getLast7Days = () => {
    const dates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  const last7Days = getLast7Days();

  const handleAddHabit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName) return;

    const newHabit: Habit = {
      id: crypto.randomUUID(),
      name: newHabitName,
      logs: [],
      color: COLORS[habits.length % COLORS.length]
    };

    setHabits([newHabit, ...habits]);
    setNewHabitName('');
    setIsAdding(false);
  };

  const toggleHabitDate = (habitId: string, date: string) => {
    setHabits(prev => prev.map(h => {
      if (h.id !== habitId) return h;
      
      const isCompleted = h.logs.includes(date);
      let newLogs;
      if (isCompleted) {
        newLogs = h.logs.filter(d => d !== date);
      } else {
        newLogs = [...h.logs, date];
      }
      return { ...h, logs: newLogs };
    }));
  };

  const deleteHabit = (id: string) => {
    setHabits(prev => prev.filter(h => h.id !== id));
  };

  const calculateStreak = (logs: string[]) => {
    let streak = 0;
    const sortedLogs = [...logs].sort().reverse();
    const today = new Date().toISOString().split('T')[0];
    const checkDate = new Date();
    
    if (!logs.includes(today)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (logs.includes(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="bg-gradient-to-r from-violet-900 to-indigo-900 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden border border-violet-800/50">
        <div className="relative z-10 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold mb-2">Hábitos Financeiros</h2>
            <p className="text-indigo-200 max-w-lg">
              Construa disciplina. Monitore dias sem gastos ("No spend"), dias de investimento ou metas pessoais.
            </p>
          </div>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-white/10 hover:bg-white/20 p-3 rounded-xl transition-colors backdrop-blur-sm"
          >
            <Plus className="w-6 h-6 text-white" />
          </button>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
      </div>

      {isAdding && (
        <form onSubmit={handleAddHabit} className="bg-[#151F32] p-4 rounded-xl shadow-sm border border-slate-800 flex gap-2 animate-fade-in">
          <input 
            autoFocus
            type="text" 
            placeholder="Nome do hábito (ex: Dia Zero Gastos)" 
            value={newHabitName}
            onChange={e => setNewHabitName(e.target.value)}
            className="flex-1 bg-[#0B111A] border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-[#9A4DFF] focus:outline-none"
          />
          <button type="submit" className="bg-[#9A4DFF] text-white px-6 py-2 rounded-lg font-medium hover:bg-violet-600">
            Salvar
          </button>
        </form>
      )}

      <div className="space-y-4">
        {habits.length === 0 ? (
          <div className="text-center py-12 bg-[#151F32] rounded-2xl border border-slate-800 border-dashed">
             <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
             <p className="text-slate-400">Nenhum hábito cadastrado.</p>
             <button onClick={() => setIsAdding(true)} className="text-[#9A4DFF] font-medium text-sm mt-2 hover:underline">
               Criar meu primeiro hábito
             </button>
          </div>
        ) : (
          habits.map(habit => {
            const streak = calculateStreak(habit.logs);
            return (
              <div key={habit.id} className="bg-[#151F32] p-6 rounded-2xl border border-slate-800 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-white text-lg flex items-center gap-2">
                        {habit.name}
                        {streak > 2 && (
                          <span className="flex items-center gap-1 text-xs font-bold text-orange-400 bg-orange-900/20 px-2 py-0.5 rounded-full border border-orange-900/50">
                            <Flame className="w-3 h-3 fill-orange-500" /> {streak} dias
                          </span>
                        )}
                      </h3>
                      <button onClick={() => deleteHabit(habit.id)} className="text-slate-500 hover:text-[#FF4D4D] transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex gap-2">
                       {last7Days.map(date => {
                         const isCompleted = habit.logs.includes(date);
                         const isToday = date === new Date().toISOString().split('T')[0];
                         const dayName = new Date(date).toLocaleDateString('pt-BR', { weekday: 'narrow' });
                         
                         return (
                           <button
                            key={date}
                            onClick={() => toggleHabitDate(habit.id, date)}
                            className={`
                              w-10 h-12 rounded-lg flex flex-col items-center justify-center gap-1 transition-all
                              ${isCompleted ? habit.color + ' text-white shadow-lg shadow-purple-900/20' : 'bg-[#0B111A] text-slate-600 hover:bg-slate-800'}
                              ${isToday ? 'ring-2 ring-offset-2 ring-offset-[#151F32] ring-[#9A4DFF]' : ''}
                            `}
                            title={new Date(date).toLocaleDateString()}
                           >
                             <span className="text-[10px] uppercase opacity-80">{dayName}</span>
                             {isCompleted ? <Check className="w-4 h-4" /> : <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>}
                           </button>
                         );
                       })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};