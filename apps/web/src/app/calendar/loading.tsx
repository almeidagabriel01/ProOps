import { CalendarSkeleton } from "./_components/calendar-skeleton";

// Mesma tela que a página mostra ao carregar: o clique no menu dá retorno na
// hora, em vez de esperar a resposta do servidor sem mudar nada.
// Também é o Suspense que o `useSearchParams` da agenda exige.
export default function Loading() {
  return <CalendarSkeleton />;
}
