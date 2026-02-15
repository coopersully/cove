import { useEffect, useRef, useState } from "react";

const HEALTH_URL = `${import.meta.env.VITE_API_URL ?? "http://localhost:4100"}/health`;
const POLL_INTERVAL = 30_000;

interface ApiHealth {
  readonly isReachable: boolean;
  readonly isChecking: boolean;
}

export function useApiHealth(): ApiHealth {
  const [isReachable, setIsReachable] = useState(true);
  const [isChecking, setIsChecking] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(HEALTH_URL, { method: "GET" });
        if (!cancelled) setIsReachable(res.ok);
      } catch {
        if (!cancelled) setIsReachable(false);
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    }

    void check();

    intervalRef.current = setInterval(() => void check(), POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { isReachable, isChecking };
}
