const ABAS = [
  { nome: "Hoje", badge: "9+" },
  { nome: "Notas" },
  { nome: "Financeiro" },
  { nome: "Agente" },
  { nome: "Perfil" },
] as const;

/** Traced from the app's own tab bar so the two read as the same product. */
function Icone({ nome }: { nome: string }) {
  const comum = {
    width: 15,
    height: 15,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (nome === "Hoje") {
    return (
      <svg {...comum}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
    );
  }
  if (nome === "Notas") {
    return (
      <svg {...comum}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    );
  }
  if (nome === "Financeiro") {
    return (
      <svg {...comum}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v9l6.4 4.2" />
      </svg>
    );
  }
  if (nome === "Agente") {
    return (
      <svg {...comum}>
        <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h9A1.5 1.5 0 0 1 15 6.5v5A1.5 1.5 0 0 1 13.5 13H8l-3 2.5V13H4.5A1.5 1.5 0 0 1 3 11.5z" />
        <path d="M18 9h1.5A1.5 1.5 0 0 1 21 10.5v5A1.5 1.5 0 0 1 19.5 17H19v2.2L16.5 17h-3" />
      </svg>
    );
  }
  return (
    <svg {...comum}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

/**
 * The app's floating tab bar.
 *
 * A pill that hovers over the content rather than a bar welded to the bottom
 * edge, with the active tab wearing a green disc behind its icon. Those two
 * details are what make it recognisable; a flat bar with dots read as a
 * wireframe of the app instead of the app.
 */
export function AppTabBar() {
  return (
    <nav
      aria-hidden="true"
      className="mt-auto flex items-center justify-between gap-0.5 rounded-full border border-white/[0.07] bg-[#1e1e21]/90 px-2 py-2 backdrop-blur-sm"
    >
      {ABAS.map((aba) => {
        const ativa = aba.nome === "Hoje";
        return (
          <span
            key={aba.nome}
            className="relative flex flex-1 flex-col items-center gap-1 py-0.5"
          >
            <span
              className={`relative grid h-7 w-7 place-items-center rounded-full ${
                ativa
                  ? "bg-[var(--app-tint)]/20 text-[var(--app-tint)]"
                  : "text-[var(--app-text)]"
              }`}
            >
              <Icone nome={aba.nome} />
              {"badge" in aba && aba.badge ? (
                <span className="absolute -right-1.5 -top-1 rounded-full bg-[#ff9b8f] px-1 text-[7px] font-bold leading-[1.5] text-[#3a0f0a]">
                  {aba.badge}
                </span>
              ) : null}
            </span>
            <span
              className={`text-[8px] ${
                ativa
                  ? "font-semibold text-[var(--app-tint)]"
                  : "text-[var(--app-text)]/85"
              }`}
            >
              {aba.nome}
            </span>
          </span>
        );
      })}
    </nav>
  );
}
