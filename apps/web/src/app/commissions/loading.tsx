import { CommissionsSkeleton } from "./_components/commissions-skeleton";

// Mesma tela que a página mostra ao carregar: o clique no menu dá retorno na
// hora, em vez de esperar a resposta do servidor sem mudar nada.
export default function Loading() {
  return <CommissionsSkeleton />;
}
