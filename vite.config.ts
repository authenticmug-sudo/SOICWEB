import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function spreadsheetProxyPlugin(): Plugin {
  const handler = async (req: any, res: any) => {
    try {
      const host = req.headers.host || 'localhost:3000';
      const urlObj = new URL(req.url, `http://${host}`);
      const rawParam = urlObj.searchParams.get('url') || urlObj.searchParams.get('id') || '';
      const requestedFormat = urlObj.searchParams.get('format') || 'xlsx';
      const requestedSheet = urlObj.searchParams.get('sheet') || '';
      
      if (!rawParam) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Parameter url atau id spreadsheet wajib disertakan' }));
        return;
      }

      let spreadsheetId = '';
      const rawDecoded = decodeURIComponent(rawParam);
      const match = rawDecoded.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        spreadsheetId = match[1];
      } else if (/^[a-zA-Z0-9-_]{15,}$/.test(rawDecoded)) {
        spreadsheetId = rawDecoded;
      } else {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Format URL atau ID Google Spreadsheet tidak valid' }));
        return;
      }

      let fetchUrl = '';
      if (requestedFormat === 'csv') {
        const sheetParam = requestedSheet ? `&sheet=${encodeURIComponent(requestedSheet)}` : '';
        fetchUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv${sheetParam}`;
      } else {
        fetchUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(fetchUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      clearTimeout(timer);

      if (!response.ok) {
        res.statusCode = response.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ 
          error: `Gagal mengakses Google Spreadsheet (${response.status}: ${response.statusText}). Pastikan link dibagikan dengan hak akses 'Viewer / Siapa saja yang memiliki link dapat melihat'.` 
        }));
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        // Google returned HTML login redirect instead of spreadsheet data
        res.statusCode = 403;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ 
          error: 'Spreadsheet belum dibuka untuk publik. Silakan buka file di Google Sheets, klik tombol "Bagikan" -> pilih "Siapa saja yang memiliki link" -> "Pelihat (Viewer)".' 
        }));
        return;
      }

      const arrayBuf = await response.arrayBuffer();
      res.statusCode = 200;
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (requestedFormat === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="sheet.csv"');
      } else {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="master_toko_spreadsheet.xlsx"');
      }
      res.end(Buffer.from(arrayBuf));
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err?.name === 'AbortError' ? 'Koneksi ke Google Sheets timeout (12 detik). Pastikan link aktif.' : (err?.message || 'Server error saat mengambil spreadsheet') }));
    }
  };

  return {
    name: 'spreadsheet-proxy',
    configureServer(server) {
      server.middlewares.use('/api/fetch-spreadsheet', handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/fetch-spreadsheet', handler);
    }
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), spreadsheetProxyPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
