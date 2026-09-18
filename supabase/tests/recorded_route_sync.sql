begin;
insert into auth.users(id,email,raw_user_meta_data) values ('10000000-0000-4000-8000-000000000001','trekking-transaction-test@example.invalid','{"full_name":"Transaction test"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select public.save_recorded_route_v1('{"id":"10000000-0000-4000-8000-000000000099","ownerId":"10000000-0000-4000-8000-000000000001","name":"Prueba transaccional","description":"","difficulty":"Novato","visibility":"private","status":"finished","started":1789500000000,"ended":1789500010000,"distance":10,"elapsed":10000,"pauseCount":0,"points":[{"latitude":-16.5,"longitude":-68.15,"accuracy":5,"timestamp":1789500000000,"segment":0}],"places":[{"id":"10000000-0000-4000-8000-000000000002","name":"Mirador","description":"","type":"otro","services":["water"],"latitude":-16.5,"longitude":-68.15}],"equipment":["Agua"],"updatedAt":1789500010000}'::jsonb);
select public.save_recorded_route_v1('{"id":"10000000-0000-4000-8000-000000000099","ownerId":"10000000-0000-4000-8000-000000000001","name":"Prueba transaccional","description":"","difficulty":"Novato","visibility":"private","status":"finished","started":1789500000000,"ended":1789500010000,"distance":10,"elapsed":10000,"pauseCount":0,"points":[{"latitude":-16.5,"longitude":-68.15,"accuracy":5,"timestamp":1789500000000,"segment":0}],"places":[{"id":"10000000-0000-4000-8000-000000000002","name":"Mirador","description":"","type":"otro","services":["water"],"latitude":-16.5,"longitude":-68.15}],"equipment":["Agua"],"updatedAt":1789500010000}'::jsonb);
do $$ begin
 if (select count(*) from public.route_track_points where route_id='10000000-0000-4000-8000-000000000099') <> 1 then raise exception 'Idempotency failed'; end if;
 if (select count(*) from public.route_point_services where route_point_id='10000000-0000-4000-8000-000000000002') <> 1 then raise exception 'Services failed'; end if;
 begin
   perform public.save_recorded_route_v1(jsonb_set('{"id":"10000000-0000-4000-8000-000000000099","ownerId":"10000000-0000-4000-8000-000000000001","name":"Prueba transaccional","description":"","difficulty":"Novato","visibility":"private","status":"finished","started":1789500000000,"ended":1789500010000,"distance":10,"elapsed":10000,"pauseCount":0,"points":[{"latitude":-16.5,"longitude":-68.15,"accuracy":5,"timestamp":1789500000000,"segment":0}],"places":[{"id":"10000000-0000-4000-8000-000000000002","name":"Mirador","description":"","type":"otro","services":["water"],"latitude":-16.5,"longitude":-68.15}],"equipment":["Agua"],"updatedAt":1789500010000}'::jsonb,'{places,0,type}','"invalid"'));
   raise exception 'Expected constraint violation';
 exception when check_violation then null;
 end;
 if (select count(*) from public.route_track_points where route_id='10000000-0000-4000-8000-000000000099') <> 1 then raise exception 'Atomic rollback failed'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$ begin
 if exists(select 1 from public.routes where id='10000000-0000-4000-8000-000000000099') then raise exception 'Private route leaked'; end if;
 begin
   perform public.save_recorded_route_v1('{"id":"10000000-0000-4000-8000-000000000099","ownerId":"10000000-0000-4000-8000-000000000001","name":"Prueba transaccional","description":"","difficulty":"Novato","visibility":"private","status":"finished","started":1789500000000,"ended":1789500010000,"distance":10,"elapsed":10000,"pauseCount":0,"points":[{"latitude":-16.5,"longitude":-68.15,"accuracy":5,"timestamp":1789500000000,"segment":0}],"places":[{"id":"10000000-0000-4000-8000-000000000002","name":"Mirador","description":"","type":"otro","services":["water"],"latitude":-16.5,"longitude":-68.15}],"equipment":["Agua"],"updatedAt":1789500010000}'::jsonb);
   raise exception 'Expected ownership rejection';
 exception when raise_exception then
   if sqlerrm <> 'Propietario incorrecto.' then raise; end if;
 end;
end $$;
rollback;
