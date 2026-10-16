import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { Button, Card, Input, Label } from "../components/ui";
import { SiteHeader } from "../components/Layout";

export default function Login() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [modo, setModo] = useState<"entrar" | "cadastrar">("cadastrar");
  const { entrar } = useAuth();
  const nav = useNavigate();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    entrar(nome.trim() || email.split("@")[0]!, email.trim());
    nav("/app");
  };

  return (
    <div className="min-h-screen bg-bg">
      <SiteHeader />
      <div className="mx-auto flex max-w-md flex-col px-6 py-20">
        <div className="mb-8 text-center">
          <img src="/logo.webp" alt="NK Software" className="mx-auto h-16 w-16 rounded-2xl object-cover" />
          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            {modo === "cadastrar" ? "Crie sua conta grátis" : "Bem-vindo de volta"}
          </h1>
          <p className="mt-2 text-tsecondary">Leva menos de 1 minuto. Sem cartão.</p>
        </div>
        <Card>
          <form onSubmit={submit} className="space-y-4">
            {modo === "cadastrar" && (
              <div>
                <Label>Seu nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como podemos te chamar?" />
              </div>
            )}
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
              />
            </div>
            <Button type="submit" className="w-full">
              {modo === "cadastrar" ? "Criar conta" : "Entrar"}
            </Button>
          </form>
          <button
            onClick={() => setModo(modo === "cadastrar" ? "entrar" : "cadastrar")}
            className="mt-4 w-full text-center text-sm text-tsecondary hover:text-lime cursor-pointer"
          >
            {modo === "cadastrar" ? "Já tem conta? Entrar" : "Ainda não tem conta? Cadastrar"}
          </button>
        </Card>
        <p className="mt-6 text-center text-xs text-tmuted">
          <Link to="/" className="hover:text-tsecondary">← Voltar para o início</Link>
        </p>
      </div>
    </div>
  );
}
