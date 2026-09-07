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

    /**
     * Connect to a specific namespace
     * @param {string} namespace - Namespace (e.g., '/', '/admin')
     * @param {string} token - Auth token
     */
    connect(namespace = '/', token = null) {
      if (typeof io === 'undefined') {
        console.error('[Realtime] Socket.IO library not found. Real-time features disabled.');
        return null;
      }

      if (this.connections.has(namespace)) {
        return this.connections.get(namespace);
      }

      const url = namespace === '/' ? APP_CONFIG.SOCKET_URL : `${APP_CONFIG.SOCKET_URL}${namespace}`;
      const auth = token ? { token } : {};

      console.log(`[Realtime] Establishing connection to ${namespace}...`);

      const socket = io(url, {
        auth,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        withCredentials: true
      });

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

      // Unified event bus logging
      socket.onAny((event, ...args) => {
        if (!event.startsWith('admin:')) return; // Filter spammy internal events if needed
        console.debug(`[Realtime] Event Received [${namespace}]: ${event}`, args);
      });
    }

    /**
     * Add a listener for connection status changes
     */
    onStatus(callback) {
      this.statusListeners.add(callback);
    }

    _notifyStatus(namespace, status, error = null) {
      this.statusListeners.forEach(cb => cb({ namespace, status, error, timestamp: Date.now() }));
    }

    /**
     * Authoritative helper to get a socket instance
     */
    getSocket(namespace = '/') {
      return this.connections.get(namespace);
    }

    /**
     * Admin-specific shortcut
     */
    get admin() {
      return this.getSocket('/admin');
    }

    /**
     * Root-specific shortcut
     */
    get root() {
      return this.getSocket('/');
    }

    /**
     * Graceful cleanup
     */
    disconnectAll() {
      this.connections.forEach(socket => socket.disconnect());
      this.connections.clear();
      console.log('[Realtime] All connections terminated.');
    }
  }

  // Export as global singleton
  window.TravelBuddySocket = new SocketClient();

})();
