import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    printWidth: 90,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: true,
    jsxSingleQuote: false,
    trailingComma: 'all',
    arrowParens: 'always',
    bracketSpacing: true,
    bracketSameLine: false,
    endOfLine: 'lf',
    proseWrap: 'preserve',
    htmlWhitespaceSensitivity: 'ignore',
    experimentalPreserveEmptyLines: true,
    singleAttributePerLine: true,
    sortImports: true,
    sortTailwindcss: true,
  },
  lint: {
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
  staged: {
    '*': 'vp check --fix',
  },
});
