import type { Task, TaskPerson } from "@/types/task";

/** Hoje no fuso de Brasília, no formato do prazo (YYYY-MM-DD). */
export function todayInBrazil(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export type TaskBucket = "overdue" | "today" | "upcoming" | "none" | "done";

export function taskBucket(task: Pick<Task, "doneAt" | "dueAt">, today: string): TaskBucket {
  if (task.doneAt) return "done";
  if (!task.dueAt) return "none";
  if (task.dueAt < today) return "overdue";
  if (task.dueAt === today) return "today";
  return "upcoming";
}

export const TASK_BUCKETS: Array<{ id: Exclude<TaskBucket, "done">; label: string }> = [
  { id: "overdue", label: "Atrasadas" },
  { id: "today", label: "Hoje" },
  { id: "upcoming", label: "Próximas" },
  { id: "none", label: "Sem prazo" },
];

/** "Minha": atribuída a mim, ou criada por mim sem responsável. */
export function isMyTask(task: Pick<Task, "assigneeId" | "createdBy">, uid: string): boolean {
  return task.assigneeId === uid || (!task.assigneeId && task.createdBy === uid);
}

export type TaskFilter = "mine" | "created" | "all" | "done";

export function filterTasks(tasks: Task[], filter: TaskFilter, uid: string): Task[] {
  switch (filter) {
    case "mine":
      return tasks.filter((t) => !t.doneAt && isMyTask(t, uid));
    case "created":
      return tasks.filter((t) => !t.doneAt && t.createdBy === uid);
    case "done":
      return tasks.filter((t) => Boolean(t.doneAt));
    default:
      return tasks.filter((t) => !t.doneAt);
  }
}

/** Ordem dentro de um grupo: prazo mais próximo primeiro, depois as mais novas. */
export function sortOpenTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const due = String(a.dueAt ?? "9999").localeCompare(String(b.dueAt ?? "9999"));
    return due !== 0 ? due : String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""));
  });
}

/** "26/09" a partir de "2026-09-26". */
export function formatDue(dueAt: string | null): string | null {
  if (!dueAt) return null;
  const [, month, day] = dueAt.split("-");
  return day && month ? `${day}/${month}` : null;
}

/**
 * Quem continua citado no texto. A menção é escolhida na lista (o "@" abre as
 * pessoas), mas vale o que ficou escrito: apagar "@Ana" do texto tira a Ana.
 */
export function mentionedUids(text: string, candidates: TaskPerson[]): string[] {
  return candidates.filter((p) => text.includes(`@${p.name}`)).map((p) => p.id);
}

/** O "@termo" que está sendo digitado antes do cursor, ou null. */
export function activeMentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  // O "@" precisa abrir palavra: e-mail ("ana@empresa") não é menção.
  if (at > 0 && !/\s/.test(before[at - 1])) return null;
  const query = before.slice(at + 1);
  if (query.length > 30 || /\n/.test(query)) return null;
  return { start: at, query };
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function matchPeople(people: TaskPerson[], query: string): TaskPerson[] {
  const q = normalize(query.trim());
  return people.filter((p) => normalize(p.name).split(/\s+/).some((w) => w.startsWith(q)) || normalize(p.name).startsWith(q));
}
