"use client";

import { useParams } from "next/navigation";
import { PublicAccountant } from "./_components/public-accountant";

/** Link do contador: DRE, lançamentos e notas da empresa, só leitura. */
export default function AccountantPage() {
  const params = useParams();
  return <PublicAccountant token={String(params.token || "")} />;
}
