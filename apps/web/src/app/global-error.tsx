"use client";

// global-error.tsx replaces the root layout — cannot rely on CSS being loaded.
// Uses inline styles as a safe fallback for critical error rendering.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          backgroundColor: "#fafafa",
          color: "#111827",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            gap: "1.5rem",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <h2
              style={{ fontSize: "1.5rem", fontWeight: 600, color: "#ef4444", margin: 0 }}
            >
              Erro crítico
            </h2>
            <p style={{ color: "#6b7280", margin: 0 }}>
              Ocorreu um erro crítico no sistema. Recarregue a página ou entre
              em contato com o suporte.
            </p>
            {error.digest && (
              <p
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                  color: "#9ca3af",
                  marginTop: "0.25rem",
                }}
              >
                Código: {error.digest}
              </p>
            )}
          </div>
          <button
            onClick={reset}
            style={{
              backgroundColor: "#3b82f6",
              color: "white",
              padding: "0.5rem 1.5rem",
              borderRadius: "0.375rem",
              border: "none",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
