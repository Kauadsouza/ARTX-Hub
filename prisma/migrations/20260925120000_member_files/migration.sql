-- Arquivos guardados por conta e por sistema.
--
-- Nasceu para os certificados de curso: a emissão continua sendo do provedor
-- (Harvard, freeCodeCamp), mas o arquivo precisa ficar em algum lugar que
-- siga a pessoa em vez do navegador.
--
-- Fica no banco, e não num serviço de arquivos, porque a pergunta era
-- resolver isso sem configurar mais nada. Certificado é um PDF de algumas
-- centenas de kB; o teto de 1,4 MB está no código e o pedido inteiro já é
-- limitado a 2 MB antes de o corpo ser lido.
--
-- O CHECK de `app` repete o das outras tabelas: sistema que não existe não
-- guarda arquivo.

CREATE TABLE IF NOT EXISTS public."MemberFile" (
  id TEXT PRIMARY KEY,
  principal TEXT NOT NULL,
  app TEXT NOT NULL CHECK (app IN ('hub', 'videos', 'study', 'university', 'cursos')),
  chave TEXT NOT NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  tamanho INTEGER NOT NULL,
  conteudo BYTEA NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Um arquivo por chave, por pessoa, por sistema: anexar de novo substitui.
CREATE UNIQUE INDEX IF NOT EXISTS "MemberFile_principal_app_chave_key"
  ON public."MemberFile"(principal, app, chave);

CREATE INDEX IF NOT EXISTS "MemberFile_principal_app_idx"
  ON public."MemberFile"(principal, app);
