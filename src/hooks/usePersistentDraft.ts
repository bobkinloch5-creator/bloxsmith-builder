import { useCallback, useEffect, useRef, useState } from "react";

type Options<T> = {
  key: string | null | undefined;
  initial: T;
  isEmpty?: (value: T) => boolean;
  warnOnUnload?: boolean;
};

export function usePersistentDraft<T>({ key, initial, isEmpty, warnOnUnload = true }: Options<T>) {
  const [value, setValue] = useState<T>(initial);
  const restoredRef = useRef(false);
  const empty = useCallback(
    (v: T) => (isEmpty ? isEmpty(v) : !String(v ?? "").trim()),
    [isEmpty],
  );

  useEffect(() => {
    if (!key || restoredRef.current || typeof localStorage === "undefined") return;
    restoredRef.current = true;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      setValue(JSON.parse(raw) as T);
    } catch {
      localStorage.removeItem(key);
    }
  }, [key]);

  useEffect(() => {
    if (!key || typeof localStorage === "undefined") return;
    if (empty(value)) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  }, [empty, key, value]);

  useEffect(() => {
    if (!warnOnUnload || !key || empty(value)) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [empty, key, value, warnOnUnload]);

  function clearDraft() {
    if (key && typeof localStorage !== "undefined") localStorage.removeItem(key);
    setValue(initial);
  }

  return [value, setValue, clearDraft] as const;
}
