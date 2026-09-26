"use client";

import { useParams } from "next/navigation";
import { PublicClientPortal } from "./_components/public-client-portal";

/** Portal do cliente: propostas, pagamentos, obra e notas de um contato. */
export default function ClientPortalPage() {
  const params = useParams();
  return <PublicClientPortal token={String(params.token || "")} />;
}
