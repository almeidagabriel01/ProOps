// Vitest global setup — extend as needed for DOM matchers or global mocks.

/**
 * Shim de `localStorage` para o ambiente jsdom.
 *
 * O projeto roda em Node 22 (`engines`, e o `node-version: 22` de todos os
 * workflows). A partir do Node 24 existe um `localStorage` GLOBAL nativo,
 * experimental, que só funciona com a flag `--localstorage-file`. Sem a flag
 * ele resolve para `undefined` — e, por ser própriedade própria de
 * `globalThis`, ele SOMBREIA o `localStorage` que o jsdom instalaria.
 *
 * Efeito prático numa máquina com Node >= 24: `window` existe, `document`
 * existe, mas `window.localStorage` é `undefined`, e todo teste jsdom que
 * toca localStorage quebra — enquanto o CI (Node 22) segue verde. Foi o que
 * escondeu falhas reais em `npm run test:web` local.
 *
 * O shim só instala quando localStorage está de fato ausente, então em Node 22
 * (CI e runtime de produção) nada aqui roda e o comportamento é o do jsdom.
 */
function installLocalStorageShim(): void {
  if (typeof globalThis === "undefined") return;

  const target = globalThis as typeof globalThis & {
    window?: unknown;
    localStorage?: unknown;
  };
  if (typeof target.window === "undefined") return;
  if (target.localStorage) return;

  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(String(key), String(value));
    },
    removeItem: (key: string) => {
      store.delete(String(key));
    },
    clear: () => {
      store.clear();
    },
  };

  Object.defineProperty(target, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
}

installLocalStorageShim();
