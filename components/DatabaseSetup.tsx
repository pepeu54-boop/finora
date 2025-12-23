import React from 'react';
import { Copy, Database, RefreshCw, ExternalLink, AlertTriangle, CheckCircle } from 'lucide-react';

export const DatabaseSetup: React.FC = () => {
  const sql = `-- SCRIPT COMPLETO DE INICIALIZAÇÃO DO FINORA
-- Copie e cole no SQL Editor do Supabase para criar toda a estrutura.

-- 1. TABELA: CARTÕES (Necessária antes de lançamentos)
create table if not exists public.cartoes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  nome text not null,
  limite numeric default 0,
  dia_fechamento integer default 1,
  dia_vencimento integer default 10,
  cor text default '#6366f1',
  created_at timestamptz default now()
);
alter table public.cartoes enable row level security;

-- 2. TABELA: LANÇAMENTOS (Principal)
create table if not exists public.lancamentos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  descricao text not null,
  valor numeric not null,
  data date not null,
  tipo text not null, -- 'income', 'expense'
  categoria text default 'Outros',
  conta text default 'Carteira',
  natureza text default 'variavel', -- 'fixo', 'variavel'
  tags text[],
  anexo_url text,
  recorrente boolean default false,
  frequencia text,
  data_fim_recorrencia date,
  recurrence_parent_id uuid,
  cartao_id uuid references public.cartoes(id) on delete set null,
  transaction_group_id uuid,
  pago boolean default true,
  parcela_atual integer,
  parcela_total integer,
  created_at timestamptz default now()
);
alter table public.lancamentos enable row level security;

-- 3. TABELA: METAS
create table if not exists public.metas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  nome text not null,
  valor_alvo numeric not null,
  valor_atual numeric default 0,
  prazo date,
  cor text default '#10b981',
  conta_alvo text,
  aporte_auto_valor numeric,
  aporte_auto_dia integer,
  prioridade text default 'medium',
  status text default 'active',
  created_at timestamptz default now()
);
alter table public.metas enable row level security;

-- 4. TABELA: ORÇAMENTOS
create table if not exists public.orcamentos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  categoria text not null,
  limite numeric not null,
  acumular_saldo boolean default false,
  frequencia text default 'monthly',
  pausado boolean default false,
  data_inicio date,
  data_fim date,
  created_at timestamptz default now()
);
alter table public.orcamentos enable row level security;

-- 5. TABELA: DÍVIDAS
create table if not exists public.dividas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  titulo text not null,
  valor_total numeric not null,
  valor_restante numeric,
  juros numeric default 0,
  parcela_minima numeric default 0,
  dia_vencimento integer default 10,
  categoria text default 'other',
  created_at timestamptz default now()
);
alter table public.dividas enable row level security;

-- 6. TABELA: FECHAMENTOS (Controle de meses fechados)
create table if not exists public.fechamentos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  mes integer not null,
  ano integer not null,
  fechado boolean default true,
  created_at timestamptz default now()
);
alter table public.fechamentos enable row level security;

-- 7. POLÍTICAS DE SEGURANÇA (RLS)
-- Garante que o usuário só acesse seus próprios dados
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop policy if exists "User owns data" on %I', t);
    execute format('create policy "User owns data" on %I for all using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- 8. VIEWS (RELATÓRIOS E CÁLCULOS)

-- View: Fluxo Diário (Saldo Acumulado)
create or replace view view_fluxo_diario as
select
    data,
    sum(case when tipo = 'income' then valor else 0 end) as total_entradas,
    sum(case when tipo = 'expense' then valor else 0 end) as total_saidas,
    (sum(case when tipo = 'income' then valor else 0 end) - sum(case when tipo = 'expense' then valor else 0 end)) as saldo_dia,
    sum(sum(case when tipo = 'income' then valor else -valor end)) over (order by data rows between unbounded preceding and current row) as saldo_acumulado
from public.lancamentos
-- Importante: Filtrar por usuário na aplicação ou encapsular em função segura se necessário.
-- Como é View simples, o filtro deve ser aplicado ao consultar ou garantir RLS na tabela base.
-- Nota: Views herdam RLS da tabela base se configurado owner security, mas para simplificar aqui deixamos aberto
-- e o Supabase filtra a tabela 'lancamentos' subjacente.
group by data;

-- View: Visão Semestral
create or replace view view_semestral as
select
    extract(year from data) as ano,
    case when extract(month from data) <= 6 then 1 else 2 end as semestre,
    sum(case when tipo = 'income' then valor else 0 end) as total_entradas,
    sum(case when tipo = 'expense' then valor else 0 end) as total_saidas,
    (sum(case when tipo = 'income' then valor else 0 end) - sum(case when tipo = 'expense' then valor else 0 end)) as saldo_semestre
from public.lancamentos
group by extract(year from data), case when extract(month from data) <= 6 then 1 else 2 end;

-- Permissões Finais
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

NOTIFY pgrst, 'reload config';
`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(sql);
    alert("SQL copiado! Cole no Editor SQL do Supabase e execute.");
  };

  return (
    <div className="min-h-screen bg-[#0B111A] flex items-center justify-center p-4">
      <div className="bg-[#151F32] w-full max-w-5xl rounded-2xl border border-blue-900/50 shadow-2xl p-8 flex flex-col h-[85vh] animate-fade-in">
        <div className="flex items-center gap-4 mb-6">
            <div className="bg-blue-900/20 p-3 rounded-full border border-blue-900/50">
                <Database className="w-8 h-8 text-blue-500" />
            </div>
            <div>
                <h1 className="text-2xl font-bold text-white">Configuração do Banco de Dados</h1>
                <p className="text-slate-400 text-sm">
                   O Finora detectou que as tabelas necessárias não existem. Use o script abaixo para criar a estrutura completa.
                </p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
           <div className="bg-amber-900/20 border border-amber-900/50 p-4 rounded-xl flex gap-3 items-start">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-200">
                  <strong>Atenção:</strong> Este script cria tabelas, Views e configura a segurança (RLS). Execute-o no SQL Editor do seu projeto Supabase.
              </div>
           </div>
           <div className="bg-emerald-900/20 border border-emerald-900/50 p-4 rounded-xl flex gap-3 items-start">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-sm text-emerald-200">
                  <strong>Inclui:</strong> Lançamentos, Cartões, Metas, Orçamentos, Dívidas, Fechamentos e Relatórios Avançados.
              </div>
           </div>
        </div>
        
        <div className="relative flex-1 min-h-0 border border-slate-700 rounded-xl overflow-hidden bg-[#0B111A]">
          <pre className="p-4 text-xs text-slate-400 font-mono h-full overflow-y-auto custom-scrollbar leading-relaxed select-all">
            {sql}
          </pre>
          <button 
            onClick={copyToClipboard}
            className="absolute top-4 right-4 bg-[#9A4DFF] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#8339ea] flex items-center gap-2 shadow-lg z-10 transition-all hover:scale-105"
          >
            <Copy className="w-3 h-3" /> Copiar SQL
          </button>
        </div>

        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex gap-4">
             <a 
                href="https://supabase.com/dashboard/project/_/sql" 
                target="_blank" 
                rel="noreferrer" 
                className="text-sm text-[#9A4DFF] hover:underline flex items-center gap-1 font-medium"
              >
                Abrir Supabase SQL <ExternalLink className="w-3 h-3" />
              </a>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto bg-[#00D084] text-[#0B111A] px-6 py-3 rounded-xl font-bold hover:bg-[#00b371] flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
          >
            <RefreshCw className="w-4 h-4" /> Já executei, Iniciar App
          </button>
        </div>
      </div>
    </div>
  );
};
