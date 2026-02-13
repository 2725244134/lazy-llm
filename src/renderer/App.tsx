import { useEffect, useState } from 'react';
import { Sidebar } from './sidebar/Sidebar';

export default function App() {
  const [healthStatus, setHealthStatus] = useState('checking...');
  const [runtimeInfo, setRuntimeInfo] = useState('');

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!window.council) {
        if (!active) {
          return;
        }
        setHealthStatus('web-only');
        setRuntimeInfo('Running in browser (no Electron bridge)');
        return;
      }

      try {
        const health = await window.council.healthCheck();
        if (!active) {
          return;
        }
        setHealthStatus(health.ok ? 'connected' : 'error');
        setRuntimeInfo(`${health.runtime} v${health.version}`);
      } catch (error) {
        if (!active) {
          return;
        }
        setHealthStatus('error');
        setRuntimeInfo(String(error));
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div className="placeholder">
          <p>LazyLLM - Multi-LLM Interface</p>
          <p className="hint">Status: {healthStatus}</p>
          {runtimeInfo ? <p className="hint">{runtimeInfo}</p> : null}
        </div>
      </main>
    </div>
  );
}
