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
    .replace(/[\u0300-\u036f]/g, "");

const inferTitleByMessage = (
  message: string,
  variant: ToastVariant,
  fallbackTitle: string,
) => {
  const text = normalizeText(message);
  const isDeleteAction = /(exclu|remov|delet)/.test(text);
  const isEditAction = /(edit|atualiz|alter)/.test(text);
  const isCreateAction = /(cri|cadast|adicion|inclu)/.test(text);
  const isSaveAction = /(salv)/.test(text);

  if (variant === "success") {
    if (isDeleteAction) return "Sucesso ao excluir";
    if (isEditAction || isSaveAction) return "Sucesso ao editar";
    if (isCreateAction) return "Sucesso ao criar";
    return "Sucesso";
  }

  if (variant === "error") {
    if (isDeleteAction) return "Erro ao excluir";
    if (isEditAction) return "Erro ao editar";
    if (isSaveAction) return "Erro ao salvar";
    if (isCreateAction) return "Erro ao criar";
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
  const message = content instanceof Error ? content.message : String(content);
  const inferredTitle = inferTitleByMessage(message, variant, defaultTitle);

  return {
    title: options?.title || inferredTitle,
    description: options?.description || message,
    ...options,
  };
};

/**
 * Backward-compatible wrapper for react-toastify using sileo
 */
const toastFn = (content: unknown, options?: ToastOptions) => {
  return sileo.info(getToastConfig("Informacao", "info", content, options));
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
  return sileo.info(getToastConfig("Informacao", "info", content, options));
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
      description: messages.pending || "Aguarde...",
    },
    success: { title: "Sucesso", description: messages.success },
    error: { title: "Erro", description: messages.error || "Ocorreu um erro." },
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
    if (options.type === "success") toastFn.success(options.render);
    else if (options.type === "error") toastFn.error(options.render);
    else if (options.type === "warning") toastFn.warning(options.render);
    else toastFn.info(options.render);
  }
};

export const toast = toastFn;
