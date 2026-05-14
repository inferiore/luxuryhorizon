#!/usr/bin/env node
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, terminal: false });

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

rl.on('line', (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }

  if (msg.method === 'initialize') {
    send({ jsonrpc: '2.0', id: msg.id, result: {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'whatsapp-notify', version: '1.0.0' }
    }});

  } else if (msg.method === 'notifications/initialized') {
    // no-op

  } else if (msg.method === 'tools/list') {
    send({ jsonrpc: '2.0', id: msg.id, result: { tools: [{
      name: 'notify_admin',
      description: 'Envía un mensaje de WhatsApp a la administradora Alejandra (+573044848791). Úsala para notificar transferencias a humano o alertas de pago.',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Texto del mensaje a enviar a Alejandra' }
        },
        required: ['message']
      }
    }]}});

  } else if (msg.method === 'tools/call') {
    if (msg.params?.name === 'notify_admin') {
      try {
        const message = (msg.params.arguments?.message || '').replace(/"/g, '\\"').replace(/\n/g, ' ');
        execSync(
          `node /app/dist/index.js message send --channel whatsapp --target +573044848791 --message "${message}"`,
          { stdio: 'pipe', timeout: 15000 }
        );
        send({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: 'Notificación enviada a Alejandra.' }] }});
      } catch (err) {
        send({ jsonrpc: '2.0', id: msg.id, result: {
          content: [{ type: 'text', text: 'Error al enviar: ' + err.message }],
          isError: true
        }});
      }
    } else {
      send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Tool not found' }});
    }

  } else {
    if (msg.id != null) {
      send({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Method not found' }});
    }
  }
});
