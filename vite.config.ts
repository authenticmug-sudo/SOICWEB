import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function spreadsheetProxyPlugin(): Plugin {
  return {
    name: 'spreadsheet-proxy',
    configureServer(server) {
      server.middlewares.use('/api/fetch-spreadsheet', async (req: any, res: any) => {
        try {
          const host = req.headers.host || 'localhost:3000';
          const urlObj = new URL(req.url, `http://${host}`);
          const rawParam = urlObj.searchParams.get('url') || urlObj.searchParams.get('id') || '';
          
          if (!rawParam) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Parameter url atau id spreadsheet wajib disertakan' }));
            return;
          }

          let fetchUrl = decodeURIComponent(rawParam);
          const match = fetchUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
          if (match) {
            fetchUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=xlsx`;
          } else if (/^[a-zA-Z0-9-_]{20,}$/.test(fetchUrl)) {
            fetchUrl = `https://docs.google.com/spreadsheets/d/${fetchUrl}/export?format=xlsx`;
          }

          const response = await fetch(fetchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });

          if (!response.ok) {
            res.statusCode = response.status;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
              error: `Gagal mengakses Google Spreadsheet (${response.status}: ${response.statusText}). Pastikan link dibagikan dengan akses 'Viewer / Siapa saja yang memiliki link dapat melihat'.` 
            }));
            return;
          }

          const arrayBuf = await response.arrayBuffer();
          res.statusCode = 200;
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', 'attachment; filename="master_toko_spreadsheet.xlsx"');
          res.end(Buffer.from(arrayBuf));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Server error saat mengambil spreadsheet' }));
        }
      });
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
