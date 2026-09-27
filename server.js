const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const baileys = require('@whiskeysockets/baileys');
const makeWASocket = baileys.default || baileys.makeWASocket;
const { useMultiFileAuthState, DisconnectReason, Browsers, proto } = baileys;
const WA_MSG_STATUS = proto.WebMessageInfo.Status;
const pino = require('pino');
const QRCode = require('qrcode');

const PORT = process.env.PORT || 3000;
/** Use 0.0.0.0 to reach the app from phones/laptops on the same Wi‑Fi. */
const HOST = process.env.HOST || '0.0.0.0';

function getLanIPv4Addresses() {
  const addrs = [];
  const nets = os.networkInterfaces();
  for (const ifName of Object.keys(nets)) {
    for (const net of nets[ifName] || []) {
      if (net.family === 'IPv4' && !net.internal) addrs.push(net.address);
    }
  }
  return addrs;
}
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSIONS_ROOT = path.join(__dirname, 'sessions');
const WA_CLIENT_ID_RE = /^wa_[a-z0-9]{16,64}$/;

function sanitizeWaClientId(raw) {
  const id = String(raw || '').trim().toLowerCase();
  return WA_CLIENT_ID_RE.test(id) ? id : null;
}

function parseWaClientId(req) {
  const header = req.headers['x-wappflow-client-id'] || req.headers['x-wappflow-clientid'];
  return sanitizeWaClientId(header);
}

function getWhatsAppSessionDir(clientId) {
  return path.join(SESSIONS_ROOT, clientId);
}

function ensureWhatsAppSessionDir(clientId) {
  fs.mkdirSync(getWhatsAppSessionDir(clientId), { recursive: true });
}

function clearWhatsAppAuthStorage(clientId) {
  try {
    fs.rmSync(getWhatsAppSessionDir(clientId), { recursive: true, force: true });
  } catch (_) {}
  ensureWhatsAppSessionDir(clientId);
}

async function usePersistedAuthState(clientId) {
  ensureWhatsAppSessionDir(clientId);
  return useMultiFileAuthState(getWhatsAppSessionDir(clientId));
}

function createWhatsAppSessionState(clientId) {
  return {
    clientId,
    sock: null,
    receiptListenerSock: null,
    status: 'DISCONNECTED',
    qr: null,
    qrDataUrl: null,
    qrGeneratedAt: null,
    phoneNumber: null,
    pushName: null,
    lastConnectedAt: null,
    lastError: null
  };
}

// ==========================================
// WHATSAPP BACKGROUND ENGINE (BAILEYS) — one link per browser (client id)
// ==========================================
const waSessionByClientId = new Map();
const waInitLockByClientId = new Map();

function getWhatsAppSession(clientId) {
  if (!waSessionByClientId.has(clientId)) {
    waSessionByClientId.set(clientId, createWhatsAppSessionState(clientId));
  }
  return waSessionByClientId.get(clientId);
}

/** Cache WhatsApp JID lookups so bulk sends to the same numbers stay fast. */
const recipientJidCache = new Map();
const JID_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const ON_WHATSAPP_LOOKUP_MS = 1500;
const VALIDATE_WHATSAPP_NUMBERS = process.env.WHATSAPP_VALIDATE_NUMBERS === '1';
/** Max time to wait for optional delivery ack after send (0 = skip wait). */
const OUTBOUND_ACK_WAIT_MS = Math.max(
  0,
  Number.isFinite(parseInt(process.env.WHATSAPP_ACK_WAIT_MS, 10))
    ? parseInt(process.env.WHATSAPP_ACK_WAIT_MS, 10)
    : 0
);

/** In-memory delivery/read ticks keyed by WhatsApp message id (fromMe outbound). */
const outboundReceiptByMsgId = new Map();
const RECEIPT_STATUS_RANK = { FAILED: 0, SENT: 1, DELIVERED: 2, READ: 3 };

function mapWaStatusToDelivery(waStatus) {
  if (waStatus === WA_MSG_STATUS.ERROR) return 'FAILED';
  if (waStatus >= WA_MSG_STATUS.READ) return 'READ';
  if (waStatus >= WA_MSG_STATUS.DELIVERY_ACK) return 'DELIVERED';
  if (waStatus >= WA_MSG_STATUS.SERVER_ACK) return 'SENT';
  return null;
}

function upsertOutboundReceipt(messageId, waStatus) {
  if (!messageId) return;
  const deliveryStatus = mapWaStatusToDelivery(waStatus);
  if (!deliveryStatus) return;

  const now = new Date().toISOString();
  const prev = outboundReceiptByMsgId.get(messageId) || {};
  const prevRank = RECEIPT_STATUS_RANK[prev.deliveryStatus] ?? -1;
  const newRank = RECEIPT_STATUS_RANK[deliveryStatus] ?? -1;
  if (newRank < prevRank) return;

  const next = {
    deliveryStatus,
    updatedAt: now,
    sentAt: prev.sentAt || now
  };
  if (deliveryStatus === 'DELIVERED' || deliveryStatus === 'READ') {
    next.deliveredAt = prev.deliveredAt || now;
  } else if (prev.deliveredAt) {
    next.deliveredAt = prev.deliveredAt;
  }
  if (deliveryStatus === 'READ') {
    next.readAt = now;
  } else if (prev.readAt) {
    next.readAt = prev.readAt;
  }
  outboundReceiptByMsgId.set(messageId, next);
}

function attachOutboundReceiptListener(sock, sessionState) {
  if (!sock || !sessionState || sessionState.receiptListenerSock === sock) return;
  sessionState.receiptListenerSock = sock;
  sock.ev.on('messages.update', (updates) => {
    for (const { key, update } of updates) {
      if (!key?.fromMe || !key.id) continue;
      if (update?.status === undefined || update?.status === null) continue;
      upsertOutboundReceipt(key.id, update.status);
    }
  });
}

async function initWhatsAppSession(clientId, forceRestart = false, clearAuth = false) {
  const sessionObj = getWhatsAppSession(clientId);
  if (sessionObj.sock && sessionObj.status === 'CONNECTED' && !forceRestart) {
    return sessionObj;
  }
  const existingLock = waInitLockByClientId.get(clientId);
  if (!forceRestart && existingLock) {
    return existingLock;
  }

  const initLock = (async () => {
    try {
      if (clearAuth) {
        clearWhatsAppAuthStorage(clientId);
      }

      if (sessionObj.sock && (forceRestart || sessionObj.status === 'SCAN_QR' || sessionObj.status === 'DISCONNECTED')) {
        try {
          sessionObj.sock.ev.removeAllListeners('connection.update');
          sessionObj.sock.ev.removeAllListeners('creds.update');
          sessionObj.sock.end(undefined);
        } catch (_) {}
      }

      sessionObj.status = 'INITIALIZING';
      sessionObj.lastError = null;

      const { state, saveCreds } = await usePersistedAuthState(clientId);
      const browserConfig = (Browsers && typeof Browsers.macOS === 'function')
        ? Browsers.macOS('Chrome')
        : ['Mac OS', 'Chrome', '14.4.1'];

      const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: browserConfig,
        syncFullHistory: false,
        markOnlineOnConnect: false,
        emitOwnEvents: false,
        generateHighQualityLinkPreview: false,
        linkPreviewImageThumbnailWidth: 0,
        connectTimeoutMs: 20000,
        defaultQueryTimeoutMs: 10000,
        keepAliveIntervalMs: 15000,
        retryRequestDelayMs: 500
      });
      sessionObj.sock = sock;
      attachOutboundReceiptListener(sock, sessionObj);

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          sessionObj.status = 'SCAN_QR';
          sessionObj.qr = qr;
          sessionObj.qrGeneratedAt = Date.now();
          sessionObj.lastError = null;
          try {
            sessionObj.qrDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
          } catch (err) {
            console.error('[WhatsApp Engine] Error rendering QR data URL:', err);
            sessionObj.lastError = 'Failed to generate QR image: ' + err.message;
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error)?.output?.statusCode;
          const loggedOut = statusCode === DisconnectReason.loggedOut;
          console.log(`[WhatsApp Engine][${clientId}] Connection closed. Code: ${statusCode}, LoggedOut: ${loggedOut}`);

          sessionObj.status = 'DISCONNECTED';
          sessionObj.qr = null;
          sessionObj.qrDataUrl = null;
          sessionObj.sock = null;
          sessionObj.receiptListenerSock = null;

          if (loggedOut) {
            sessionObj.phoneNumber = null;
            sessionObj.pushName = null;
            sessionObj.lastError = 'WhatsApp session logged out from mobile phone.';
            clearWhatsAppAuthStorage(clientId);
          } else if (statusCode === DisconnectReason.restartRequired || statusCode === 515) {
            setTimeout(() => {
              initWhatsAppSession(clientId).catch(console.error);
            }, 1500);
          } else if (statusCode === 408 || statusCode === 428) {
            sessionObj.lastError = 'QR code connection expired. Regenerating a fresh code...';
            setTimeout(() => {
              initWhatsAppSession(clientId).catch(console.error);
            }, 1500);
          } else {
            const rawMsg = lastDisconnect?.error?.message || '';
            sessionObj.lastError = `Connection closed (${statusCode || rawMsg || 'Disconnected'})`;
          }
        }

        if (connection === 'open') {
          sessionObj.status = 'CONNECTED';
          sessionObj.qr = null;
          sessionObj.qrDataUrl = null;
          sessionObj.lastError = null;
          const userJid = sock.user?.id || '';
          const rawDigits = userJid.split(':')[0].split('@')[0];
          const pushName = sock.user?.name || sock.user?.notify || 'WhatsApp User';
          sessionObj.phoneNumber = '+' + rawDigits;
          sessionObj.pushName = pushName;
          sessionObj.lastConnectedAt = new Date().toISOString();

          console.log(`[WhatsApp Engine][${clientId}] Connected: ${sessionObj.phoneNumber} (${pushName})`);
        }
      });

      return sessionObj;
    } catch (err) {
      sessionObj.status = 'DISCONNECTED';
      sessionObj.lastError = err.message || 'Initialization failed';
      console.error(`[WhatsApp Engine][${clientId}] Init error:`, err);
      throw err;
    } finally {
      waInitLockByClientId.delete(clientId);
    }
  })();

  waInitLockByClientId.set(clientId, initLock);
  return initLock;
}

console.log('[WhatsApp Engine] Ready — each browser uses its own client id + QR (see X-WappFlow-Client-Id).');

function beginOutboundAckWait(sock, timeoutMs = 20000) {
  let targetId = null;
  let settled = false;
  let resolveFn;
  const earlyUpdates = new Map();

  const promise = new Promise((resolve) => {
    resolveFn = resolve;
  });

  const finish = (status) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    sock.ev.off('messages.update', onUpdate);
    resolveFn(status);
  };

  const timer = setTimeout(() => finish('SENT'), timeoutMs);

  const handleStatus = (status) => {
    if (status === WA_MSG_STATUS.ERROR) {
      finish('FAILED');
    } else if (status >= WA_MSG_STATUS.READ) {
      finish('READ');
    } else if (status >= WA_MSG_STATUS.DELIVERY_ACK) {
      finish('DELIVERED');
    } else if (status >= WA_MSG_STATUS.SERVER_ACK) {
      // Return after WhatsApp server accepts the message (don't wait for phone delivery tick).
      finish('SENT');
    }
  };

  const onUpdate = (updates) => {
    for (const { key, update } of updates) {
      if (!key?.fromMe || !key.id) continue;
      if (!targetId) {
        const list = earlyUpdates.get(key.id) || [];
        list.push(update);
        earlyUpdates.set(key.id, list);
        continue;
      }
      if (key.id !== targetId) continue;
      if (update?.status !== undefined && update?.status !== null) {
        handleStatus(update.status);
      }
    }
  };

  sock.ev.on('messages.update', onUpdate);

  return {
    complete(messageKey) {
      targetId = messageKey?.id;
      if (!targetId) {
        finish('SENT');
        return promise;
      }
      const buffered = earlyUpdates.get(targetId) || [];
      for (const update of buffered) {
        if (update?.status !== undefined && update?.status !== null) {
          handleStatus(update.status);
          if (settled) break;
        }
      }
      return promise;
    }
  };
}

function getCachedRecipientJid(cleanDigits) {
  const hit = recipientJidCache.get(cleanDigits);
  if (!hit) return null;
  if (Date.now() - hit.cachedAt > JID_CACHE_TTL_MS) {
    recipientJidCache.delete(cleanDigits);
    return null;
  }
  return { jid: hit.jid, exists: hit.exists };
}

function cacheRecipientJid(cleanDigits, jid, exists) {
  recipientJidCache.set(cleanDigits, { jid, exists, cachedAt: Date.now() });
}

async function resolveRecipientJid(sock, cleanDigits) {
  const cached = getCachedRecipientJid(cleanDigits);
  if (cached) return cached;

  const fallbackJid = `${cleanDigits}@s.whatsapp.net`;
  if (!VALIDATE_WHATSAPP_NUMBERS) {
    const fast = { jid: fallbackJid, exists: true };
    cacheRecipientJid(cleanDigits, fast.jid, true);
    return fast;
  }
  try {
    const results = await Promise.race([
      sock.onWhatsApp(cleanDigits),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('onWhatsApp lookup timed out')), ON_WHATSAPP_LOOKUP_MS)
      )
    ]);
    const match = results && results[0];
    if (match?.jid) {
      const out = { jid: match.jid, exists: true };
      cacheRecipientJid(cleanDigits, out.jid, true);
      return out;
    }
    if (Array.isArray(results) && results.length === 0) {
      const out = { jid: fallbackJid, exists: false };
      cacheRecipientJid(cleanDigits, out.jid, false);
      return out;
    }
  } catch (err) {
    console.warn('[WhatsApp Engine] onWhatsApp lookup skipped:', err.message);
  }
  const out = { jid: fallbackJid, exists: true };
  cacheRecipientJid(cleanDigits, out.jid, true);
  return out;
}

async function resolveOutboundDeliveryStatus(sock, messageKey) {
  if (!OUTBOUND_ACK_WAIT_MS || !messageKey?.id) return 'SENT';
  const ackWait = beginOutboundAckWait(sock, OUTBOUND_ACK_WAIT_MS);
  return Promise.race([
    ackWait.complete(messageKey),
    new Promise((resolve) => setTimeout(() => resolve('SENT'), OUTBOUND_ACK_WAIT_MS))
  ]);
}

async function sendWhatsAppMessage(clientId, to, text) {
  const sessionObj = getWhatsAppSession(clientId);
  if (!sessionObj || !sessionObj.sock || sessionObj.status !== 'CONNECTED') {
    return {
      success: false,
      error: 'WhatsApp device is not connected. Please scan the QR code in Settings & Storage to link your phone.'
    };
  }

  const sock = sessionObj.sock;
  const cleanDigits = String(to || '').replace(/[^\d]/g, '');
  if (!cleanDigits || cleanDigits.length < 8) {
    return {
      success: false,
      error: `Invalid phone number format: "${to}". Must contain country code and number.`
    };
  }

  const messageText = String(text || '').trim();
  if (!messageText) {
    return {
      success: false,
      error: 'Message body is empty. Check your template and customer fields.'
    };
  }

  const { jid, exists } = await resolveRecipientJid(sock, cleanDigits);
  if (!exists) {
    return {
      success: false,
      error: `This number is not registered on WhatsApp: +${cleanDigits}`
    };
  }

  const content = { text: messageText, linkPreview: null };

  const sendStarted = Date.now();
  try {
    const result = await sock.sendMessage(jid, content);
    const sendMs = Date.now() - sendStarted;
    if (process.env.WHATSAPP_DEBUG === '1') {
      console.log(`[WhatsApp Engine] send to +${cleanDigits} completed in ${sendMs}ms`);
    }
    if (result?.key?.id) {
      upsertOutboundReceipt(result.key.id, WA_MSG_STATUS.SERVER_ACK);
    }
    const deliveryStatus = await resolveOutboundDeliveryStatus(sock, result?.key);
    if (result?.key?.id && deliveryStatus === 'DELIVERED') {
      upsertOutboundReceipt(result.key.id, WA_MSG_STATUS.DELIVERY_ACK);
    } else if (result?.key?.id && deliveryStatus === 'READ') {
      upsertOutboundReceipt(result.key.id, WA_MSG_STATUS.READ);
    }

    if (deliveryStatus === 'FAILED') {
      return {
        success: false,
        error: 'WhatsApp rejected this message (invalid number, blocked, or session error).',
        messageId: result?.key?.id,
        deliveryStatus: 'FAILED',
        to: cleanDigits
      };
    }

    return {
      success: true,
      messageId: result?.key?.id,
      deliveryStatus,
      sendMs,
      timestamp: new Date().toISOString(),
      to: cleanDigits,
      jid
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Failed to dispatch message via WhatsApp'
    };
  }
}

const DEFAULT_PAIRING_COUNTRY_CODE = process.env.WAPPFLOW_DEFAULT_COUNTRY_CODE || '91';

function normalizePairingPhoneDigits(phoneRaw) {
  let d = String(phoneRaw || '').replace(/[^\d]/g, '');
  if (!d) return '';
  if (d.length === 10) {
    d = DEFAULT_PAIRING_COUNTRY_CODE + d;
  } else if (d.length === 11 && d.startsWith('0')) {
    d = DEFAULT_PAIRING_COUNTRY_CODE + d.slice(1);
  }
  return d;
}

async function teardownWhatsAppSocket(clientId) {
  const sessionObj = getWhatsAppSession(clientId);
  if (sessionObj.sock) {
    try {
      sessionObj.sock.ev.removeAllListeners('connection.update');
      sessionObj.sock.ev.removeAllListeners('creds.update');
      sessionObj.sock.end(undefined);
    } catch (_) {}
  }
  sessionObj.sock = null;
  sessionObj.receiptListenerSock = null;
  sessionObj.status = 'DISCONNECTED';
  sessionObj.qr = null;
  sessionObj.qrDataUrl = null;
  sessionObj.lastError = null;
  waInitLockByClientId.delete(clientId);
}

async function ensureSocketForPairing(clientId) {
  await initWhatsAppSession(clientId);
  let sessionObj = getWhatsAppSession(clientId);
  let attempts = 0;
  while (!sessionObj.sock && attempts < 40) {
    await new Promise((r) => setTimeout(r, 250));
    sessionObj = getWhatsAppSession(clientId);
    attempts++;
  }
  return sessionObj;
}

async function requestWhatsAppPairingCode(clientId, phoneRaw) {
  const cleanDigits = normalizePairingPhoneDigits(phoneRaw);
  if (!cleanDigits || cleanDigits.length < 11 || cleanDigits.length > 15) {
    return {
      success: false,
      error: 'Use your full WhatsApp number with country code (e.g. 919560386055). 10-digit numbers get +91 added automatically.'
    };
  }

  let sessionObj = getWhatsAppSession(clientId);
  if (sessionObj.status === 'CONNECTED') {
    return {
      success: false,
      error: 'WhatsApp is already linked on this browser. Disconnect first to use a pairing code.'
    };
  }

  try {
    await teardownWhatsAppSocket(clientId);
    clearWhatsAppAuthStorage(clientId);
    sessionObj = await ensureSocketForPairing(clientId);

    let activeSock = sessionObj.sock;
    if (!activeSock) {
      return { success: false, error: 'WhatsApp engine did not start. Wait 10 seconds and try again.' };
    }

    await new Promise((r) => setTimeout(r, 1200));

    if (activeSock.authState?.creds?.registered) {
      await teardownWhatsAppSocket(clientId);
      clearWhatsAppAuthStorage(clientId);
      sessionObj = await ensureSocketForPairing(clientId);
      activeSock = sessionObj.sock;
      await new Promise((r) => setTimeout(r, 1200));
    }

    if (!activeSock) {
      return { success: false, error: 'Could not start a fresh session for pairing.' };
    }
    if (activeSock.authState?.creds?.registered) {
      return {
        success: false,
        error: 'Session still registered. Tap Disconnect Device, wait 5s, then try pairing again.'
      };
    }

    sessionObj.lastError = null;
    const pairingCode = await activeSock.requestPairingCode(cleanDigits);
    sessionObj.pairingCode = pairingCode;
    sessionObj.pairingCodePhone = cleanDigits;
    sessionObj.pairingCodeAt = Date.now();
    sessionObj.status = 'SCAN_QR';

    return {
      success: true,
      data: {
        pairingCode,
        phone: cleanDigits,
        hint: 'WhatsApp → Linked devices → Link with phone number instead → enter this code'
      }
    };
  } catch (err) {
    const raw = err.message || 'Failed to generate pairing code';
    const friendly = /closed|401|logout|conflict/i.test(raw)
      ? `WhatsApp closed the link setup (${raw}). Use 919560386055 format, wait 10s, try once more. If it persists, tap Disconnect then Get pairing code.`
      : raw;
    sessionObj = getWhatsAppSession(clientId);
    sessionObj.lastError = friendly;
    return { success: false, error: friendly };
  }
}

async function disconnectWhatsAppSession(clientId) {
  const sessionObj = getWhatsAppSession(clientId);
  if (sessionObj.sock) {
    try {
      await sessionObj.sock.logout();
    } catch (_) {}
    try {
      sessionObj.sock.end(undefined);
    } catch (_) {}
  }
  sessionObj.sock = null;
  sessionObj.status = 'DISCONNECTED';
  sessionObj.qr = null;
  sessionObj.qrDataUrl = null;
  sessionObj.phoneNumber = null;
  sessionObj.pushName = null;
  sessionObj.receiptListenerSock = null;

  clearWhatsAppAuthStorage(clientId);

  return { success: true };
}

function waClientIdErrorResponse(res) {
  res.writeHead(400, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: false,
    error: 'Missing or invalid X-WappFlow-Client-Id. Reload the app so this browser can register its own WhatsApp link.'
  }));
}

// ==========================================
// HTTP SERVER & STATIC ASSETS
// ==========================================
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-WappFlow-Client-Id');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();

  // ==========================================
  // API: WHATSAPP ENGINE ROUTES
  // ==========================================
  if (pathname === '/api/privacy' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        customerDataOnServer: false,
        customerDataStorage: 'browser_sessionStorage',
        whatsappAuthStorage: 'server_local_sessions_per_browser_client_id',
        persistence: 'Export CSV from the app to keep records; clearing the browser tab removes local data.'
      }
    }));
    return;
  }

  if (pathname === '/api/whatsapp/status' && method === 'GET') {
    const clientId = parseWaClientId(req);
    if (!clientId) {
      waClientIdErrorResponse(res);
      return;
    }
    const sessionObj = getWhatsAppSession(clientId);
    if (sessionObj.status === 'DISCONNECTED' && !sessionObj.sock) {
      initWhatsAppSession(clientId).catch(console.error);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        clientId,
        status: sessionObj.status,
        phoneNumber: sessionObj.phoneNumber,
        pushName: sessionObj.pushName,
        lastConnectedAt: sessionObj.lastConnectedAt,
        lastError: sessionObj.lastError,
        hasQr: !!sessionObj.qrDataUrl
      }
    }));
    return;
  }

  if (pathname === '/api/whatsapp/qr' && method === 'GET') {
    const clientId = parseWaClientId(req);
    if (!clientId) {
      waClientIdErrorResponse(res);
      return;
    }
    const sessionObj = getWhatsAppSession(clientId);
    if (sessionObj.status === 'DISCONNECTED') {
      initWhatsAppSession(clientId).catch(console.error);
    }
    if (!sessionObj.qrDataUrl && (sessionObj.status === 'INITIALIZING' || sessionObj.status === 'DISCONNECTED' || sessionObj.status === 'SCAN_QR')) {
      const maxWait = sessionObj.status === 'SCAN_QR' ? 15 : 30;
      for (let i = 0; i < maxWait; i++) {
        await new Promise(r => setTimeout(r, 200));
        if (sessionObj.qrDataUrl || sessionObj.status === 'CONNECTED') break;
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        clientId,
        status: sessionObj.status,
        qrDataUrl: sessionObj.qrDataUrl,
        phoneNumber: sessionObj.phoneNumber,
        pushName: sessionObj.pushName,
        lastError: sessionObj.lastError
      }
    }));
    return;
  }

  if (pathname === '/api/whatsapp/restart-qr' && method === 'POST') {
    const clientId = parseWaClientId(req);
    if (!clientId) {
      waClientIdErrorResponse(res);
      return;
    }
    const sessionObj = getWhatsAppSession(clientId);
    await initWhatsAppSession(clientId, true, true);
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 200));
      if (sessionObj.qrDataUrl || sessionObj.status === 'CONNECTED') break;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      data: {
        clientId,
        status: sessionObj.status,
        qrDataUrl: sessionObj.qrDataUrl,
        lastError: sessionObj.lastError
      }
    }));
    return;
  }

  if (pathname === '/api/whatsapp/disconnect' && method === 'POST') {
    const clientId = parseWaClientId(req);
    if (!clientId) {
      waClientIdErrorResponse(res);
      return;
    }
    await disconnectWhatsAppSession(clientId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  if (pathname === '/api/whatsapp/send' && method === 'POST') {
    const clientId = parseWaClientId(req);
    if (!clientId) {
      waClientIdErrorResponse(res);
      return;
    }
    const body = await parseJsonBody(req);
    const result = await sendWhatsAppMessage(clientId, body.phone, body.message);
    res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  if (pathname === '/api/whatsapp/pairing-code' && method === 'POST') {
    const clientId = parseWaClientId(req);
    if (!clientId) {
      waClientIdErrorResponse(res);
      return;
    }
    const body = await parseJsonBody(req);
    const result = await requestWhatsAppPairingCode(clientId, body.phone || body.phoneNumber);
    res.writeHead(result.success ? 200 : 400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  if (pathname === '/api/whatsapp/receipts' && method === 'POST') {
    const body = await parseJsonBody(req);
    const ids = Array.isArray(body.messageIds) ? body.messageIds : [];
    const data = {};
    for (const id of ids) {
      if (typeof id !== 'string' || !id.trim()) continue;
      const rec = outboundReceiptByMsgId.get(id.trim());
      if (rec) data[id.trim()] = rec;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data }));
    return;
  }

  // ==========================================
  // STATIC FILE SERVING
  // ==========================================
  let reqPath = pathname;
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  let filePath = path.join(PUBLIC_DIR, reqPath);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, reqPath);
  }
  if (!fs.existsSync(filePath)) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Error loading file');
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`======================================================`);
  console.log(`🚀 WappFlow Engine running`);
  console.log(`   Local:    http://localhost:${PORT}`);
  const lanIps = getLanIPv4Addresses();
  if (lanIps.length) {
    console.log(`   Wi‑Fi/LAN (same network):`);
    lanIps.forEach((ip) => console.log(`             http://${ip}:${PORT}`));
  } else {
    console.log(`   Wi‑Fi/LAN: bind on ${HOST}:${PORT} (no LAN IPv4 detected yet)`);
  }
  console.log(`⚡ Automated WhatsApp WebSocket Dispatch: ACTIVE`);
  console.log(`🔒 Privacy: Customer data stays in the browser only (no server database)`);
  console.log(`📲 WhatsApp: one linked account per browser (sessions/<client-id> on this host)`);
  console.log(`======================================================`);
});
