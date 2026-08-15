import { createMiddleware } from '@tanstack/react-start';
import { supabase } from './app-client';

// Anexa o token do projeto Supabase ativo às chamadas de server functions.
export const attachSupabaseAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
