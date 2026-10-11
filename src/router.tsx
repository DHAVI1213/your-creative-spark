import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Mantém dados em cache por 3 minutos antes de considerar obsoletos
        staleTime: 1000 * 60 * 3,
        // Mantém os dados na memória por 10 minutos
        gcTime: 1000 * 60 * 10,
        // Evita refetch desnecessário ao alternar abas no navegador
        refetchOnWindowFocus: false,
        // Tenta reconectar apenas 1 vez em caso de oscilação de rede
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Pré-carrega a página quando o usuário passa o mouse ou toca no link
    defaultPreload: "intent",
    // Tempo que a rota pré-carregada permanece válida em cache
    defaultPreloadStaleTime: 1000 * 60 * 2,
    // Delay de 50ms para evitar requisições com movimentos acidentais de cursor
    defaultPreloadDelay: 50,
  });

  return router;
};
