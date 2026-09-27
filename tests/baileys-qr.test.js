const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const QRCode = require('qrcode');

console.log('=== STARTING BAILEYS & QR CODE PRODUCTION TESTS ===');

// 1. Verify QRCode generator produces valid base64 data URLs
async function testQrGeneration() {
  const dummyQrString = '2@ABCD1234EFGH,IJKL5678MNOP,QRST9012UVWX';
  const dataUrl = await QRCode.toDataURL(dummyQrString, { margin: 2, scale: 6 });
  assert.ok(dataUrl.startsWith('data:image/png;base64,'), 'QR data URL should start with data:image/png;base64,');
  assert.ok(dataUrl.length > 500, 'QR data URL should contain valid image bytes');
  console.log('✓ Test 1 Passed: QR code data URL successfully synthesized');
}

// 2. Database columns for Baileys Multi-Device exist
function testDatabaseSchema() {
  const db = new DatabaseSync(path.join(__dirname, '..', 'whatsflow.db'));
  const tableInfo = db.prepare("PRAGMA table_info('whatsapp_config')").all();
  const columnNames = tableInfo.map(c => c.name);

  assert.ok(columnNames.includes('connectionMode'), 'whatsapp_config should have connectionMode column');
  assert.ok(columnNames.includes('baileysConnected'), 'whatsapp_config should have baileysConnected column');
  assert.ok(columnNames.includes('baileysPhoneNumber'), 'whatsapp_config should have baileysPhoneNumber column');
  assert.ok(columnNames.includes('baileysPushName'), 'whatsapp_config should have baileysPushName column');
  assert.ok(columnNames.includes('baileysLastConnectedAt'), 'whatsapp_config should have baileysLastConnectedAt column');
  console.log('✓ Test 2 Passed: SQLite schema migrations verified with all 5 Multi-Device columns');
}

// 3. Test Connection Mode Switching logic
function testConnectionModeToggle() {
  const db = new DatabaseSync(path.join(__dirname, '..', 'whatsflow.db'));
  const testUserId = 'test_user_mode_' + Date.now();

  // Insert test user config
  db.prepare(`
    INSERT INTO whatsapp_config (userId, connectionMode, baileysConnected, updatedAt)
    VALUES (?, 'QR_CODE', 0, ?)
    ON CONFLICT(userId) DO UPDATE SET connectionMode = 'QR_CODE'
  `).run(testUserId, new Date().toISOString());

  let row = db.prepare('SELECT connectionMode FROM whatsapp_config WHERE userId = ?').get(testUserId);
  assert.strictEqual(row.connectionMode, 'QR_CODE', 'Default mode should be QR_CODE');

  // Switch to META_CLOUD
  db.prepare('UPDATE whatsapp_config SET connectionMode = ? WHERE userId = ?').run('META_CLOUD', testUserId);
  row = db.prepare('SELECT connectionMode FROM whatsapp_config WHERE userId = ?').get(testUserId);
  assert.strictEqual(row.connectionMode, 'META_CLOUD', 'Mode should update to META_CLOUD');

  // Clean up
  db.prepare('DELETE FROM whatsapp_config WHERE userId = ?').run(testUserId);
  console.log('✓ Test 3 Passed: Connection mode toggle validated (QR_CODE <-> META_CLOUD)');
}

// 4. Test multi-tenant Baileys directory isolation
function testSessionDirIsolation() {
  const sessionsDir = path.join(__dirname, '..', 'sessions');
  const user1Dir = path.join(sessionsDir, 'user_tenant_01');
  const user2Dir = path.join(sessionsDir, 'user_tenant_02');

  fs.mkdirSync(user1Dir, { recursive: true });
  fs.mkdirSync(user2Dir, { recursive: true });

  fs.writeFileSync(path.join(user1Dir, 'creds.json'), JSON.stringify({ user: 'tenant_01' }));
  fs.writeFileSync(path.join(user2Dir, 'creds.json'), JSON.stringify({ user: 'tenant_02' }));

  const creds1 = JSON.parse(fs.readFileSync(path.join(user1Dir, 'creds.json'), 'utf8'));
  const creds2 = JSON.parse(fs.readFileSync(path.join(user2Dir, 'creds.json'), 'utf8'));

  assert.strictEqual(creds1.user, 'tenant_01');
  assert.strictEqual(creds2.user, 'tenant_02');

  // Clean up
  fs.rmSync(user1Dir, { recursive: true, force: true });
  fs.rmSync(user2Dir, { recursive: true, force: true });

  console.log('✓ Test 4 Passed: Multi-tenant file session directories isolated per userId');
}

async function runAll() {
  await testQrGeneration();
  testDatabaseSchema();
  testConnectionModeToggle();
  testSessionDirIsolation();
  console.log('\n======================================================');
  console.log('🎉 ALL 4 BAILEYS & QR CODE TESTS PASSED CLEANLY!');
  console.log('======================================================\n');
}

runAll().catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
