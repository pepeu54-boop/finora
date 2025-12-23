import React from 'react';
import { ArrowUpCircle, ArrowDownCircle, Wallet } from 'lucide-react';

interface SummaryCardProps {
  title: string;
  amount: number;
  type: 'balance' | 'income' | 'expense';
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ title, amount, type }) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const getStyles = () => {
    switch (type) {
      case 'income':
        return {
          bg: 'bg-[#151F32] border-slate-800',
          text: 'text-[#00D084]',
          iconBg: 'bg-emerald-900/30',
          icon: <ArrowUpCircle className="w-8 h-8 text-[#00D084]" />,
        };
      case 'expense':
        return {
          bg: 'bg-[#151F32] border-slate-800',
          text: 'text-[#FF4D4D]',
          iconBg: 'bg-red-900/30',
          icon: <ArrowDownCircle className="w-8 h-8 text-[#FF4D4D]" />,
        };
      default:
        return {
          bg: 'bg-[#151F32] border-slate-800',
          text: 'text-[#9A4DFF]', // Purple
          iconBg: 'bg-purple-900/30',
          icon: <Wallet className="w-8 h-8 text-[#9A4DFF]" />,
        };
    }
  };

  const styles = getStyles();

  return (
    <div className={`p-6 rounded-2xl border ${styles.bg} shadow-lg transition-all duration-300 hover:shadow-xl hover:border-slate-700`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-slate-400 mb-1">{title}</p>
          <h3 className={`text-2xl font-bold ${styles.text}`}>
            {formatCurrency(amount)}
          </h3>
        </div>
        <div className={`p-2 rounded-xl shadow-inner ${styles.iconBg}`}>
          {styles.icon}
        </div>
      </div>
    </div>
  );
};