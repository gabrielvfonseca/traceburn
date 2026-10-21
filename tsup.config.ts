import path from 'node:path';
import type { OnResolveArgs, OnResolveResult, PluginBuild } from 'esbuild';
import { defineConfig } from 'tsup';

const SRC_DIR = path.resolve(import.meta.dirname, 'src');
const ALIAS_REGEX = /^@\//;
const JS_EXT_REGEX = /\.js$/;

const pathAlias = () => ({
  name: 'path-alias',
  setup(build: PluginBuild) {
    build.onResolve(
      { filter: ALIAS_REGEX },
      (args: OnResolveArgs): OnResolveResult => {
        const resolvedPath = path
          .join(SRC_DIR, args.path.replace(ALIAS_REGEX, ''))
          .replace(JS_EXT_REGEX, '.ts');
        return { namespace: 'file', path: resolvedPath };
      },
    );
  },
});

export default defineConfig({
  banner: { js: '#!/usr/bin/env node' },
  clean: true,
  dts: { entry: 'src/index.ts' },
  entry: ['src/index.ts', 'src/cli.ts'],
  esbuildPlugins: [pathAlias()],
  format: ['esm'],
  sourcemap: true,
  target: 'node18',
});
