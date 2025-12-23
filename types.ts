export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionNature = 'fixed' | 'variable'; // New field

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string; // ISO string YYYY-MM-DD
  type: TransactionType;
  nature: TransactionNature; // New required field
  category: string;
  account: string; 
  tags: string[]; 
  attachmentUrl?: string; 
  isRecurring: boolean;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'yearly'; 
  recurrenceEndDate?: string; 
  cardId?: string;
  transactionGroupId?: string; 
  recurrenceParentId?: string; 
  
  isPaid?: boolean; 
  installmentCurrent?: number; 
  installmentTotal?: number; 

  goalId?: string; 
}

export interface DailyFlowView {
  data: string;
  total_entradas: number;
  total_saidas: number;
  saldo_dia: number;
  saldo_acumulado: number;
}

export interface SemiannualView {
  ano: number;
  semestre: number;
  total_entradas: number;
  total_saidas: number;
  saldo_semestre: number;
}

export interface SimulatedTransaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: TransactionType;
}

export interface CreditCard {
  id: string;
  name: string;
  limit: number;
  closingDay: number;
  dueDay: number;
  color: string;
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
  rolloverEnabled: boolean; 
  frequency: 'monthly' | 'weekly' | 'yearly' | 'custom';
  paused: boolean; 
  startDate?: string; 
  endDate?: string;
}

export interface Debt {
  id: string;
  name: string;
  totalAmount: number;
  currentAmount: number; 
  interestRate: number; 
  minPayment: number; 
  dueDate: number; 
  category?: 'loan' | 'credit_card' | 'financing' | 'other'; 
}

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  color: string;
  targetAccount?: string; 
  autoContributionAmount?: number;
  autoContributionDay?: number; 
  priority: 'low' | 'medium' | 'high';
  status: 'active' | 'completed' | 'paused';
}

export interface Habit {
  id: string;
  name: string;
  logs: string[];
  color: string;
}

export interface MonthlyClosure {
  id?: string;
  month: number; 
  year: number;
  isClosed: boolean;
  closedAt?: string;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface AIAnalysisResult {
  summary: string;
  tips: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'caution';
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'warning' | 'info' | 'success' | 'critical';
  date: string;
  read: boolean;
}

export const INCOME_CATEGORIES = [
  "Salário",
  "Investimentos",
  "Renda Extra",
  "Presente",
  "Reembolso",
  "Outros"
];

export const EXPENSE_CATEGORIES = {
  "Moradia": ["Aluguel", "Condomínio", "Luz/Água", "Internet", "Manutenção"],
  "Alimentação": ["Mercado", "Restaurante", "Delivery", "Feira"],
  "Transporte": ["Combustível", "Transporte Público", "Uber/Táxi", "IPVA", "Seguro"],
  "Saúde": ["Farmácia", "Médico", "Plano de Saúde", "Academia", "Terapia"],
  "Lazer": ["Cinema", "Viagem", "Hobby", "Streaming", "Jogos"],
  "Educação": ["Faculdade", "Cursos", "Material Escolar", "Livros"],
  "Financeiro": ["Cartão de Crédito", "Impostos", "Tarifas", "Empréstimos"],
  "Pessoal": ["Vestuário", "Cosméticos", "Salão/Barbearia"],
  "Outros": ["Doação", "Imprevistos", "Transferência"]
};

export const ACCOUNTS = ["Carteira", "Nubank", "Inter", "Itaú", "Bradesco", "Santander", "Caixa", "Investimentos", "Cofre/Reserva"];