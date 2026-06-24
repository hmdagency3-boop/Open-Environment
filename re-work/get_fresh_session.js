/**
 * PARSE FRESH SESSION FROM FRIDA OUTPUT
 * الصق output الـ Frida هنا وهيستخرج الـ session تلقائيًا
 *
 * Usage:
 *   node get_fresh_session.js <frida_output_file.txt>
 */
const fs   = require('fs');
const path = require('path');
const { DittoSession } = require('./ditto_client');

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('Usage: node get_fresh_session.js <frida_output_file.txt>');
  process.exit(1);
}

const data = fs.readFileSync(file, 'utf8');

// Extract ticket
const ticketMatch = data.match(/"ticket":"([a-f0-9]{32})"/);
// Extract access_token (Ditto internal, 32 hex chars)
const atMatches = [...data.matchAll(/"access_token":"([a-f0-9]{32})"/g)];
// Extract uid
const uidMatches = [...data.matchAll(/"uid":(\d{4,10})/g)];
// Extract deviceId (33 chars)
const deviceIdMatch = data.match(/deviceId=([a-f0-9a-zA-Z]{32,34})/);

const ticket      = ticketMatch?.[1];
const access_token = atMatches.length > 0 ? atMatches[atMatches.length-1][1] : null;
const uid         = uidMatches.length > 0 ? uidMatches[0][1] : null;
const deviceId    = deviceIdMatch?.[1];

console.log('=== Extracted Session ===');
console.log('uid:          ', uid);
console.log('ticket:       ', ticket);
console.log('access_token: ', access_token);
console.log('deviceId:     ', deviceId);

if (!uid || !ticket || !deviceId) {
  console.error('\n❌ Could not extract complete session. Check the Frida output file.');
  process.exit(1);
}

// Save session
const session = new DittoSession();
session.update({ uid, access_token, ticket, deviceId });
console.log('\n✅ Session saved to ditto_session.json');
console.log('Now run: node ditto_client.js user 187356');
