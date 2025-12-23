import React from 'react';
import { User, Shield, Bell, LogOut, Download } from 'lucide-react';

export const Settings: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-white">Configurações</h2>
      
      <div className="bg-[#151F32] rounded-2xl border border-slate-800 shadow-sm overflow-hidden divide-y divide-slate-800">
        
        {/* Profile */}
        <div className="p-6 flex items-center gap-4">
          <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center text-[#9A4DFF]">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-bold text-white">Usuário Finora</h3>
            <p className="text-sm text-slate-400">usuario@exemplo.com</p>
          </div>
          <button className="ml-auto text-sm text-[#9A4DFF] font-medium hover:underline">Editar</button>
        </div>

        {/* Options */}
        <div className="p-4 space-y-2">
          <button className="w-full flex items-center gap-3 p-3 hover:bg-slate-800 rounded-xl transition-colors text-slate-300">
            <Bell className="w-5 h-5 text-slate-500" />
            <span>Notificações</span>
          </button>
          <button className="w-full flex items-center gap-3 p-3 hover:bg-slate-800 rounded-xl transition-colors text-slate-300">
            <Shield className="w-5 h-5 text-slate-500" />
            <span>Segurança e Privacidade</span>
          </button>
          <button className="w-full flex items-center gap-3 p-3 hover:bg-slate-800 rounded-xl transition-colors text-slate-300">
            <Download className="w-5 h-5 text-slate-500" />
            <span>Backup de Dados</span>
          </button>
        </div>

        {/* Logout */}
        <div className="p-4 bg-[#0B111A]">
           <button className="w-full flex items-center justify-center gap-2 text-[#FF4D4D] font-medium py-2 hover:bg-red-900/10 rounded-xl transition-colors">
             <LogOut className="w-5 h-5" /> Sair da conta
           </button>
        </div>
      </div>
      
      <p className="text-center text-xs text-slate-500">Finora v1.2.0 • Build 2024</p>
    </div>
  );
};