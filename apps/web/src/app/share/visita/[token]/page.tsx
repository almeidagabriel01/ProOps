"use client";

import { useParams } from "next/navigation";
import { PublicBooking } from "./_components/public-booking";

/** Página pública do link de agendamento: o cliente escolhe o horário e pede a visita. */
export default function PublicBookingPage() {
  const params = useParams();
  return <PublicBooking token={String(params.token || "")} />;
}
