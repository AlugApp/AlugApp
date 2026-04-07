import { createClient } from '@supabase/supabase-js';

// Instância única do cliente Supabase — importe daqui em todos os arquivos
export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_TOKEN!
);
