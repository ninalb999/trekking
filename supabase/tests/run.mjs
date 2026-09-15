// Real PostgreSQL 17 tests with minimal Auth/Storage SQL fixtures.
// No remote connection, credentials, Docker or application UI is required.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const requireTools = createRequire(
  process.env.TREKKING_DB_TOOLS
    ? join(resolve(process.env.TREKKING_DB_TOOLS), 'package.json')
    : join(here, 'package.json'),
);
const { default: EmbeddedPostgres } = await import(
  pathToFileURL(requireTools.resolve('embedded-postgres')).href
);
const { introspect, sortGeneratorMetadata, generateTypescript } = await import(
  pathToFileURL(requireTools.resolve('@supabase/postgrest-typegen')).href
);

// Ask the OS for a free loopback port; avoid colliding with Supabase or other apps.
const listener = createServer();
await new Promise((resolve, reject) => {
  listener.once('error', reject);
  listener.listen(0, '127.0.0.1', resolve);
});
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
  const artifacts = join(here, '.artifacts');
await mkdir(artifacts, { recursive: true });
const databaseDir = await mkdtemp(join(artifacts, 'pg-'));
const postgres = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: randomBytes(32).toString('hex'),
  port,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-c', 'listen_addresses=127.0.0.1'],
  onLog: () => {},
  onError: (error) => console.error(error),
});

const results = [];
let db;
let failed = false;
const test = async (name, action) => {
  await action();
  results.push({ name, status: 'PASS' });
  console.log('PASS ' + name);
};
const query = (sql, values) => db.query(sql, values);
const rows = async (sql, values) => (await query(sql, values)).rows;
const count = async (table, where = 'true', values = []) =>
  Number((await rows('select count(*) n from ' + table + ' where ' + where, values))[0].n);

async function as(role, uid, action) {
  assert.ok(['anon', 'authenticated'].includes(role));
  await query('savepoint role_scope');
  await query('select set_config($1, $2, true)', [
    'request.jwt.claims', JSON.stringify({ role, ...(uid ? { sub: uid } : {}) }),
  ]);
  await query('set local role ' + role);
  try {
    assert.equal((await rows('select current_user'))[0].current_user, role);
    return await action();
  } catch (error) {
    await query('rollback to savepoint role_scope');
    throw error;
  } finally {
    await query('reset role');
    await query("select set_config('request.jwt.claims', '', true)");
    await query('release savepoint role_scope');
  }
}

async function rejected(sql, values, code = '42501') {
  await query('savepoint expected_failure');
  let error;
  try { await query(sql, values); } catch (failure) { error = failure; }
  await query('rollback to savepoint expected_failure');
  await query('release savepoint expected_failure');
  assert.equal(error?.code, code, 'Expected PostgreSQL error ' + code + ' for ' + sql);
}

try {
  console.log('Starting isolated PostgreSQL 17; no remote database will be touched.');
  await postgres.initialise();
  await postgres.start();
  db = postgres.getPgClient('postgres', '127.0.0.1');
  await db.connect();
  await query(await readFile(join(here, 'bootstrap.sql'), 'utf8'));
  const migrations = (await readdir(join(root, 'supabase/migrations')))
    .filter((name) => name.endsWith('.sql')).sort();
  for (const migration of migrations) {
    await query('begin');
    try {
      await query(await readFile(join(root, 'supabase/migrations', migration), 'utf8'));
      await query('commit');
      console.log('APPLIED ' + migration);
    } catch (error) {
      await query('rollback');
      throw new Error(migration + ': ' + error.message, { cause: error });
    }
  }
  const audit = await query(await readFile(join(here, 'security_audit.sql'), 'utf8'));
  await writeFile(join(artifacts, 'security-audit.json'),
    JSON.stringify(audit.map((statement) => statement.rows), null, 2) + '\n');

  // Introspection runs independent reads concurrently; serialize on our single pg client.
  let introspectionQueue = Promise.resolve();
  const introspectionClient = {
    query(sql) {
      const pending = introspectionQueue.then(() => db.query(sql));
      introspectionQueue = pending.catch(() => {});
      return pending;
    },
  };
  const metadata = sortGeneratorMetadata(await introspect(introspectionClient, { includedSchemas: ['public'] }));
  const generated = await generateTypescript(metadata, { detectOneToOneRelationships: true });
  const typePath = join(root, 'src/types/database.ts');
  if (process.argv.includes('--generate-types')) {
    await mkdir(dirname(typePath), { recursive: true });
    await writeFile(typePath, generated);
    console.log('GENERATED src/types/database.ts from PostgreSQL via Supabase typegen');
  } else {
    assert.equal((await readFile(typePath, 'utf8')).replace(/\r\n/g, '\n'), generated.replace(/\r\n/g, '\n'),
      'Database types drifted; run npm run db:types');
  }

  // Everything below, including fake Auth users and Storage metadata, is rolled back.
  await query('begin');
  const a = randomUUID();
  const b = randomUUID();
  const privateId = randomUUID();
  const publicId = randomUUID();
  const draftId = randomUUID();
  const recordingId = randomUUID();
  const bRouteId = randomUUID();
  const pointIds = Array.from({ length: 5 }, () => randomUUID());
  const trackIds = [randomUUID(), randomUUID()];
  const equipmentId = randomUUID();
  const pauseId = randomUUID();
  const serviceId = randomUUID();
  const privateImage = privateId + '/' + randomUUID() + '.jpg';
  const publicImage = publicId + '/' + randomUUID() + '.jpg';

  await test('01 Auth INSERT creates profiles (SQL trigger, not HTTP signup)', async () => {
    await query('insert into auth.users (id, raw_user_meta_data) values ($1,$2),($3,$4)',
      [a, { full_name: 'Usuario A' }, b, {}]);
    assert.deepEqual(await rows('select full_name from profiles where id=$1', [a]),
      [{ full_name: 'Usuario A' }]);
    assert.equal((await rows('select full_name from profiles where id=$1', [b]))[0].full_name, null);
  });
  await as('authenticated', a, async () => {
    await query('insert into routes (id,owner_id) values ($1,$2)', [privateId, a]);
    await query("insert into routes (id,owner_id,visibility,status,name,difficulty) values ($1,$2,'public','published','Camino de Prueba','escala pendiente')", [publicId, a]);
    await query("insert into routes (id,owner_id,visibility,status) values ($1,$2,'public','draft'),($3,$2,'public','recording')",
      [draftId, a, recordingId]);
  });
  await as('authenticated', b, () => query('insert into routes (id,owner_id) values ($1,$2)', [bRouteId, b]));

  await test('02 Private route visible only to A', async () => {
    await as('authenticated', a, async () => assert.equal(await count('routes', 'id=$1', [privateId]), 1));
    await as('authenticated', b, async () => assert.equal(await count('routes', 'id=$1', [privateId]), 0));
    await as('anon', null, async () => assert.equal(await count('routes', 'id=$1', [privateId]), 0));
  });
  await test('03 Public published route readable by anon and B; neither can edit', async () => {
    for (const [role, uid] of [['anon', null], ['authenticated', b]]) {
      await as(role, uid, async () => {
        assert.equal(await count('routes', 'id=$1', [publicId]), 1);
        if (role === 'anon') await rejected('update routes set name=$1 where id=$2', ['attack', publicId]);
        else assert.equal((await query('update routes set name=$1 where id=$2', ['attack', publicId])).rowCount, 0);
      });
    }
  });
  await test('04 B cannot mutate or claim A routes; A cannot transfer ownership', async () => {
    await as('authenticated', b, async () => {
      assert.equal((await query('update routes set visibility=$1 where id=$2', ['public', privateId])).rowCount, 0);
      assert.equal((await query('delete from routes where id=$1', [publicId])).rowCount, 0);
      await rejected('insert into routes(owner_id) values ($1)', [a]);
    });
    await as('authenticated', a, () => rejected('update routes set owner_id=$1 where id=$2', [b, privateId]));
  });
  await test('05 Owner can add GPS points; B cannot add points to A routes', async () => {
    await as('authenticated', a, () => query(
      "insert into route_track_points(id,route_id,sequence_no,latitude,longitude,recorded_at) values ($1,$3,2,-16.5,-68.2,'2026-01-01T10:02:00Z'),($2,$3,1,-16.4,-68.1,'2026-01-01T10:01:00Z')",
      [trackIds[1], trackIds[0], publicId]));
    await as('authenticated', b, () => rejected(
      'insert into route_track_points(route_id,sequence_no,latitude,longitude,recorded_at) values ($1,3,0,0,now())', [publicId]));
  });
  await test('06 GPS points ordered by sequence_no; duplicate sequence rejected', async () => {
    await as('anon', null, async () => assert.deepEqual(
      await rows('select sequence_no,latitude,longitude from route_track_points where route_id=$1 order by sequence_no', [publicId]),
      [{ sequence_no: 1, latitude: -16.4, longitude: -68.1 }, { sequence_no: 2, latitude: -16.5, longitude: -68.2 }]));
    await as('authenticated', a, () => rejected(
      'insert into route_track_points(route_id,sequence_no,latitude,longitude,recorded_at) values ($1,1,0,0,now())', [publicId], '23505'));
  });
  await test('07 All five manual point types preserve coordinates/name/description', async () => {
    const types = ['campamento', 'descanso', 'agua', 'tienda', 'otro'];
    await as('authenticated', a, async () => {
      for (const [i, type] of types.entries()) {
        await query('insert into route_points(id,route_id,point_type,name,description,latitude,longitude,sequence_no) values ($1,$2,$3,$4,$5,$6,$7,$8)',
          [pointIds[i], publicId, type, 'Punto ' + type, 'Detalle ' + type, -16.5, -68.1, i]);
      }
      const actual = await rows('select point_type,name,description,latitude,longitude from route_points where route_id=$1 order by sequence_no', [publicId]);
      assert.deepEqual(actual, types.map((type) => ({
        point_type: type, name: 'Punto ' + type, description: 'Detalle ' + type, latitude: -16.5, longitude: -68.1,
      })));
    });
  });
  await test('08 Four service types stored; duplicate service rejected', async () => {
    await as('authenticated', a, async () => {
      for (const [i, type] of ['water', 'signal', 'lodging', 'shop'].entries()) {
        await query('insert into route_point_services(id,route_point_id,service_type,is_available,details) values ($1,$2,$3,$4,$5)',
          [i === 0 ? serviceId : randomUUID(), pointIds[0], type, i !== 1, 'Dato ' + type]);
      }
      assert.equal(await count('route_point_services'), 4);
      assert.equal((await rows("select is_available from route_point_services where service_type='signal'"))[0].is_available, false);
      await rejected("insert into route_point_services(route_point_id,service_type) values ($1,'water')", [pointIds[0]], '23505');
    });
  });
  await test('09 Pause/resume preserves timestamps and duration; pauses owner-only', async () => {
    await as('authenticated', a, async () => {
      await query("insert into route_pauses(id,route_id,started_at) values ($1,$2,'2026-01-01T10:00:00Z')", [pauseId, publicId]);
      assert.equal((await rows('select ended_at from route_pauses where id=$1', [pauseId]))[0].ended_at, null);
      await query("update route_pauses set ended_at='2026-01-01T10:02:00Z',duration_seconds=120 where id=$1", [pauseId]);
      assert.equal((await rows('select extract(epoch from ended_at-started_at)::integer seconds from route_pauses where id=$1', [pauseId]))[0].seconds, 120);
    });
    await as('authenticated', b, async () => assert.equal(await count('route_pauses'), 0));
    await as('anon', null, () => rejected('select * from route_pauses', []));
  });
  await test('10 Final summary and recording -> draft -> published are persisted', async () => {
    await as('authenticated', a, async () => {
      await query("update routes set total_distance_m=2500.5,active_duration_seconds=1800,pause_count=1,start_latitude=-16.4,start_longitude=-68.1,end_latitude=-16.5,end_longitude=-68.2,finished_at=now(),status='draft' where id=$1", [privateId]);
      const summary = (await rows('select total_distance_m,active_duration_seconds,pause_count,start_latitude,start_longitude,end_latitude,end_longitude,status from routes where id=$1', [privateId]))[0];
      assert.deepEqual(summary, { total_distance_m: 2500.5, active_duration_seconds: 1800, pause_count: 1, start_latitude: -16.4, start_longitude: -68.1, end_latitude: -16.5, end_longitude: -68.2, status: 'draft' });
      await query("update routes set visibility='public',status='published',published_at=now() where id=$1", [privateId]);
    });
    await as('anon', null, async () => assert.equal(await count('routes', 'id=$1', [privateId]), 1));
    await as('authenticated', a, () => query("update routes set visibility='private' where id=$1", [privateId]));
  });
  await as('authenticated', a, async () => {
    await query("insert into storage.objects(bucket_id,name) values ('route-images',$1),('route-images',$2)", [privateImage, publicImage]);
    await query('update routes set main_image_path=$1 where id=$2', [privateImage, privateId]);
    await query('update routes set main_image_path=$1 where id=$2', [publicImage, publicId]);
  });
  await test('11 Private photo metadata blocked by RLS for anon and B', async () => {
    for (const [role, uid] of [['anon', null], ['authenticated', b]]) {
      await as(role, uid, async () => assert.equal(await count('storage.objects', 'name=$1', [privateImage]), 0));
    }
    await as('authenticated', a, async () => assert.equal(await count('storage.objects', 'name=$1', [privateImage]), 1));
    assert.equal((await rows("select public from storage.buckets where id='route-images'"))[0].public, false);
  });
  await test('12 Public photo metadata readable; privatizing route immediately revokes SQL access', async () => {
    await as('anon', null, async () => assert.equal(await count('storage.objects', 'name=$1', [publicImage]), 1));
    await as('authenticated', b, async () => assert.equal(await count('storage.objects', 'name=$1', [publicImage]), 1));
    await as('authenticated', a, () => query("update routes set visibility='private' where id=$1", [publicId]));
    await as('anon', null, async () => assert.equal(await count('storage.objects', 'name=$1', [publicImage]), 0));
    await as('authenticated', a, () => query("update routes set visibility='public' where id=$1", [publicId]));
  });
  await test('13 My routes returns only owner_id = auth.uid()', async () => {
    await as('authenticated', a, async () => assert.equal(await count('routes', 'owner_id=auth.uid()'), 4));
    await as('authenticated', b, async () => assert.equal(await count('routes', 'owner_id=auth.uid()'), 1));
  });
  await test('14 Catalog excludes private/draft/recording; case-insensitive search and flexible difficulty', async () => {
    await as('anon', null, async () => {
      assert.deepEqual(await rows('select id from routes'), [{ id: publicId }]);
      assert.equal(await count('routes', "name ilike '%camino%' and difficulty=$1", ['escala pendiente']), 1);
    });
    await as('authenticated', b, async () => {
      assert.deepEqual(await rows("select id from routes where visibility='public' and status='published'"), [{ id: publicId }]);
    });
  });
  await as('authenticated', a, () => query(
    "insert into route_equipment(id,route_id,name,requirement_level) values ($1,$2,'Agua','required')", [equipmentId, publicId]));
  await test('15 All child tables enforce insert/update/delete and parent reassignment ownership', async () => {
    const children = [
      ['route_track_points', trackIds[0], 'route_id', bRouteId, "insert into route_track_points(route_id,sequence_no,latitude,longitude,recorded_at) values ($1,9,0,0,now())", publicId],
      ['route_points', pointIds[0], 'route_id', bRouteId, "insert into route_points(route_id,point_type,latitude,longitude) values ($1,'agua',0,0)", publicId],
      ['route_point_services', serviceId, 'route_point_id', null, "insert into route_point_services(route_point_id,service_type) values ($1,'water')", pointIds[1]],
      ['route_equipment', equipmentId, 'route_id', bRouteId, "insert into route_equipment(route_id,name) values ($1,'Botas')", publicId],
      ['route_pauses', pauseId, 'route_id', bRouteId, 'insert into route_pauses(route_id,started_at) values ($1,now())', publicId],
    ];
    const bPoint = randomUUID();
    await as('authenticated', b, () => query("insert into route_points(id,route_id,point_type,latitude,longitude) values ($1,$2,'agua',0,0)", [bPoint, bRouteId]));
    children[2][3] = bPoint;
    for (const [table, id, parent, foreignId, insert, insertParent] of children) {
      await as('authenticated', b, async () => {
        assert.equal((await query('update ' + table + ' set id=id where id=$1', [id])).rowCount, 0);
        assert.equal((await query('delete from ' + table + ' where id=$1', [id])).rowCount, 0);
        await rejected(insert, [insertParent]);
      });
      await as('authenticated', a, async () => {
        assert.equal((await query('update ' + table + ' set id=id where id=$1', [id])).rowCount, 1);
        await rejected('update ' + table + ' set ' + parent + '=$1 where id=$2', [foreignId, id]);
        await query('savepoint owner_delete');
        assert.equal((await query('delete from ' + table + ' where id=$1', [id])).rowCount, 1);
        await query('rollback to savepoint owner_delete');
        await query('release savepoint owner_delete');
      });
    }
    // When the parent becomes private, every public child and service disappears.
    await as('authenticated', a, () => query("update routes set visibility='private' where id=$1", [publicId]));
    await as('anon', null, async () => {
      for (const [table] of children.filter(([table]) => table !== 'route_pauses')) {
        assert.equal(await count(table), 0);
      }
    });
    await as('authenticated', a, () => query("update routes set visibility='public' where id=$1", [publicId]));
  });
  await test('16 Storage rejects uploads, updates, deletes and cross-route moves by non-owners', async () => {
    for (const [role, uid] of [['anon', null], ['authenticated', b]]) {
      await as(role, uid, async () => {
        await rejected("insert into storage.objects(bucket_id,name) values ('route-images',$1)", [publicId + '/' + randomUUID() + '.png']);
        assert.equal((await query('update storage.objects set name=name where name=$1', [publicImage])).rowCount, 0);
        assert.equal((await query('delete from storage.objects where name=$1', [publicImage])).rowCount, 0);
      });
    }
    await as('authenticated', a, async () => {
      assert.equal((await query('update storage.objects set name=name where name=$1', [privateImage])).rowCount, 1);
      await rejected('update storage.objects set name=$1 where name=$2', [bRouteId + '/' + randomUUID() + '.jpg', privateImage]);
      for (const path of ['invalid/file.jpg', publicId + '/nested/file.jpg', publicId + '/not-a-uuid.jpg']) {
        await rejected("insert into storage.objects(bucket_id,name) values ('route-images',$1)", [path]);
      }
      await query('savepoint owner_image_delete');
      assert.equal((await query('delete from storage.objects where name=$1', [privateImage])).rowCount, 1);
      await query('rollback to savepoint owner_image_delete');
      await query('release savepoint owner_image_delete');
    });
  });
  await test('17 Coordinate/summary/type/image-path constraints reject invalid data', async () => {
    await as('authenticated', a, async () => {
      for (const [column, value] of [
        ['start_latitude', 91], ['end_latitude', -91], ['start_longitude', 181], ['end_longitude', -181],
        ['total_distance_m', -1], ['total_distance_m', 'NaN'], ['total_distance_m', 'Infinity'],
        ['active_duration_seconds', -1], ['pause_count', -1], ['estimated_duration_minutes', -1],
        ['visibility', 'hidden'], ['status', 'deleted'], ['main_image_path', publicImage],
      ]) await rejected('update routes set ' + column + '=$1 where id=$2', [value, privateId], '23514');
      await rejected('update route_track_points set latitude=91 where id=$1', [trackIds[0]], '23514');
      await rejected('update route_points set longitude=-181 where id=$1', [pointIds[0]], '23514');
      await rejected("update route_points set point_type='social' where id=$1", [pointIds[0]], '23514');
      await rejected("update route_point_services set service_type='unapproved' where id=$1", [serviceId], '23514');
      await rejected("update route_equipment set requirement_level='optional' where id=$1", [equipmentId], '23514');
      await rejected('update route_pauses set duration_seconds=-1 where id=$1', [pauseId], '23514');
      await rejected("update route_pauses set ended_at='2025-01-01T00:00:00Z' where id=$1", [pauseId], '23514');
    });
  });
  await test('18 Profiles public/basic; own edits only; no client delete/insert or privileged RPC', async () => {
    await as('anon', null, async () => assert.equal(await count('profiles'), 2));
    await as('authenticated', b, async () => {
      assert.equal((await query('update profiles set full_name=$1 where id=$2', ['attack', a])).rowCount, 0);
      await rejected('delete from profiles where id=$1', [b]);
      await rejected('insert into profiles(id) values ($1)', [randomUUID()]);
      await rejected('update profiles set id=$1 where id=$2', [randomUUID(), b]);
      await rejected('select private.handle_new_user()', []);
    });
    await as('authenticated', a, async () => {
      assert.equal((await query('update profiles set full_name=$1 where id=$2', ['Nombre A', a])).rowCount, 1);
    });
  });
  await test('19 Reusable updated_at triggers and schema security inventory', async () => {
    assert.equal(Number((await rows("select count(*) n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity"))[0].n), 7);
    assert.equal(Number((await rows("select count(*) n from pg_trigger where not tgisinternal and tgname like '%set_updated_at'"))[0].n), 3);
    for (const [table, id] of [['profiles', a], ['routes', publicId], ['route_points', pointIds[0]]]) {
      await query("update " + table + " set updated_at='2000-01-01T00:00:00Z' where id=$1", [id]);
      assert.equal((await rows('select updated_at=transaction_timestamp() ok from ' + table + ' where id=$1', [id]))[0].ok, true);
    }
    const fns = await rows("select p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'");
    assert.equal(fns.filter((fn) => fn.prosecdef).length, 1);
    assert.equal(fns.find((fn) => fn.prosecdef).proname, 'handle_new_user');
    assert.ok(fns.every((fn) => fn.proconfig.some((setting) => setting.startsWith('search_path='))));
    const indexNames = (await rows("select indexname from pg_indexes where schemaname='public'")).map((row) => row.indexname);
    for (const name of ['routes_owner_id_idx', 'routes_visibility_status_idx', 'routes_created_at_idx', 'routes_difficulty_idx',
      'route_track_points_route_sequence_key', 'route_points_route_id_idx', 'route_point_services_point_type_key',
      'route_equipment_route_id_idx', 'route_pauses_route_id_idx']) assert.ok(indexNames.includes(name), name);
    assert.equal(Number((await rows("select count(*) n from pg_policies where schemaname='public'"))[0].n), 26);
    assert.equal(Number((await rows("select count(*) n from pg_policies where schemaname='storage'"))[0].n), 4);
    for (const table of ['profiles', 'routes', 'route_track_points', 'route_points', 'route_point_services', 'route_equipment', 'route_pauses']) {
      assert.equal((await rows("select has_table_privilege('anon',$1,'INSERT,UPDATE,DELETE,TRUNCATE') allowed", ['public.' + table]))[0].allowed, false);
      assert.equal((await rows("select has_table_privilege('authenticated',$1,'TRUNCATE') allowed", ['public.' + table]))[0].allowed, false);
    }
  });
  await test('20 Owner deletes route; descendants cascade; Storage loses access until API cleanup', async () => {
    await as('authenticated', a, async () => {
      // Remove physical objects through Storage API BEFORE deleting a route in the app.
      // Here only metadata is tested; leaving it checks orphaned objects stay inaccessible.
      assert.equal((await query('delete from routes where id=$1', [publicId])).rowCount, 1);
    });
    for (const table of ['route_track_points', 'route_equipment', 'route_pauses']) assert.equal(await count(table), 0);
    assert.equal(await count('route_points', 'route_id=$1', [publicId]), 0);
    assert.equal(await count('route_point_services'), 0);
    for (const [role, uid] of [['anon', null], ['authenticated', a]]) {
      await as(role, uid, async () => assert.equal(await count('storage.objects', 'name=$1', [publicImage]), 0));
    }
  });
  await query('rollback');
  await writeFile(join(artifacts, 'results.json'), JSON.stringify({
    timestamp: new Date().toISOString(),
    engine: (await rows('show server_version'))[0].server_version,
    mode: 'isolated-postgres-with-minimal-auth-storage-fixtures',
    migrations, results,
    not_tested: ['Supabase HTTP signup/login', 'Storage binary upload/download', 'device session persistence'],
  }, null, 2) + '\n');
  console.log(results.length + ' SQL scenarios PASS. HTTP Auth/Storage and device checks remain separate.');
} catch (error) {
  console.error('FAIL', error);
  failed = true;
} finally {
  if (db) await db.end();
  await postgres.stop();
}
if (failed) process.exit(1);
