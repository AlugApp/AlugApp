import CryptoJS from 'crypto-js';

const KEY = process.env.REACT_APP_ENCRYPTION_KEY || '';

export const encrypt = (text: string): string => {
  if (!text || !KEY) return text;
  return CryptoJS.AES.encrypt(text, KEY).toString();
};

export const decrypt = (ciphertext: string): string => {
  if (!ciphertext || !KEY) return ciphertext;
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, KEY);
    const result = bytes.toString(CryptoJS.enc.Utf8);
    return result || ciphertext;
  } catch {
    return ciphertext;
  }
};

export const hashCPF = (cpf: string): string =>
  CryptoJS.SHA256(cpf.replace(/\D/g, '')).toString();
