type EventHandler = (event: string, data: unknown) => void;

const OPCODES = {
	Dispatch: 0,
	Heartbeat: 1,
	Identify: 2,
	HeartbeatAck: 3,
	Resume: 4,
	Reconnect: 5,
	InvalidSession: 6,
	Hello: 7,
} as const;

interface GatewayMessage {
	op: number;
	d?: unknown;
	t?: string;
	s?: number;
}

export class GatewayClient {
	private ws: WebSocket | null = null;
	private url: string = "";
	private getToken: () => string | null = () => null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private heartbeatInterval = 41250;
	private lastHeartbeatAck = true;
	private seq: number | null = null;
	private sessionId: string | null = null;
	private reconnectAttempts = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private handlers = new Set<EventHandler>();
	private _status: "disconnected" | "connecting" | "connected" | "resuming" = "disconnected";
	private onStatusChange: ((status: string) => void) | null = null;
	private shouldReconnect = true;

	get status() {
		return this._status;
	}

	get currentSessionId() {
		return this.sessionId;
	}

	setStatusHandler(handler: (status: string) => void) {
		this.onStatusChange = handler;
	}

	private setStatus(status: typeof this._status) {
		this._status = status;
		this.onStatusChange?.(status);
	}

	connect(url: string, getToken: () => string | null): void {
		this.url = url;
		this.getToken = getToken;
		this.shouldReconnect = true;
		this.doConnect();
	}

	disconnect(): void {
		this.shouldReconnect = false;
		this.cleanup();
		this.setStatus("disconnected");
	}

	onEvent(handler: EventHandler): () => void {
		this.handlers.add(handler);
		return () => {
			this.handlers.delete(handler);
		};
	}

	private doConnect() {
		this.cleanup();
		this.setStatus("connecting");

		try {
			this.ws = new WebSocket(this.url);
		} catch {
			this.scheduleReconnect();
			return;
		}

		this.ws.onmessage = (event) => {
			this.handleMessage(event.data as string);
		};

		this.ws.onclose = () => {
			if (this.shouldReconnect) {
				this.scheduleReconnect();
			}
		};

		this.ws.onerror = () => {
			// onclose will fire after this
		};
	}

	private handleMessage(raw: string) {
		let msg: GatewayMessage;
		try {
			msg = JSON.parse(raw) as GatewayMessage;
		} catch {
			return;
		}

		switch (msg.op) {
			case OPCODES.Hello:
				this.handleHello(msg.d as { heartbeatInterval: number });
				break;
			case OPCODES.Dispatch:
				this.handleDispatch(msg);
				break;
			case OPCODES.HeartbeatAck:
				this.lastHeartbeatAck = true;
				break;
			case OPCODES.Reconnect:
				this.doConnect();
				break;
			case OPCODES.InvalidSession: {
				const data = msg.d as { resumable: boolean };
				if (data.resumable && this.sessionId) {
					this.doResume();
				} else {
					this.sessionId = null;
					this.seq = null;
					this.doConnect();
				}
				break;
			}
		}
	}

	private handleHello(data: { heartbeatInterval: number }) {
		this.heartbeatInterval = data.heartbeatInterval;

		// Can we resume?
		if (this.sessionId && this.seq !== null) {
			this.doResume();
		} else {
			this.doIdentify();
		}
	}

	private doIdentify() {
		const token = this.getToken();
		if (!token) {
			this.disconnect();
			return;
		}

		this.send({
			op: OPCODES.Identify,
			d: { token },
		});

		this.startHeartbeat();
	}

	private doResume() {
		const token = this.getToken();
		if (!token || !this.sessionId) {
			this.doIdentify();
			return;
		}

		this.setStatus("resuming");
		this.send({
			op: OPCODES.Resume,
			d: { token, sessionId: this.sessionId, seq: this.seq },
		});

		this.startHeartbeat();
	}

	private handleDispatch(msg: GatewayMessage) {
		if (msg.s != null) {
			this.seq = msg.s;
		}

		if (msg.t === "READY") {
			const data = msg.d as { sessionId: string };
			this.sessionId = data.sessionId;
			this.reconnectAttempts = 0;
			this.setStatus("connected");
		}

		if (msg.t === "RESUMED") {
			const data = msg.d as { sessionId?: string };
			if (data.sessionId) {
				this.sessionId = data.sessionId;
			}
			this.reconnectAttempts = 0;
			this.setStatus("connected");
		}

		if (msg.t) {
			for (const handler of this.handlers) {
				try {
					handler(msg.t, msg.d);
				} catch {
					// Don't let handler errors kill the gateway
				}
			}
		}
	}

	private startHeartbeat() {
		if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
		this.lastHeartbeatAck = true;

		this.heartbeatTimer = setInterval(() => {
			if (!this.lastHeartbeatAck) {
				// Missed heartbeat — reconnect
				this.ws?.close();
				return;
			}
			this.lastHeartbeatAck = false;
			this.send({ op: OPCODES.Heartbeat, d: { seq: this.seq } });
		}, this.heartbeatInterval);
	}

	private send(data: GatewayMessage) {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(data));
		}
	}

	private scheduleReconnect() {
		this.cleanup();
		this.setStatus("disconnected");

		const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
		this.reconnectAttempts++;

		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.doConnect();
		}, delay);
	}

	private cleanup() {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		if (this.ws) {
			this.ws.onmessage = null;
			this.ws.onclose = null;
			this.ws.onerror = null;
			if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
				this.ws.close();
			}
			this.ws = null;
		}
	}
}
