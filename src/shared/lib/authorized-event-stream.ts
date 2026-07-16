type StreamListener = (event: Event) => void;
type RefreshTokens = () => Promise<unknown>;

/** Fetch-based SSE keeps cookie auth and explicit 401 refresh support. */
export class AuthorizedEventStream {
  private readonly controller = new AbortController();
  private readonly listeners = new Map<string, Set<StreamListener>>();
  private closed = false;

  constructor(private readonly url: string, private readonly refreshTokens: RefreshTokens) {
    void this.connect(true);
  }

  addEventListener(type: string, listener: StreamListener) {
    const listeners = this.listeners.get(type) ?? new Set<StreamListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  close() {
    this.closed = true;
    this.controller.abort();
  }

  private emit(type: string, event: Event) {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  private async connect(retryOnUnauthorized: boolean): Promise<void> {
    try {
      const response = await fetch(this.url, { credentials: "include", signal: this.controller.signal });
      if (response.status === 401 && retryOnUnauthorized) {
        await this.refreshTokens();
        if (!this.closed) await this.connect(false);
        return;
      }
      if (!response.ok || !response.body) {
        this.emit("error", new Event("error"));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventType = "message";
      let data: string[] = [];
      const dispatch = () => {
        if (data.length > 0) this.emit(eventType, new MessageEvent(eventType, { data: data.join("\n") }));
        eventType = "message";
        data = [];
      };

      while (!this.closed) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line === "") dispatch();
          else if (line.startsWith("event:")) eventType = line.slice("event:".length).trim() || "message";
          else if (line.startsWith("data:")) data.push(line.slice("data:".length).trimStart());
        }
        if (done) break;
      }
      if (!this.closed) this.emit("error", new Event("error"));
    } catch (error) {
      if (!this.closed && !(error instanceof DOMException && error.name === "AbortError")) {
        this.emit("error", new Event("error"));
      }
    }
  }
}
