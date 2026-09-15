// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'supabase/tests/.artifacts/**'],
    settings: {
      'import/core-modules': ['leaflet', 'leaflet/dist/leaflet.css', 'geolib'],
    },
  },
]);
