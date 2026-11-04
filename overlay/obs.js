// Minimal obs-websocket v5 client (OBS 28+ has the server built in: Tools > WebSocket Server Settings).
// Shared by the extension's service worker and the overlay page (a copy lives in overlay/).
(function (root) {
  const OP = { Hello: 0, Identify: 1, Identified: 2, Event: 5, Request: 6, RequestResponse: 7 };
  const EVENT_SUB_GENERAL = 1; // CustomEvent is in the General category

  async function sha256b64(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    let bin = '';
    for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
    return btoa(bin);
  }

  class ObsClient {
    constructor({ url, password = '', onEvent = () => {}, onStatus = () => {} }) {
      this.url = url;
      this.password = password;
      this.onEvent = onEvent;
      this.onStatus = onStatus;
      this.ws = null;
      this.ready = false;
      this.pending = new Map();
      this.nextId = 1;
      this.retryMs = 1000;
      this.closed = false;
      this.status = 'disconnected';
    }

    setStatus(s, detail) {
      this.status = s;
      this.onStatus(s, detail);
    }

    connect() {
      this.closed = false;
      let ws;
      try { ws = new WebSocket(this.url); } catch (e) { this.scheduleRetry(); return; }
      this.ws = ws;
      this.setStatus('connecting');
      ws.onmessage = (e) => this.handle(JSON.parse(e.data));
      ws.onclose = (e) => {
        this.ready = false;
        for (const { reject } of this.pending.values()) reject(new Error('OBS connection closed'));
        this.pending.clear();
        // 4009 = authentication failed: don't hammer OBS with a wrong password
        if (e.code === 4009) { this.setStatus('auth-failed', 'Wrong OBS WebSocket password'); return; }
        this.setStatus('disconnected');
        this.scheduleRetry();
      };
      ws.onerror = () => {};
    }

    scheduleRetry() {
      if (this.closed) return;
      clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => this.connect(), this.retryMs);
      this.retryMs = Math.min(this.retryMs * 2, 10000);
    }

    close() {
      this.closed = true;
      clearTimeout(this.retryTimer);
      if (this.ws) this.ws.close();
    }

    async handle(m) {
      if (m.op === OP.Hello) {
        const d = { rpcVersion: 1, eventSubscriptions: EVENT_SUB_GENERAL };
        const auth = m.d.authentication;
        if (auth) {
          const secret = await sha256b64(this.password + auth.salt);
          d.authentication = await sha256b64(secret + auth.challenge);
        }
        this.ws.send(JSON.stringify({ op: OP.Identify, d }));
      } else if (m.op === OP.Identified) {
        this.ready = true;
        this.retryMs = 1000;
        this.setStatus('connected');
      } else if (m.op === OP.Event) {
        this.onEvent(m.d.eventType, m.d.eventData);
      } else if (m.op === OP.RequestResponse) {
        const p = this.pending.get(m.d.requestId);
        if (!p) return;
        this.pending.delete(m.d.requestId);
        if (m.d.requestStatus.result) p.resolve(m.d.responseData);
        else p.reject(new Error(m.d.requestStatus.comment || 'OBS request failed'));
      }
    }

    request(requestType, requestData) {
      if (!this.ready) return Promise.reject(new Error('OBS not connected'));
      const requestId = String(this.nextId++);
      return new Promise((resolve, reject) => {
        this.pending.set(requestId, { resolve, reject });
        this.ws.send(JSON.stringify({ op: OP.Request, d: { requestType, requestId, requestData } }));
      });
    }

    // Delivered to every obs-websocket client subscribed to General events (i.e. the overlay).
    broadcast(eventData) {
      return this.request('BroadcastCustomEvent', { eventData });
    }
  }

  root.ObsClient = ObsClient;
})(typeof self !== 'undefined' ? self : window);
