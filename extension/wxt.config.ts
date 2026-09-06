import { resolve } from 'node:path';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Mine · 由我',
    short_name: 'Mine',
    description: 'A freedom layer for the web: the page adapts to you, in place, transparently, reversibly. 让任何页面由你决定。',
    permissions: ['storage', 'activeTab', 'sidePanel', 'scripting'],
    host_permissions: ['<all_urls>'],
    action: { default_title: 'Make it mine · 变成我的' },
    web_accessible_resources: [{ resources: ['fonts/*'], matches: ['<all_urls>'] }],
    commands: {
      'toggle-panel': { suggested_key: { default: 'Alt+Shift+M' }, description: 'Open or close the Mine panel' },
      'make-it-mine': { suggested_key: { default: 'Alt+Shift+I' }, description: 'Make it mine (Focus) / back to original' },
    },
  },
  vite: () => ({
    resolve: { alias: { '@engine': resolve(__dirname, '../src/engine'), '@app': resolve(__dirname, '../src'), '@server': resolve(__dirname, '../server') } },
  }),
  webExt: { disabled: process.env.WXT_NO_OPEN === '1' },
});
