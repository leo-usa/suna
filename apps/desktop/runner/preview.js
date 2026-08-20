'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { dobbyRoots, listProjectFolders } = require('./workspace');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf',
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
}

function under(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function findPreviewFile(roots, urlPath, home) {
  const relative = urlPath.replace(/^\/+/, '');
  const parts = relative.split('/').filter(Boolean);
  const candidates = [relative];
  if (parts.length >= 2 && parts[1] === 'workspace') {
    candidates.push([parts[0], ...parts.slice(2)].join('/'));
  }

  if (parts.length && home) {
    try {
      const projectFolders = listProjectFolders(home, parts[0]);
      const rest = parts.slice(parts[1] === 'workspace' ? 2 : 1).join('/');
      for (const folder of projectFolders) {
        const candidate = rest ? path.resolve(path.join(folder, rest)) : folder;
        if (candidate !== folder && !under(folder, candidate)) continue;
        if (fs.existsSync(candidate)) return candidate;
      }
    } catch (_) {
      /* ignore invalid project keys */
    }
  }

  let fallback = null;
  for (const candidateRelative of candidates) {
    for (const root of roots) {
      const candidate = path.resolve(path.join(root, candidateRelative));
      if (!under(root, candidate)) continue;
      if (fs.existsSync(candidate)) return candidate;
      if (!fallback) fallback = candidate;
    }
  }
  return fallback;
}

function isHealthPath(urlPath) {
  return urlPath === '/health' || /\/health\/?$/.test(urlPath);
}

function startPreviewServer({ port, home } = {}) {
  const roots = dobbyRoots(home || os.homedir());
  for (const root of roots) {
    fs.mkdirSync(root, { recursive: true });
  }

  const server = http.createServer((req, res) => {
    cors(res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      res.end('Method not allowed');
      return;
    }

    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (isHealthPath(urlPath)) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      res.end(JSON.stringify({ status: 'healthy', services: {}, critical_services: [] }));
      return;
    }

    const filePath = findPreviewFile(roots, urlPath, home || os.homedir());
    if (!filePath) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    fs.stat(filePath, (err, stat) => {
      if (err || !stat) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      let target = filePath;
      if (stat.isDirectory()) {
        target = path.join(filePath, 'index.html');
        if (!fs.existsSync(target)) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
      }
      const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      fs.createReadStream(target).pipe(res);
    });
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

module.exports = { startPreviewServer, findPreviewFile };
