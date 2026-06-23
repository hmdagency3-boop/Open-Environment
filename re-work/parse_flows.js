#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');

const buf = fs.readFileSync('/home/runner/workspace/attached_assets/flows_1782235851805');

// ─── tnetstring parser ────────────────────────────────────────────────────────
function parseTns(buf, offset = 0) {
  let colon = buf.indexOf(0x3a, offset); // ':'
  if (colon === -1) return null;
  const lenStr = buf.slice(offset, colon).toString('ascii');
  const len = parseInt(lenStr, 10);
  if (isNaN(len)) return null;
  
  const dataStart = colon + 1;
  const dataEnd = dataStart + len;
  const type = buf[dataEnd];
  const data = buf.slice(dataStart, dataEnd);
  const next = dataEnd + 1;
  
  let value;
  switch (type) {
    case 0x2c: // ',' = bytes/string
      value = data;
      break;
    case 0x23: // '#' = int
      value = parseInt(data.toString('ascii'), 10);
      break;
    case 0x5e: // '^' = float
      value = parseFloat(data.toString('ascii'));
      break;
    case 0x21: // '!' = bool
      value = data.toString('ascii') === 'true';
      break;
    case 0x7e: // '~' = null
      value = null;
      break;
    case 0x7d: { // '}' = dict
      const dict = {};
      let pos = 0;
      while (pos < data.length) {
        const keyRes = parseTns(data, pos);
        if (!keyRes) break;
        pos = keyRes.next;
        const valRes = parseTns(data, pos);
        if (!valRes) break;
        pos = valRes.next;
        const key = Buffer.isBuffer(keyRes.value) ? keyRes.value.toString('utf8') : String(keyRes.value);
        dict[key] = valRes.value;
      }
      value = dict;
      break;
    }
    case 0x5d: { // ']' = list
      const list = [];
      let pos = 0;
      while (pos < data.length) {
        const res = parseTns(data, pos);
        if (!res) break;
        list.push(res.value);
        pos = res.next;
      }
      value = list;
      break;
    }
    default:
      value = data;
  }
  return { value, next };
}

// ─── Parse all flows ──────────────────────────────────────────────────────────
const flows = [];
let pos = 0;
while (pos < buf.length) {
  const res = parseTns(buf, pos);
  if (!res) break;
  flows.push(res.value);
  pos = res.next;
}

console.log(`Parsed ${flows.length} flows\n`);

// ─── Helper to extract readable content ──────────────────────────────────────
function bufToStr(v, maxLen = 500) {
  if (!v) return String(v);
  if (Buffer.isBuffer(v)) {
    // Try UTF-8
    try {
      const s = v.toString('utf8');
      const printable = s.split('').filter(c => c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) <= 0x7e).length;
      if (printable / s.length > 0.75) return s.slice(0, maxLen);
    } catch(e) {}
    return '<binary ' + v.length + 'b> ' + v.slice(0, 32).toString('hex');
  }
  if (typeof v === 'object') return JSON.stringify(v, (k, val) => {
    if (Buffer.isBuffer(val)) return bufToStr(val, 200);
    return val;
  }, 2).slice(0, maxLen);
  return String(v);
}

function extractHeaders(headers) {
  if (!Array.isArray(headers)) return {};
  const result = {};
  for (let i = 0; i < headers.length; i += 2) {
    const k = Buffer.isBuffer(headers[i]) ? headers[i].toString('utf8') : String(headers[i]);
    const v = Buffer.isBuffer(headers[i+1]) ? headers[i+1].toString('utf8') : String(headers[i+1]);
    result[k.toLowerCase()] = v;
  }
  return result;
}

// ─── Process each flow ────────────────────────────────────────────────────────
function processFlow(flow, i) {
  if (!flow || typeof flow !== 'object') return;
  
  const type = flow.type;
  const req = flow.request;
  const resp = flow.response;
  
  if (!req) return;
  
  const method = Buffer.isBuffer(req.method) ? req.method.toString() : String(req.method || '');
  const host   = Buffer.isBuffer(req.host) ? req.host.toString() : String(req.host || '');
  const path_  = Buffer.isBuffer(req.path) ? req.path.toString() : String(req.path || '');
  const url = `${method} ${host}${path_}`;
  
  // Request body
  let reqBody = '';
  if (req.content && Buffer.isBuffer(req.content) && req.content.length > 0) {
    reqBody = req.content.toString('utf8').replace(/[^\x20-\x7e\n&=]/g, '·').slice(0, 1000);
  }
  
  // Response body
  let respBody = '';
  let respCode = '';
  if (resp) {
    respCode = String(resp.status_code || '');
    if (resp.content && Buffer.isBuffer(resp.content) && resp.content.length > 0) {
      // Try JSON parse first
      try {
        const j = JSON.parse(resp.content.toString('utf8'));
        respBody = JSON.stringify(j, null, 2);
      } catch(e) {
        respBody = resp.content.toString('utf8').replace(/[^\x20-\x7e\n]/g, '·').slice(0, 2000);
      }
    }
  }
  
  console.log(`\n══════════ FLOW ${i} ══════════`);
  console.log(`${url}  [${respCode}]`);
  
  if (reqBody) {
    console.log(`\n── REQUEST BODY ──`);
    // Decode URL-encoded ed field
    const edMatch = reqBody.match(/ed=([^&\s·]+)/);
    if (edMatch) {
      const edRaw = edMatch[1];
      try {
        const edDecoded = decodeURIComponent(edRaw);
        const edBytes = Buffer.from(edDecoded, 'base64');
        console.log(`  ed (b64, ${edBytes.length} bytes): ${edDecoded.slice(0,80)}...`);
        console.log(`  ed (hex first 32): ${edBytes.slice(0,32).toString('hex')}`);
      } catch(e) {
        console.log(`  ed: ${edRaw.slice(0,100)}`);
      }
    } else {
      console.log(reqBody.slice(0, 400));
    }
  }
  
  if (respBody) {
    console.log(`\n── RESPONSE BODY ──`);
    console.log(respBody.slice(0, 2000));
  }
}

flows.forEach(processFlow);

// ─── Specifically look for login/token flows ─────────────────────────────────
console.log('\n\n════════ SEARCHING FOR TOKEN/LOGIN RESPONSES ════════\n');

flows.forEach((flow, i) => {
  if (!flow || typeof flow !== 'object') return;
  const resp = flow.response;
  const req = flow.request;
  if (!resp || !resp.content || !Buffer.isBuffer(resp.content)) return;
  
  const body = resp.content.toString('utf8');
  
  // Look for token fields in JSON responses
  if (body.includes('token') || body.includes('Token') || body.includes('"code"') || body.includes('ticket') || body.includes('auth')) {
    const path_ = req && req.path ? (Buffer.isBuffer(req.path) ? req.path.toString() : req.path) : '';
    console.log(`Flow ${i}: ${path_} → len=${resp.content.length}`);
    try {
      const j = JSON.parse(body);
      console.log(JSON.stringify(j, null, 2).slice(0, 1000));
    } catch(e) {
      console.log(body.slice(0, 500));
    }
    console.log('---');
  }
});
