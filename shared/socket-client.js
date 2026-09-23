/**
 * TravelBuddy Singleton Socket Client
 * Ensures only ONE connection exists per namespace across the entire application session.
 * Provides a unified event bus for all dashboard components.
 */

(function () {
  'use strict';

  class SocketClient {
    constructor() {
      this.connections = new Map(); // namespace -> socket instance
      this.statusListeners = new Set();
      this.lastHeartbeat = null;
      this.reconnectAttemptedAt = null;

      console.log('[Realtime] Initializing Unified Socket Service...');
    }

    _readSessionToken() {
      if (typeof document === 'undefined') return null;
      try {
        const match = document.cookie.split('; ').find((entry) => entry.startsWith('carryparcel_session='));
        if (!match) return null;
        const value = decodeURIComponent(match.split('=').slice(1).join('='));
        return value || null;
      } catch (error) {
        return null;
      }
    }

    /**
     * Connect to a specific namespace
     * @param {string} namespace - Namespace (e.g., '/', '/admin')
     * @param {string} token - Auth token
     */
    connect(namespace = '/', token = null) {
      if (typeof io === 'undefined') {
        console.error('[Realtime] Socket.IO library (io) not found. This may be due to a script loading failure or CSP block. Real-time features disabled.');
        return null;
      }

      if (this.connections.has(namespace)) {
        return this.connections.get(namespace);
      }

      const url = namespace === '/' ? APP_CONFIG.SOCKET_URL : `${APP_CONFIG.SOCKET_URL}${namespace}`;
      const sessionToken = token || this._readSessionToken();
      const socketOptions = {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        withCredentials: true,
      };

      if (sessionToken) {
        socketOptions.auth = { token: sessionToken };
      }

      console.log(`[Realtime] Establishing connection to ${namespace}...`);

      const socket = io(url, socketOptions);
      socket._cpNamespace = namespace;
      socket._cpJoinedConversations = new Set();

      this._bindBaseEvents(namespace, socket);
      this.connections.set(namespace, socket);

      return socket;
    }

    _bindBaseEvents(namespace, socket) {
      socket.on('connect', () => {
        console.log(`[Realtime] Connected to ${namespace} (ID: ${socket.id})`);
        this.lastHeartbeat = Date.now();
        this._notifyStatus(namespace, 'connected');
      });

      socket.on('disconnect', (reason) => {
        console.warn(`[Realtime] Disconnected from ${namespace}: ${reason}`);
        this._notifyStatus(namespace, 'disconnected');
      });

      socket.on('connect_error', (err) => {
        console.error(`[Realtime] Connection error for ${namespace}:`, err.message);
        this._notifyStatus(namespace, 'error', err.message);
      });

      socket.on('reconnect_attempt', () => {
        this.reconnectAttemptedAt = Date.now();
        this._notifyStatus(namespace, 'connecting');
      });

      socket.on('reconnect', () => {
        console.log(`[Realtime] Reconnected to ${namespace}.`);
        this.lastHeartbeat = Date.now();
        this._notifyStatus(namespace, 'connected');
      });

      socket.onAny((event, ...args) => {
        if (!event.startsWith('admin:')) return;
        console.debug(`[Realtime] Event Received [${namespace}]: ${event}`, args);
      });
    }

    onStatus(callback) {
      this.statusListeners.add(callback);
    }

    _notifyStatus(namespace, status, error = null) {
      this.statusListeners.forEach(cb => cb({ namespace, status, error, timestamp: Date.now() }));
    }

    getRealtimeStatus(namespace = '/') {
      const socket = this.getSocket(namespace);
      const joinedCount = socket?._cpJoinedConversations?.size || 0;
      const connected = !!socket?.connected;

      return {
        connected,
        authenticated: connected,
        conversationJoined: joinedCount > 0,
        ready: connected && joinedCount > 0,
      };
    }

    getSocket(namespace = '/') {
      return this.connections.get(namespace);
    }

    get admin() {
      return this.getSocket('/admin');
    }

    get root() {
      return this.getSocket('/');
    }

    disconnectAll() {
      this.connections.forEach(socket => socket.disconnect());
      this.connections.clear();
      console.log('[Realtime] All connections terminated.');
    }
  }

  window.CarryParcelSocket = new SocketClient();

})();
