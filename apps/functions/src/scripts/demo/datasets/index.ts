import type { TenantNicheId } from "../../../shared/niches";
import type { DemoDataset } from "../types";
import { automacaoResidencialDemo } from "./automacao_residencial";
import { cortinasDemo } from "./cortinas";
import { segurancaEletronicaDemo } from "./seguranca_eletronica";
import { vidracariaEsquadriasDemo } from "./vidracaria_esquadrias";
import { moveisPlanejadosDemo } from "./moveis_planejados";

/**
 * A demonstração de cada nicho. O `Record` faz o compilador cobrar o dataset
 * de um nicho novo; sem ele, a conta free do nicho navegaria uma demonstração
 * vazia.
 */
export const DEMO_DATASETS: Record<TenantNicheId, DemoDataset> = {
  automacao_residencial: automacaoResidencialDemo,
  cortinas: cortinasDemo,
  seguranca_eletronica: segurancaEletronicaDemo,
  vidracaria_esquadrias: vidracariaEsquadriasDemo,
  moveis_planejados: moveisPlanejadosDemo,
};
