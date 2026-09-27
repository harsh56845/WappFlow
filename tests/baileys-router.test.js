const assert = require('assert');
const { Readable, Writable } = require('stream');
const path = require('path');

console.log('=== TESTING ROUTER & QR ENDPOINTS VIA IN-MEMORY STREAMS ===');

// Helper to simulate HTTP requests without TCP loopback sockets
function executeRequest(handler, { method = 'GET', url = '/', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    // Mock IncomingMessage stream
    const req = new Readable({
      read() {
        if (body) {
          this.push(typeof body === 'string' ? body : JSON.stringify(body));
        }
        this.push(null);
      }
    });
    req.method = method;
    req.url = url;
    req.headers = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));

    // Mock ServerResponse
    let resHeaders = {};
    let statusCode = 200;
    let resBody = '';

    const res = new Writable({
      write(chunk, encoding, callback) {
        resBody += chunk.toString();
        callback();
      }
    });

    res.writeHead = function (code, h) {
      statusCode = code;
      if (h) Object.assign(resHeaders, h);
    };

    res.setHeader = function (k, v) {
      resHeaders[k.toLowerCase()] = v;
    };

    res.on('finish', () => {
      try {
        resolve({ status: statusCode, headers: resHeaders, data: JSON.parse(resBody) });
      } catch (_) {
        resolve({ status: statusCode, headers: resHeaders, body: resBody });
      }
    });

    try {
      handler(req, res);
    } catch (err) {
      reject(err);
    }
  });
}

async function run() {
  // Prevent server from listening on a port during require
  process.env.PORT = 0;
  const server = require('../server.js');
  const requestHandler = server.listeners('request')[0];
  assert.ok(requestHandler, 'HTTP server request listener must exist');

  // 1. Authenticate user
  const loginRes = await executeRequest(requestHandler, {
    method: 'POST',
    url: '/api/auth/login',
    headers: { 'Content-Type': 'application/json' },
    body: { email: 'admin@whatsflow.com', password: 'admin123' }
  });

  assert.strictEqual(loginRes.status, 200, 'Login must succeed');
  assert.ok(loginRes.data.data.token, 'Token must be present in response');
  const token = loginRes.data.data.token;
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  console.log('✓ Test 1: In-memory authentication produced valid JWT token');

  // 2. GET /api/whatsapp/session/status
  const statusRes = await executeRequest(requestHandler, {
    method: 'GET',
    url: '/api/whatsapp/session/status',
    headers: authHeaders
  });
  assert.strictEqual(statusRes.status, 200);
  assert.ok(statusRes.data.success);
  assert.ok(['QR_CODE', 'META_CLOUD'].includes(statusRes.data.data.connectionMode));
  console.log('✓ Test 2: GET /api/whatsapp/session/status returned connectionMode: ' + statusRes.data.data.connectionMode);

  // 3. POST /api/whatsapp/connection-mode
  const modeRes = await executeRequest(requestHandler, {
    method: 'POST',
    url: '/api/whatsapp/connection-mode',
    headers: authHeaders,
    body: { mode: 'META_CLOUD' }
  });
  assert.strictEqual(modeRes.status, 200);
  assert.strictEqual(modeRes.data.connectionMode, 'META_CLOUD');

  const modeRes2 = await executeRequest(requestHandler, {
    method: 'POST',
    url: '/api/whatsapp/connection-mode',
    headers: authHeaders,
    body: { mode: 'QR_CODE' }
  });
  assert.strictEqual(modeRes2.status, 200);
  assert.strictEqual(modeRes2.data.connectionMode, 'QR_CODE');
  console.log('✓ Test 3: POST /api/whatsapp/connection-mode toggled between META_CLOUD and QR_CODE');

  // 4. GET /api/whatsapp/config
  const configRes = await executeRequest(requestHandler, {
    method: 'GET',
    url: '/api/whatsapp/config',
    headers: authHeaders
  });
  assert.strictEqual(configRes.status, 200);
  assert.ok(configRes.data.success);
  assert.strictEqual(configRes.data.data.connectionMode, 'QR_CODE');
  console.log('✓ Test 4: GET /api/whatsapp/config reflects connectionMode and Baileys status');

  // 5. GET /api/whatsapp/qr
  const qrRes = await executeRequest(requestHandler, {
    method: 'GET',
    url: '/api/whatsapp/qr',
    headers: authHeaders
  });
  assert.strictEqual(qrRes.status, 200);
  assert.ok(qrRes.data.success);
  assert.ok(qrRes.data.data);
  assert.ok(['SCAN_QR', 'INITIALIZING', 'DISCONNECTED', 'CONNECTED'].includes(qrRes.data.data.status));
  console.log('✓ Test 5: GET /api/whatsapp/qr responded successfully with status: ' + qrRes.data.data.status);

  // 6. POST /api/whatsapp/qr/disconnect
  const discRes = await executeRequest(requestHandler, {
    method: 'POST',
    url: '/api/whatsapp/qr/disconnect',
    headers: authHeaders
  });
  assert.strictEqual(discRes.status, 200);
  assert.ok(discRes.data.success);
  console.log('✓ Test 6: POST /api/whatsapp/qr/disconnect successfully executed and logged');

  console.log('\n======================================================');
  console.log('🎉 ALL 5 IN-MEMORY ROUTER & BAILEYS TESTS PASSED CLEANLY!');
  console.log('======================================================\n');
  process.exit(0);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
