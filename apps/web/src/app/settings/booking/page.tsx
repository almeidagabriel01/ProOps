import { redirect } from "next/navigation";

// O link de agendamento saiu de Configurações para o grupo Agenda. O endereço
// antigo continua valendo para quem o guardou.
export default function SettingsBookingPage() {
  redirect("/booking");
}
