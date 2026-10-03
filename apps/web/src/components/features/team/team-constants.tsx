import { Eye, Edit3, Shield, User, Settings, Wrench } from "lucide-react";

export const roleConfig = {
  viewer: {
    icon: Eye,
    color: "from-blue-500 to-blue-600",
    bgColor: "bg-blue-500",
    lightBg: "bg-blue-500/10",
    borderColor: "border-blue-500",
    textColor: "text-blue-600 dark:text-blue-400",
  },
  editor: {
    icon: Edit3,
    color: "from-amber-500 to-orange-500",
    bgColor: "bg-amber-500",
    lightBg: "bg-amber-500/10",
    borderColor: "border-amber-500",
    textColor: "text-amber-600 dark:text-amber-400",
  },
  admin: {
    icon: Shield,
    color: "from-purple-500 to-indigo-500",
    bgColor: "bg-purple-500",
    lightBg: "bg-purple-500/10",
    borderColor: "border-purple-500",
    textColor: "text-purple-600 dark:text-purple-400",
  },
  technician: {
    icon: Wrench,
    color: "from-teal-500 to-emerald-600",
    bgColor: "bg-teal-500",
    lightBg: "bg-teal-500/10",
    borderColor: "border-teal-500",
    textColor: "text-teal-600 dark:text-teal-400",
  },
};

export const steps = [
  {
    id: "info",
    title: "Informações",
    description: "Dados do membro",
    icon: User,
  },
  {
    id: "role",
    title: "Nível de Acesso",
    description: "Permissões base",
    icon: Shield,
  },
  {
    id: "permissions",
    title: "Personalizar",
    description: "Ajustes finos",
    icon: Settings,
  },
];
