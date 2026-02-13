import { useEffect, useMemo, useState } from 'react';
import { RootRoute } from './routes/__root';
import { IndexRoute } from './routes/index';
import { SecondRoute } from './routes/second';

function resolveRoute(pathname: string): React.ReactNode {
  if (pathname === '/second') {
    return <SecondRoute />;
  }

  return <IndexRoute />;
}

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname);
    };

    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  const routeElement = useMemo(() => resolveRoute(pathname), [pathname]);
  return <RootRoute>{routeElement}</RootRoute>;
}
