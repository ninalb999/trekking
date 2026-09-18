import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import DetalleRuta from '@/screens/DetalleRuta';
import { getSession } from '@/lib/auth';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEMO_ROUTE_PATTERN = /^demo-[a-z0-9-]+$/i;

function getRouteId(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string' || (!UUID_PATTERN.test(value) && !DEMO_ROUTE_PATTERN.test(value))) return null;
  return value;
}

export default function RouteDetailRoute() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const router = useRouter();
  const routeId = getRouteId(id);
  const [canView, setCanView] = useState(false);

  useEffect(() => {
    let active = true;
    getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) setCanView(true);
      else router.replace('/');
    }).catch(() => {
      if (active) router.replace('/');
    });
    return () => { active = false; };
  }, [router]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  if (!canView) return null;
  return <DetalleRuta routeId={routeId} onBack={goBack} />;
}
