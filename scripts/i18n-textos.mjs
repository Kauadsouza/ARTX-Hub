/**
 * Os textos do Hub que o catálogo inglês não cobre.
 *
 * Lê o código com o parser do TypeScript — regex se perde em aspas dentro de
 * expressões regulares e em apóstrofos — e separa dois grupos:
 *
 *   chaves   o primeiro argumento literal de t(), traduzir() e traduzirTela().
 *            Toda chave precisa de inglês; o teste de i18n cobra isso.
 *   soltos   texto JSX e literais com cara de frase que não passam por t().
 *            Serve para achar o que falta embrulhar; nem tudo aqui é erro
 *            (nomes próprios, texto do prompt da Jade, logs).
 *
 * Uso: node scripts/i18n-textos.mjs [--soltos]
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const catalogo = JSON.parse(readFileSync(join(RAIZ, "src/lib/en.json"), "utf8"));
const normal = (texto) => texto.replace(/\s+/g, " ").trim();
const FUNCOES = new Set(["t", "traduzir", "traduzirTela"]);

function arquivos(pasta) {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return nome === "api" ? [] : arquivos(caminho);
    return /\.(ts|tsx)$/.test(nome) && !nome.endsWith(".d.ts") ? [caminho] : [];
  });
}

/** Os literais de texto dentro de uma expressão (os dois lados de um ternário, por exemplo). */
function literaisDe(no) {
  if (ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) return [no.text];
  if (ts.isConditionalExpression(no)) return [...literaisDe(no.whenTrue), ...literaisDe(no.whenFalse)];
  if (ts.isParenthesizedExpression(no)) return literaisDe(no.expression);
  if (ts.isBinaryExpression(no) && no.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) return literaisDe(no.right);
  return [];
}

export function varrer() {
  const chaves = new Map();
  const soltos = [];
  for (const arquivo of arquivos(join(RAIZ, "src"))) {
    const rel = relative(RAIZ, arquivo).replaceAll("\\", "/");
    const fonte = ts.createSourceFile(arquivo, readFileSync(arquivo, "utf8"), ts.ScriptTarget.Latest, true, arquivo.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const linha = (no) => fonte.getLineAndCharacterOfPosition(no.getStart(fonte)).line + 1;
    const dentroDeT = new Set();

    const visitar = (no) => {
      if (ts.isCallExpression(no) && ts.isIdentifier(no.expression) && FUNCOES.has(no.expression.text) && no.arguments.length) {
        for (const texto of literaisDe(no.arguments[0])) {
          if (/[A-Za-zÀ-ú]/.test(texto) && !chaves.has(normal(texto))) chaves.set(normal(texto), `${rel}:${linha(no)}`);
        }
        dentroDeT.add(no.arguments[0]);
      }
      if (ts.isJsxText(no) && /[A-Za-zÀ-ú]{2}/.test(no.text)) {
        soltos.push({ onde: `${rel}:${linha(no)}`, texto: normal(no.text), tipo: "jsx" });
      }
      if ((ts.isStringLiteral(no) || ts.isNoSubstitutionTemplateLiteral(no)) && !ts.isImportDeclaration(no.parent) && !ts.isExportDeclaration(no.parent)) {
        let pai = no.parent;
        let emT = false;
        while (pai && !ts.isSourceFile(pai)) { if (dentroDeT.has(pai) || dentroDeT.has(no)) { emT = true; break; } pai = pai.parent; }
        const atributo = ts.isJsxAttribute(no.parent) ? no.parent.name.getText(fonte) : null;
        const texto = normal(no.text);
        const frase = /[À-ú]/.test(texto) || /[A-Za-zÀ-ú]{2,} [A-Za-zÀ-ú]{2,}/.test(texto);
        if (!emT && frase && atributo !== "className" && !/^use (client|server)$/.test(texto)) {
          soltos.push({ onde: `${rel}:${linha(no)}`, texto, tipo: atributo ? `attr:${atributo}` : "literal" });
        }
      }
      ts.forEachChild(no, visitar);
    };
    visitar(fonte);
  }
  return { chaves, soltos };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { chaves, soltos } = varrer();
  const faltando = [...chaves].filter(([chave]) => !(chave in catalogo));
  console.log(`${chaves.size} chaves; ${faltando.length} sem inglês`);
  for (const [chave, onde] of faltando) console.log(`  CHAVE ${onde}  ${chave}`);
  if (process.argv.includes("--soltos")) {
    const fora = soltos.filter(({ texto }) => !(texto in catalogo));
    console.log(`\n${fora.length} textos fora de t() e do catálogo`);
    for (const { onde, texto, tipo } of fora) console.log(`  ${tipo.padEnd(18)} ${onde}  ${texto}`);
  }
}
