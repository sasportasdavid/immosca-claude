// useDebouncedValue — petit utilitaire de debounce générique.
//
// Renvoie la dernière valeur stabilisée pendant `delay` ms. Utilisé pour
// éviter de spammer l'API BAN à chaque frappe dans l'autocomplete.

import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebounced(value);
    }, delay);
    return () => {
      window.clearTimeout(handle);
    };
  }, [value, delay]);

  return debounced;
}
