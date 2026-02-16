import { useEffect } from "react";
import { useAuthStore } from "../stores/auth.js";
import { useGatewayStore } from "../stores/gateway.js";
import { useGatewayEventRouter } from "./use-gateway-events.js";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:4101";

export function useGateway(): void {
	const accessToken = useAuthStore((s) => s.accessToken);
	const initialize = useGatewayStore((s) => s.initialize);
	const disconnect = useGatewayStore((s) => s.disconnect);

	useEffect(() => {
		if (accessToken) {
			initialize(WS_URL, () => useAuthStore.getState().accessToken);
		} else {
			disconnect();
		}

		return () => {
			disconnect();
		};
	}, [accessToken, initialize, disconnect]);

	// Route gateway events to React Query caches
	useGatewayEventRouter();
}
