import type { ReactNode } from 'react';

interface RootRouteProps {
  children: ReactNode;
}

export function RootRoute(props: RootRouteProps) {
  return <>{props.children}</>;
}
