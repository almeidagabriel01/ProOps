/**
 * As tarefas do card "Primeiros passos" do Dashboard. Diferente do tour, que
 * apresenta telas, aqui cada item é uma coisa a FAZER, e ele se marca sozinho
 * quando o dado aparece (um produto cadastrado, uma proposta criada).
 *
 * Só existe em conta paga: na demonstração nada pode ser criado.
 */

export interface FirstStepsCounts {
  products: number;
  services: number;
  clients: number;
  proposals: number;
  members: number;
}

export interface FirstStepsViewer {
  isMaster: boolean;
  hasPermission: (pageId: string, action: "view" | "create") => boolean;
  /** Teto de usuários do plano; -1 é ilimitado. */
  maxUsers: number;
  hasLogo: boolean;
}

export interface FirstStepsTask {
  id: "catalog" | "contact" | "proposal" | "team" | "brand";
  title: string;
  description: string;
  href: string;
  done: boolean;
}

export function buildFirstStepsTasks(
  counts: FirstStepsCounts,
  viewer: FirstStepsViewer,
): FirstStepsTask[] {
  const can = (pageId: string) =>
    viewer.isMaster || viewer.hasPermission(pageId, "create");
  const tasks: FirstStepsTask[] = [];

  if (can("products") || can("services")) {
    tasks.push({
      id: "catalog",
      title: "Cadastre um produto ou serviço",
      description: "É dele que a proposta é montada.",
      href: can("products") ? "/products/new" : "/services/new",
      done: counts.products + counts.services > 0,
    });
  }

  if (can("clients")) {
    tasks.push({
      id: "contact",
      title: "Cadastre o seu primeiro cliente",
      description: "Nome e telefone já bastam para começar.",
      href: "/contacts/new",
      done: counts.clients > 0,
    });
  }

  if (can("proposals")) {
    tasks.push({
      id: "proposal",
      title: "Crie a sua primeira proposta",
      description: "Escolha o cliente, os itens e baixe o PDF.",
      href: "/proposals/new",
      done: counts.proposals > 0,
    });
  }

  if (viewer.isMaster) {
    tasks.push({
      id: "brand",
      title: "Coloque a sua logo",
      description: "Ela aparece no PDF de toda proposta.",
      href: "/profile",
      done: viewer.hasLogo,
    });
  }

  // Só quando o plano tem vaga além do próprio dono: convidar sem poder
  // adicionar ninguém seria um upsell disfarçado de tarefa.
  if (viewer.isMaster && (viewer.maxUsers === -1 || viewer.maxUsers > 1)) {
    tasks.push({
      id: "team",
      title: "Convide a sua equipe",
      description: "Cada pessoa com o acesso que você escolher.",
      href: "/settings/team",
      done: counts.members > 0,
    });
  }

  return tasks;
}
