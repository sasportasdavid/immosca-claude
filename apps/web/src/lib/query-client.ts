// TanStack Query client factory.
//
// Une factory plutôt qu'un singleton global pour deux raisons :
// - Tests : chaque test peut créer son propre client isolé.
// - Cohérence : même pattern que initSentry()/initPostHog() (cf
//   commit aeeaed2 / 77b2e31), un module par dépendance externe.

import { QueryClient } from "@tanstack/react-query";

/**
 * Crée un QueryClient TanStack Query avec les defaults ImmoScan.
 *
 * Choix :
 * - `staleTime: 60s` : la plupart des données (profile, user_params,
 *   liste d'analyses) changent rarement à la minute. Évite des refetch
 *   inutiles sur les transitions de route. Les données vraiment live
 *   (progression d'une analyse en cours) passent par Supabase Realtime,
 *   pas par React Query.
 * - `gcTime: 5min` : les caches inactifs restent 5 min en mémoire avant
 *   GC. Modéré sur la consommation mémoire d'une SPA d'analyse longue.
 * - `retry: 1` : un retry sur erreur réseau, pas plus. Les vraies erreurs
 *   (4xx/5xx persistantes) doivent remonter à Sentry rapidement, pas
 *   être masquées par des retries en cascade.
 * - `refetchOnWindowFocus: false` : trop bavard sur une SPA où l'user
 *   passe entre onglets / fenêtres sans vouloir tout re-fetcher.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}
