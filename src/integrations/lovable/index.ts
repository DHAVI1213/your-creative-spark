import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { supabase } from "../supabase/client";

/** Login com Google pelo Lovable Cloud (o Google gerenciado não funciona chamando o Supabase direto). */
const lovableAuth = createLovableAuth();

export async function entrarComGoogle(destino = window.location.href) {
  const r = await lovableAuth.signInWithOAuth("google", { redirect_uri: destino });
  if (r.redirected) return null;
  if (r.error) return r.error.message;
  const { error } = await supabase.auth.setSession(r.tokens);
  return error?.message ?? null;
}
