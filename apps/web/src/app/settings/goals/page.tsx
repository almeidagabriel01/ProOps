import { redirect } from "next/navigation";

// As metas saíram de Configurações para o grupo Financeiro. O endereço antigo
// continua valendo para quem o guardou.
export default function SettingsGoalsPage() {
  redirect("/goals");
}
