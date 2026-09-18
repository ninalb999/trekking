import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';

// Isolated simulated GPS, never injected in the app or saved to Supabase.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const browser = await chromium.launch({ headless: true, channel: process.env.TEST_BROWSER || 'chrome' });
const context = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await context.addInitScript(() => {
  let nextId = 1, current;
  const watches = new Map();
  Object.defineProperty(navigator, 'geolocation', { value: {
    watchPosition(success, error) { const id = nextId++; watches.set(id, { success, error }); return id; },
    clearWatch(id) { watches.delete(id); },
    getCurrentPosition(success, error) { current ? success(current) : error({ code: 2 }); },
  } });
  window.__gps = (latitude, longitude, accuracy) => {
    current = { coords: { latitude, longitude, accuracy }, timestamp: Date.now() };
    for (const watcher of watches.values()) watcher.success(current);
  };
});
async function click(name) {
  const target = page.getByRole(['Inicio', 'Grabar', 'Mis rutas'].includes(name) ? 'tab' : 'button', { name, exact: true });
  await target.scrollIntoViewIfNeeded();
  await page.clock.runFor(250);
  await target.click();
  await page.clock.runFor(100);
}
const localRoute = () => page.evaluate(() => {
  const key = Object.keys(localStorage).find(key => key.startsWith('trekking:route:v1:'));
  return key ? JSON.parse(localStorage.getItem(key)) : null;
});
async function waitFor(check, message) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(message);
}
async function gps(lat, accuracy = 5) {
  await page.clock.fastForward(5000);
  await page.evaluate(({ lat, accuracy }) => window.__gps(lat, -68.15, accuracy), { lat, accuracy });
  await page.clock.runFor(100);
}
try {
  await page.goto(process.env.TEST_URL ?? 'http://localhost:8081', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.getByRole('button', { name: 'Continuar sin cuenta', exact: true }).waitFor({ timeout: 120000 });
  await page.waitForTimeout(3000);
  await page.clock.install();
  await click('Continuar sin cuenta');
  await click('Grabar');
  const navTop = (await page.getByRole('tab', { name: 'Inicio', exact: true }).boundingBox()).y;
  await click('Iniciar grabacion');
  console.log('Recording started');
  await gps(-16.5, 500);
  assert.match(await page.locator('body').innerText(), /Ubicacion aproximada/);
  await gps(-16.5);
  for (let n = 1; n <= 10; n++) await gps(-16.5 + n * 0.00005);
  await page.clock.fastForward(5000);
  await waitFor(async () => (await localRoute())?.distance >= 50, 'Distance did not update');
  const beforeLoss = await localRoute();
  await page.clock.fastForward(20000);
  await page.clock.runFor(1100);
  await waitFor(async () => /Senal GPS perdida/.test(await page.locator('body').innerText()), 'GPS loss status did not update');
  await gps(-16.49);
  await page.clock.fastForward(5000);
  await waitFor(async () => (await localRoute())?.points.at(-1).segment > 0, 'Signal recovery did not split the track');
  const recovered = await localRoute();
  console.log('GPS recovery verified');
  assert.equal(recovered.distance, beforeLoss.distance);
  assert.ok(recovered.elapsed > beforeLoss.elapsed);
  const map = page.frameLocator('iframe[title="Mapa del recorrido GPS"]');
  await map.locator('.leaflet-container').waitFor();
  assert.ok(await map.locator('path.leaflet-interactive').count() >= 2);
  await context.setOffline(true);
  await click('Agregar punto');
  await click('Guardar punto');
  assert.match(await page.locator('body').innerText(), /Escribe el nombre/);
  await page.getByRole('textbox', { name: 'Nombre del punto', exact: true }).fill('Mirador de prueba');
  await page.getByRole('checkbox', { name: 'Agua', exact: true }).click();
  await click('Guardar punto');
  await page.getByRole('button', { name: 'Pausar ruta', exact: true }).waitFor();
  await gps(-16.49);
  await gps(-16.48995);
  await click('Finalizar');
  await click('Guardar ruta');
  assert.match(await page.locator('body').innerText(), /Escribe el nombre de la ruta/);
  await page.getByRole('textbox', { name: 'Nombre de la ruta', exact: true }).fill('Trekking prueba offline');
  await page.getByRole('textbox', { name: 'Descripcion de la ruta', exact: true }).fill('Recorrido simulado para pruebas');
  await click('Guardar ruta');
  await page.getByRole('button', { name: 'Abrir Trekking prueba offline', exact: true }).waitFor();
  console.log('Offline route saved');
  const saved = await localRoute();
  assert.equal(saved.status, 'finished');
  assert.equal(saved.places.length, 1);
  assert.deepEqual(saved.places[0].services, ['water']);
  assert.equal(saved.ownerId, null);
  assert.ok(saved.elapsed > 0 && saved.distance > 0);
  const afterNavTop = (await page.getByRole('tab', { name: 'Inicio', exact: true }).boundingBox()).y;
  assert.ok(Math.abs(navTop - afterNavTop) < 2, 'Bottom navigation moved');
  await context.setOffline(false);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await click('Continuar sin cuenta');
  await click('Mis rutas');
  await click('Abrir Trekking prueba offline');
  assert.match(await page.locator('body').innerText(), /Mirador de prueba/);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'PASS', distanceMeters: saved.distance, elapsedMs: saved.elapsed, points: saved.points.length, places: saved.places.length, segments: [...new Set(saved.points.map(point => point.segment))], checked: 'GPS loss, offline forms, reload persistence, map layers, fixed navigation; no screenshots' }));
} catch (error) {
  console.error((await page.locator('body').innerText()).slice(0, 6000));
  console.error(errors);
  throw error;
} finally { await browser.close(); }
