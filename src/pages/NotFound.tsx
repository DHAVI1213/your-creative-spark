import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center">
      <p className="text-6xl font-bold text-lime">404</p>
      <h1 className="mt-4 text-2xl font-bold">Página não encontrada</h1>
      <p className="mt-2 text-tsecondary">O link que você abriu não existe ou foi movido.</p>
      <Link to="/" className="mt-6 rounded-xl bg-lime px-6 py-3 font-semibold text-black">
        Voltar ao início
      </Link>
    </div>
  );
}
