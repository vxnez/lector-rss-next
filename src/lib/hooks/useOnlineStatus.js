// src/lib/hooks/useOnlineStatus.js
"use client";

import { useState, useEffect } from "react";

export function useOnlineStatus() {
  const [estaOnline, setEstaOnline] = useState(() => {
    try {
      return typeof navigator !== "undefined" ? navigator.onLine : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const alConectar = () => setEstaOnline(true);
    const alDesconectar = () => setEstaOnline(false);

    window.addEventListener("online", alConectar);
    window.addEventListener("offline", alDesconectar);

    return () => {
      window.removeEventListener("online", alConectar);
      window.removeEventListener("offline", alDesconectar);
    };
  }, []);

  return estaOnline;
}
