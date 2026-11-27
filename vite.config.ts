import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import {
  BUILTIN_GENE_OVERRIDES_REL_PATH,
  serializeBuiltinGeneOverridesFile,
  validateBuiltinGeneOverridesFile,
} from './src/game/builtinGeneOverrides';

const OVERRIDES_FILE_ABS_PATH = path.resolve(__dirname, BUILTIN_GENE_OVERRIDES_REL_PATH);
const MAX_BODY_BYTES = 2 * 1024 * 1024;

function devGeneEditorPlugin(): Plugin {
  return {
    name: 'noodle-morphs-dev-gene-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__noodle_morphs_dev__/git-status', (req, res, next) => {
        if (req.method !== 'GET') return next();
        execFile(
          'git',
          ['status', '--porcelain'],
          { cwd: __dirname, timeout: 3000 },
          (err, stdout) => {
            res.setHeader('Content-Type', 'application/json');
            if (err) {
              res.end(
                JSON.stringify({
                  available: false,
                  clean: false,
                  dirtyCount: 0,
                  files: [],
                })
              );
              return;
            }
            const lines = stdout
              .split(/\r?\n/)
              .map((l) => l.trimEnd())
              .filter((l) => l.length > 0);
            res.end(
              JSON.stringify({
                available: true,
                clean: lines.length === 0,
                dirtyCount: lines.length,
                files: lines.slice(0, 12),
              })
            );
          }
        );
      });

      server.middlewares.use('/__noodle_morphs_dev__/builtin-genes', (req, res, next) => {
        if (req.method !== 'POST') return next();

        let body = '';
        let tooLarge = false;
        req.on('data', (chunk: Buffer) => {
          body += chunk.toString('utf8');
          if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
            tooLarge = true;
          }
        });

        req.on('end', () => {
          res.setHeader('Content-Type', 'application/json');
          if (tooLarge) {
            res.statusCode = 413;
            res.end(JSON.stringify({ ok: false, errors: ['Payload exceeds 2 MiB limit.'] }));
            return;
          }

          let parsed: unknown;
          try {
            parsed = JSON.parse(body);
          } catch (err) {
            res.statusCode = 400;
            res.end(
              JSON.stringify({
                ok: false,
                errors: [`Invalid JSON: ${err instanceof Error ? err.message : 'parse error'}`],
              })
            );
            return;
          }

          const validation = validateBuiltinGeneOverridesFile(parsed);
          if (!validation.ok) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, errors: validation.errors }));
            return;
          }

          try {
            const source = serializeBuiltinGeneOverridesFile(validation.data);
            fs.writeFileSync(OVERRIDES_FILE_ABS_PATH, source, 'utf8');
            res.statusCode = 200;
            res.end(
              JSON.stringify({
                ok: true,
                file: BUILTIN_GENE_OVERRIDES_REL_PATH,
                geneCount: Object.keys(validation.data.genes).length,
              })
            );
          } catch (err) {
            res.statusCode = 500;
            res.end(
              JSON.stringify({
                ok: false,
                errors: [
                  `Failed to write ${BUILTIN_GENE_OVERRIDES_REL_PATH}: ${
                    err instanceof Error ? err.message : 'write error'
                  }`,
                ],
              })
            );
          }
        });
      });
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const isGeneEditorServe = command === 'serve' && mode === 'gene-editor';
  return {
    base: '/noodle-morphs/',
    plugins: [react(), tailwindcss(), ...(isGeneEditorServe ? [devGeneEditorPlugin()] : [])],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
