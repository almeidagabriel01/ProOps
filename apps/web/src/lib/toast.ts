import { sileo } from "sileo";

// Mock types to maintain backward compatibility with react-toastify imports
export type Id = string | number;
export interface ToastOptions {
  description?: string;
  title?: string;
  [key: string]: unknown;
}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ToastContent {}

type ToastVariant = "success" | "error" | "warning" | "info";

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "");

const statusLabelByCode: Record<string, string> = {
  paid: "pago",
  pending: "pendente",
  overdue: "atrasado",
  active: "ativo",
  inactive: "inativo",
  approved: "aprovado",
  draft: "rascunho",
  sent: "enviado",
  canceled: "cancelado",
  cancelled: "cancelado",
  unpaid: "não pago",
  trialing: "em teste",
};

const localizeStatusCodes = (value: string) =>
  value.replace(
    /\b(paid|pending|overdue|active|inactive|approved|draft|sent|canceled|cancelled|unpaid|trialing)\b/gi,
    (match) => {
      const label = statusLabelByCode[match.toLowerCase()];
      return label || match;
    },
  );

const inferTitleByMessage = (
  message: string,
  variant: ToastVariant,
  fallbackTitle: string,
) => {
  const text = normalizeText(message);
  const isDeleteAction = /(exclu|remov|delet)/.test(text);
  const isEditAction = /(edit|atualiz|alter|modif)/.test(text);
  const isCreateAction = /(cri|cadast|adicion|inclu|creat|add)/.test(text);
  const isSaveAction = /(salv|save)/.test(text);
  const isLoadAction = /(carreg|load|fetch)/.test(text);

  if (variant === "success") {
    if (isDeleteAction) return "Sucesso ao excluir";
    if (isEditAction) return "Sucesso ao editar";
    if (isCreateAction) return "Sucesso ao criar";
    if (isSaveAction) return "Sucesso ao salvar";
    return "Sucesso";
  }

  if (variant === "error") {
    if (isDeleteAction) return "Erro ao excluir";
    if (isEditAction) return "Erro ao editar";
    if (isCreateAction) return "Erro ao criar";
    if (isSaveAction) return "Erro ao salvar";
    if (isLoadAction) return "Erro ao carregar";
    return "Erro";
  }

  return fallbackTitle;
};

const getToastConfig = (
  defaultTitle: string,
  variant: ToastVariant,
  content: unknown,
  options?: ToastOptions,
) => {
  const rawMessage = content instanceof Error ? content.message : String(content);
  const message = localizeStatusCodes(rawMessage);
  const title = options?.title ? localizeStatusCodes(options.title) : undefined;
  const description = options?.description
    ? localizeStatusCodes(options.description)
    : undefined;

  return {
    ...options,
    title:
      title ||
      inferTitleByMessage(message, variant, defaultTitle),
    description: description || message,
  };
};

/**
 * Backward-compatible wrapper for react-toastify using sileo
 */
const toastFn = (content: unknown, options?: ToastOptions) => {
  return sileo.info(getToastConfig("Informação", "info", content, options));
};

toastFn.success = (content: unknown, options?: ToastOptions) => {
  return sileo.success(getToastConfig("Sucesso", "success", content, options));
};

toastFn.error = (content: unknown, options?: ToastOptions) => {
  return sileo.error(getToastConfig("Erro", "error", content, options));
};

toastFn.warn = (content: unknown, options?: ToastOptions) => {
  return sileo.warning(getToastConfig("Atencao", "warning", content, options));
};

toastFn.warning = (content: unknown, options?: ToastOptions) => {
  return sileo.warning(getToastConfig("Atencao", "warning", content, options));
};

toastFn.info = (content: unknown, options?: ToastOptions) => {
  return sileo.info(getToastConfig("Informação", "info", content, options));
};

toastFn.promise = async <T>(
  promise: Promise<T> | (() => Promise<T>),
  messages: { pending?: string; success?: string; error?: string },
  _options?: ToastOptions,
) => {
  void _options;

  return sileo.promise<T>(promise, {
    loading: {
      title: "Carregando...",
      description: localizeStatusCodes(messages.pending || "Aguarde..."),
    },
    success: {
      title: "Sucesso",
      description: messages.success
        ? localizeStatusCodes(messages.success)
        : undefined,
    },
    error: {
      title: "Erro",
      description: localizeStatusCodes(messages.error || "Ocorreu um erro."),
    },
  });
};

toastFn.dismiss = (id?: Id) => {
  if (id) {
    sileo.dismiss(id.toString());
  } else {
    sileo.clear();
  }
};

toastFn.isActive = (_id: Id) => {
  void _id;
  return false; // sileo does not provide this by default
};

toastFn.update = (
  id: Id,
  options: ToastOptions & {
    render?: string;
    type?: "success" | "error" | "info" | "warning";
  },
) => {
  sileo.dismiss(id.toString());
  if (options.render) {
    const render = localizeStatusCodes(options.render);
    if (options.type === "success") toastFn.success(render);
    else if (options.type === "error") toastFn.error(render);
    else if (options.type === "warning") toastFn.warning(render);
    else toastFn.info(render);
  }
};

export const toast = toastFn;
