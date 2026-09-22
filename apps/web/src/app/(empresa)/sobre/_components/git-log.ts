import type { Marco } from "@/app/(empresa)/institucional/_content/institucional-copy";

/**
 * O "git log" do herói de /sobre, como dado.
 *
 * Os marcos da empresa viram commits. O hash é derivado do título por FNV-1a,
 * e não sorteado: estável entre servidor e cliente (sem aviso de hidratação),
 * estável entre deploys (o mesmo marco tem sempre o mesmo hash) e único entre
 * os marcos, o que o teste confere.
 *
 * A única licença é o ramo: o último marco, o aplicativo, sai num ramo próprio
 * a partir do marco anterior, e é assim que a história aconteceu. O ERP seguiu
 * no tronco; o aplicativo nasceu da mesma base, ao lado dele.
 */

export interface Commit {
  hash: string;
  titulo: string;
  ano: string;
  /** 0 é o tronco (o ERP), 1 é o ramo do aplicativo. */
  trilha: 0 | 1;
  /** A etiqueta de ramo, onde houver uma: a ponta de cada produto. */
  ramo?: "erp" | "aplicativo";
}

/** FNV-1a de 32 bits, em hexadecimal de sete dígitos, como um hash curto do git. */
export function hashCurto(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0").slice(0, 7);
}

/**
 * Do mais novo para o mais antigo, como o `git log` mostra. O último marco vai
 * para o ramo do aplicativo; o penúltimo é a ponta do ERP.
 */
export function commitsDosMarcos(marcos: readonly Marco[]): Commit[] {
  const ultimo = marcos.length - 1;
  return marcos
    .map((marco, i): Commit => ({
      hash: hashCurto(marco.titulo),
      titulo: marco.titulo,
      ano: marco.ano,
      trilha: i === ultimo ? 1 : 0,
      ramo: i === ultimo ? "aplicativo" : i === ultimo - 1 ? "erp" : undefined,
    }))
    .reverse();
}
