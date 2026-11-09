// ─── Lista de palavras censuradas ────────────────────────────────────────────
// Adicione ou remova palavras neste array para controlar o filtro de conteúdo.
// As palavras são verificadas sem distinção de maiúsculas/minúsculas.
export const PALAVRAS_CENSURADAS: string[] = [
  // Palavrões comuns (pt-BR)
  "merda",
  "porra",
  "caralho",
  "foda",
  "foder",
  "fdp",
  "viado",
  "puta",
  "putaria",
  "buceta",
  "piroca",
  "cu",
  "cuzão",
  "arrombado",
  "vagabundo",
  "vagabunda",
  "imbecil",
  "idiota",
  "cretino",
  "babaca",
  "otário",
  // Adicione mais palavras abaixo:
];

// ─── Funções utilitárias ──────────────────────────────────────────────────────

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Casa a palavra apenas como palavra inteira (nunca dentro de outra palavra),
 * considerando letras acentuadas. Ex.: "cu" não casa em "cuidado" ou "documento".
 */
const palavraRegex = (palavra: string, flags: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(palavra)}(?![\\p{L}\\p{N}])`, flags);

/**
 * Substitui palavras proibidas por asteriscos no texto.
 * Ex: "que merda isso" → "que ***** isso"
 */
export function censurarTexto(texto: string): string {
  let resultado = texto;
  for (const palavra of PALAVRAS_CENSURADAS) {
    resultado = resultado.replace(palavraRegex(palavra, "giu"), (match) => "*".repeat(match.length));
  }
  return resultado;
}

/**
 * Retorna true se o texto contiver alguma palavra proibida.
 * Útil para bloquear envio em vez de apenas censurar.
 */
export function contemPalavraProibida(texto: string): boolean {
  return PALAVRAS_CENSURADAS.some((p) => palavraRegex(p, "iu").test(texto));
}
