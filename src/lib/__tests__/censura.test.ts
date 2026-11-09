import { censurarTexto, contemPalavraProibida } from '../censura';

// RF029 / RNF012 — moderação automática de mensagens do chat
describe('Censura de conteúdo do chat (RF029, RNF012)', () => {
  test('[AUT-012] censura palavras proibidas sem diferenciar maiúsculas, preservando o tamanho', () => {
    expect(censurarTexto('que merda isso')).toBe('que ***** isso');
    expect(censurarTexto('Seu IDIOTA!')).toBe('Seu ******!');
    expect(censurarTexto('babaca, otário.')).toBe('******, ******.');
  });

  test('[AUT-013] não censura palavras legítimas que contêm um termo proibido (falso positivo)', () => {
    // Regressão do bug encontrado nos testes internos: "cu" e "puta" eram casados como substring.
    const frase = 'Tenha cuidado com o documento do computador e a disputa do curso';
    expect(censurarTexto(frase)).toBe(frase);
    expect(contemPalavraProibida(frase)).toBe(false);
    expect(censurarTexto('Disponível para locação')).toBe('Disponível para locação');
  });

  test('[AUT-014] contemPalavraProibida identifica mensagens que devem ser moderadas', () => {
    expect(contemPalavraProibida('olá, tudo bem?')).toBe(false);
    expect(contemPalavraProibida('vai se foder')).toBe(true);
    expect(contemPalavraProibida('FDP')).toBe(true);
    expect(contemPalavraProibida('')).toBe(false);
  });
});
