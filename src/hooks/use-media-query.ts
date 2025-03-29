import { useEffect, useState } from "react";

/**
 * Hook para detectar se uma media query corresponde à situação atual do viewport
 * @param query A media query a ser avaliada (ex: "(min-width: 768px)")
 * @returns boolean indicando se a media query corresponde
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(false);

  useEffect(() => {
    // Verificar se o código está executando no browser
    if (typeof window !== "undefined") {
      const media = window.matchMedia(query);

      // Definir o valor inicial
      setMatches(media.matches);

      // Criar o listener para atualizar o valor quando a media query mudar
      const listener = (event: MediaQueryListEvent) => {
        setMatches(event.matches);
      };

      // Adicionar o listener
      media.addEventListener("change", listener);

      // Remover o listener na limpeza
      return () => {
        media.removeEventListener("change", listener);
      };
    }

    return undefined;
  }, [query]);

  return matches;
}
