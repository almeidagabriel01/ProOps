/**
 * Navegação de página inteira, fora do router do Next.
 *
 * Existe para um caso específico: sair do interstitial `/auth/refresh` depois
 * de re-emitir o cookie de sessão. Ali o `router.replace` do Next **não serve**,
 * porque o cliente guarda em cache a resposta da rota que acabou de ser negada:
 * a requisição que mandou o usuário para o interstitial foi um `307` de
 * `/proposals`, e o `replace` de volta para `/proposals` reproduz esse mesmo
 * `307` do cache, sem nenhuma ida ao servidor. O cookie novo nunca chega a ser
 * testado, o interstitial volta para si mesmo, e só o watchdog de 10s quebra o
 * laço, jogando o usuário no `/login` e, de lá, na home do papel dele.
 *
 * Uma navegação dura descarta esse cache por construção e ainda remonta os
 * providers com uma sessão válida, que é exatamente o que se quer depois de
 * recuperar uma sessão. O custo é um reload, irrelevante numa tela cujo trabalho
 * inteiro é sair dela.
 *
 * Fica num módulo próprio para ser substituível em teste: `window.location` não
 * é configurável no jsdom.
 */
export function hardRedirect(url: string): void {
  window.location.replace(url);
}
