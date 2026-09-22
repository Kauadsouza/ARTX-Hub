-- Espelho do Relatório do Kauã na conta.
--
-- Por que esta migração existe: as anotações, a checklist da Espanha e a
-- validade de cada documento viviam só no localStorage de um navegador. Limpar
-- os dados do site apagava tudo — inclusive a lista que se pretende acumular
-- por meses até a candidatura. Um HD queimado levava junto.
--
-- Aditiva e reversível: nenhuma linha existente é tocada. A única mudança é
-- permitir mais um valor na coluna `app`, que hoje aceita só 'study' e
-- 'university'. O resto da tabela, das políticas e da função de gravação
-- continua exatamente como está.
--
-- Rodar no editor SQL do Supabase. Rodar duas vezes não faz mal.

begin;

alter table public.hub_app_state
  drop constraint if exists hub_app_state_app_check;

alter table public.hub_app_state
  add constraint hub_app_state_app_check
  check (app in ('study', 'university', 'relatorio'));

commit;
