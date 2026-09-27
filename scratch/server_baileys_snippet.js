const baileysSessions = new Map();
const baileysInitLocks = new Map();

function getUserSessionDir(userId) {
  const safeId = String(userId || 'default').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const folderName = safeId.startsWith('user_') ? safeId : `user_${safeId}`;
  return path.join(SESSIONS_DIR, folderName);
}

async function initBaileysSession(userId, forceRestart = false) {
  if (!userId) throw new Error('userId is required');

  let sessionObj = baileysSessions.get(userId);
  if (sessionObj && sessionObj.sock && sessionObj.status === 'CONNECTED' && !forceRestart) {
    return sessionObj;
  }

  // Prevent concurrent duplicate initialization race conditions
  if (!forceRestart && baileysInitLocks.has(userId)) {
    return baileysInitLocks.get(userId);
  }

  const initPromise = (async () => {
    if (sessionObj && (forceRestart || sessionObj.status === 'SCAN_QR' || sessionObj.status === 'DISCONNECTED')) {
      if (sessionObj.sock) {
        try {
          sessionObj.sock.ev.removeAllListeners('connection.update');
          sessionObj.sock.ev.removeAllListeners('creds.update');
          sessionObj.sock.ev.removeAllListeners('messages.update');
          sessionObj.sock.ev.removeAllListeners('messages.upsert');
          sessionObj.sock.end(undefined);
        } catch (_) {}
      }
    }

    const userSessionDir = getUserSessionDir(userId);
    if (!fs.existsSync(userSessionDir)) {
      fs.mkdirSync(userSessionDir, { recursive: true });
    }

    sessionObj = {
      userId,
      sock: null,
      status: 'INITIALIZING',
      qr: null,
      qrDataUrl: null,
      qrGeneratedAt: null,
      phoneNumber: null,
      pushName: null,
      lastConnectedAt: null,
      lastDisconnectedAt: null,
      lastError: null
    };
    baileysSessions.set(userId, sessionObj);

    try {
      const { state, saveCreds } = await useMultiFileAuthState(userSessionDir);
      const browserConfig = (Browsers && typeof Browsers.macOS === 'function')
        ? Browsers.macOS('Chrome')
        : ['Mac OS', 'Chrome', '14.4.1'];

      const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: browserConfig,
        syncFullHistory: false,
        connectTimeoutMs: 30000,
        defaultQueryTimeoutMs: 30000,
        keepAliveIntervalMs: 15000,
        retryRequestDelayMs: 2000
      });
      sessionObj.sock = sock;

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
            console.error('[Baileys] Error rendering QR data URL:', err);
            sessionObj.lastError = 'Failed to generate QR image: ' + err.message;
          }
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error)?.output?.statusCode;
          const loggedOut = statusCode === DisconnectReason.loggedOut;
          console.log(`[Baileys] Connection closed for user ${userId}. Code: ${statusCode}, LoggedOut: ${loggedOut}`);

          sessionObj.status = 'DISCONNECTED';
          sessionObj.qr = null;
          sessionObj.qrDataUrl = null;
          sessionObj.sock = null;
          sessionObj.lastDisconnectedAt = Date.now();

          if (loggedOut) {
            sessionObj.phoneNumber = null;
            sessionObj.pushName = null;
            sessionObj.lastError = 'WhatsApp session was logged out from mobile phone.';
            try {
              fs.rmSync(userSessionDir, { recursive: true, force: true });
            } catch (_) {}
            try {
              db.prepare(`
                UPDATE whatsapp_config
                SET baileysConnected = 0, baileysPhoneNumber = NULL, baileysPushName = NULL, updatedAt = ?
                WHERE userId = ?
              `).run(new Date().toISOString(), userId);
              logAudit(userId, 'WHATSAPP_DEVICE_LOGGED_OUT', 'WhatsAppConfig', {});
            } catch (_) {}
          } else if (statusCode === DisconnectReason.restartRequired || statusCode === 515) {
            setTimeout(() => {
              initBaileysSession(userId).catch(console.error);
            }, 1000);
          } else if (statusCode === 408 || statusCode === 428) {
            sessionObj.lastError = 'QR code connection expired. Click Refresh QR to generate a new code.';
          } else {
            const rawMsg = lastDisconnect?.error?.message || '';
            if (rawMsg.includes('ENOTFOUND') || rawMsg.includes('ECONNREFUSED')) {
              sessionObj.lastError = 'Cannot reach web.whatsapp.com. Please check your internet connection.';
            } else {
              sessionObj.lastError = `Connection closed (${statusCode || rawMsg || 'Disconnected'})`;
            }
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

          console.log(`[Baileys] WhatsApp device connected for user ${userId}: ${sessionObj.phoneNumber} (${pushName})`);

          try {
            db.prepare(`
              INSERT INTO whatsapp_config (userId, connectionMode, baileysConnected, baileysPhoneNumber, baileysPushName, baileysLastConnectedAt, updatedAt)
              VALUES (?, 'QR_CODE', 1, ?, ?, ?, ?)
              ON CONFLICT(userId) DO UPDATE SET
                connectionMode = 'QR_CODE',
                baileysConnected = 1,
                baileysPhoneNumber = excluded.baileysPhoneNumber,
                baileysPushName = excluded.baileysPushName,
                baileysLastConnectedAt = excluded.baileysLastConnectedAt,
                updatedAt = excluded.updatedAt
            `).run(userId, '+' + rawDigits, pushName, sessionObj.lastConnectedAt, sessionObj.lastConnectedAt);

            logAudit(userId, 'WHATSAPP_DEVICE_LINKED', 'WhatsAppConfig', { phone: '+' + rawDigits, pushName });
          } catch (err) {
            console.error('[Baileys] DB update error on open:', err);
          }
        }
      });

      // Real delivery & read receipts
      sock.ev.on('messages.update', (updates) => {
        for (const { key, update } of updates) {
          if (key && key.id && update?.status) {
            const statusVal = update.status;
            const ts = new Date().toISOString();
            if (statusVal === 3) {
              // DELIVERED
              const msg = db.prepare('SELECT id, campaignId, status FROM messages WHERE whatsappMessageId = ?').get(key.id);
              if (msg && msg.status !== 'DELIVERED' && msg.status !== 'READ') {
                db.prepare("UPDATE messages SET status = 'DELIVERED', deliveredAt = ? WHERE id = ?").run(ts, msg.id);
                db.prepare('UPDATE campaigns SET deliveredCount = deliveredCount + 1 WHERE id = ?').run(msg.campaignId);
              }
            } else if (statusVal === 4 || statusVal === 5) {
              // READ
              const msg = db.prepare('SELECT id, campaignId, status FROM messages WHERE whatsappMessageId = ?').get(key.id);
              if (msg && msg.status !== 'READ') {
                db.prepare("UPDATE messages SET status = 'READ', readAt = ? WHERE id = ?").run(ts, msg.id);
                db.prepare('UPDATE campaigns SET readCount = readCount + 1 WHERE id = ?').run(msg.campaignId);
              }
            }
          }
        }
      });

      // Inbound STOP / UNSUBSCRIBE keywords
      sock.ev.on('messages.upsert', async ({ messages: newMessages, type }) => {
        if (type === 'notify') {
          for (const m of newMessages) {
            if (!m.key?.fromMe) {
              const body = (m.message?.conversation || m.message?.extendedTextMessage?.text || '').trim().toUpperCase();
              if (['STOP', 'UNSUBSCRIBE', 'CANCEL', 'QUIT'].includes(body)) {
                const raw = (m.key.remoteJid || '').split('@')[0];
                const phone = '+' + raw;
                db.prepare("UPDATE customers SET optInStatus = 'OPTED_OUT' WHERE phone = ?").run(phone);
                logAudit(userId, 'CUSTOMER_OPTED_OUT', 'Customer', { phone, keyword: body, source: 'BAILEYS_INBOUND' });
              }
            }
          }
        }
      });

      return sessionObj;
    } catch (err) {
      if (sessionObj) {
        sessionObj.status = 'DISCONNECTED';
        sessionObj.lastError = err.message || 'Initialization failed';
      }
      console.error(`[Baileys] Init error for user ${userId}:`, err);
      throw err;
    } finally {
      baileysInitLocks.delete(userId);
    }
  })();

  baileysInitLocks.set(userId, initPromise);
  return initPromise;
}

async function sendBaileysWhatsAppMessage(userId, to, text) {
  let session = baileysSessions.get(userId);

  if (!session || !session.sock || session.status !== 'CONNECTED') {
    const credsPath = path.join(getUserSessionDir(userId), 'creds.json');
    if (fs.existsSync(credsPath)) {
      try {
        await initBaileysSession(userId);
        for (let i = 0; i < 25; i++) {
          session = baileysSessions.get(userId);
          if (session && session.status === 'CONNECTED' && session.sock) break;
          await new Promise((r) => setTimeout(r, 150));
        }
      } catch (_) {}
    }
  }

  if (!session || !session.sock || session.status !== 'CONNECTED') {
    return {
      success: false,
      error: 'WhatsApp device is not linked. Please open Settings and scan the QR code to link your phone.'
    };
  }

  try {
    const norm = normalizePhone(to);
    const cleanTo = norm.isValid ? norm.digits : String(to).replace(/[^\d]/g, '');
    if (!cleanTo || cleanTo.length < 8) {
      return { success: false, error: `Invalid recipient phone number: ${to}` };
    }

    const jid = `${cleanTo}@s.whatsapp.net`;
    const messageContent = { text: String(text || '').trim() };
    const sent = await session.sock.sendMessage(jid, messageContent);

    return {
      success: true,
      whatsappMessageId: sent?.key?.id,
      isLive: true,
      sender: session.phoneNumber || 'Linked WhatsApp Device'
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Failed to dispatch message via WhatsApp Web'
    };
  }
}

async function disconnectBaileysSession(userId) {
  const session = baileysSessions.get(userId);
  if (session && session.sock) {
    try {
      await session.sock.logout();
    } catch (_) {}
    try {
      session.sock.end(undefined);
    } catch (_) {}
  }
  baileysSessions.delete(userId);
  baileysInitLocks.delete(userId);

  const userSessionDir = getUserSessionDir(userId);
  try {
    fs.rmSync(userSessionDir, { recursive: true, force: true });
  } catch (_) {}

  try {
    db.prepare(`
      UPDATE whatsapp_config
      SET baileysConnected = 0,
          baileysPhoneNumber = NULL,
          baileysPushName = NULL,
          updatedAt = ?
      WHERE userId = ?
    `).run(new Date().toISOString(), userId);

    logAudit(userId, 'WHATSAPP_DEVICE_DISCONNECTED', 'WhatsAppConfig', {});
  } catch (_) {}

  return true;
}

function autoRestoreBaileysSessions() {
  try {
    if (!fs.existsSync(SESSIONS_DIR)) return;
    const items = fs.readdirSync(SESSIONS_DIR, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory() && item.name.startsWith('user_')) {
        const uId = item.name.startsWith('user_') ? item.name : `user_${item.name}`;
        const credsFile = path.join(SESSIONS_DIR, item.name, 'creds.json');
        if (fs.existsSync(credsFile)) {
          console.log(`[Baileys] Auto-restoring session for user: ${uId}`);
          initBaileysSession(uId).catch((e) => {
            console.error(`[Baileys] Auto-restore failed for ${uId}:`, e.message);
          });
        }
      }
    }
  } catch (err) {
    console.error('[Baileys] Error scanning session directory:', err);
  }
}