"use client";

import { callApi } from "@/lib/api-client";

export interface TeamPerson {
  id: string;
  name: string;
}

/** As pessoas da empresa, para escolher quem cuida de um cliente ou de uma venda. Todos os planos. */
export const TeamService = {
  async people(): Promise<TeamPerson[]> {
    const response = await callApi<{ people: TeamPerson[] }>("/v1/team/people", "GET");
    return response.people ?? [];
  },
};
