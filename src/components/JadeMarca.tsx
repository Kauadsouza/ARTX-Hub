"use client";

import { useId } from "react";

/**
 * A marca da Jade.
 *
 * Era a estrelinha de ícone genérico, a mesma que qualquer aplicativo usa para
 * "inteligência artificial". Jade é uma pedra, então a marca é o brilho numa
 * gema lapidada: quatro pontas longas e finas, quatro menores na diagonal e um
 * centro facetado. Delicada de propósito — traço fino, pouca tinta.
 *
 * As cores vêm do tema (`--mint` é o verde da Jade), então ela acompanha
 * Noite, Oceano, Claro e Areia sem ter uma versão para cada um.
 *
 * `viva` liga um movimento lento enquanto ela pensa: as pontas menores giram
 * e o conjunto respira. Quem pediu menos movimento ao sistema não vê nada
 * disso — a regra no CSS desliga.
 */
export function JadeMarca({
  tamanho = 20,
  viva = false,
  clara = false,
  className = "",
}: {
  tamanho?: number;
  viva?: boolean;
  /** Versão para fundo escuro e colorido, como a bolha do canto. */
  clara?: boolean;
  className?: string;
}) {
  // Um id por instância: com duas marcas na tela, o gradiente de uma não pode
  // pintar a outra.
  const id = useId().replace(/:/g, "");

  return (
    <svg
      className={`jade-marca ${viva ? "viva" : ""} ${clara ? "clara" : ""} ${className}`}
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-g`} x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop className="jade-marca-luz" offset="0" />
          <stop className="jade-marca-meio" offset=".55" />
          <stop className="jade-marca-fundo" offset="1" />
        </linearGradient>
      </defs>

      {/* As pontas menores, na diagonal. São elas que giram. */}
      <g className="jade-marca-diagonais">
        <path
          d="M12 6.2 12.75 11.25 17.8 12 12.75 12.75 12 17.8 11.25 12.75 6.2 12 11.25 11.25Z"
          transform="rotate(45 12 12)"
          fill={`url(#${id}-g)`}
          opacity=".42"
        />
      </g>

      {/* As quatro pontas longas: o brilho principal. */}
      <path
        className="jade-marca-estrela"
        d="M12 1.6 13.25 10.75 22.4 12 13.25 13.25 12 22.4 10.75 13.25 1.6 12 10.75 10.75Z"
        fill={`url(#${id}-g)`}
      />

      {/* O centro facetado: um losango pequeno, com uma face mais clara. */}
      <path d="M12 9.9 14.1 12 12 14.1 9.9 12Z" className="jade-marca-centro" />
      <path d="M12 9.9 14.1 12 12 12Z" className="jade-marca-face" />
    </svg>
  );
}
