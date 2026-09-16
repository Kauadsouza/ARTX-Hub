"use client";

import { useEffect } from "react";

/**
 * Sem isto, uma falha em qualquer tela do Hub deixava a página em branco e o
 * erro sumia. Agora a pessoa vê o que aconteceu, consegue tentar de novo, e o
 * erro fica registrado no console do navegador com o identificador da Vercel.
 */
export default function HubError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Falha no ARTX Hub:", error.message, error.digest ?? "");
  }, [error]);

  return (
    <main className="login">
      <div className="login-orbit" />
      <div className="setup-card">
        <p className="eyebrow">ALGO FALHOU</p>
        <h1>Esta parte do Hub não abriu.</h1>
        <p>Seus dados continuam salvos. Tente de novo; se insistir, recarregue a página ou volte mais tarde.</p>
        <button className="primary" type="button" onClick={reset}>Tentar de novo</button>
        {error.digest && <p><small>Código do erro: <code>{error.digest}</code></small></p>}
      </div>
    </main>
  );
}
