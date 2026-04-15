import { createClient } from '@supabase/supabase-js';

// Instância única do cliente Supabase — importe daqui em todos os arquivos
console.log("Supabase URL carregada:", !!process.env.REACT_APP_SUPABASE_URL);
console.log("Supabase Token carregado:", !!process.env.REACT_APP_SUPABASE_TOKEN);

export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL || '',
  process.env.REACT_APP_SUPABASE_TOKEN || ''
);
