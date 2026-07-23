import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['index.ts'],
  format: ['cjs', 'esm'], // Build for commonJS and ESmodules
  dts: true, // Generate declaration file (.d.ts)
  sourcemap: true,
  clean: true, // Clean the output directory before each build
  external: ['react', 'react-dom'], // Exclude peer dependencies from the bundle
  minify: true,
  injectStyle: true, // Injects CSS into JS so users don't have to import it separately
});
