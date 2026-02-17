import { useMemo } from 'react';
import { MAX_SIDEBAR_TABS } from './tabsState';
import { useSidebarContext } from './context';

export function TabsBar() {
  const sidebar = useSidebarContext();
  const canCreateTab = sidebar.tabs.length < MAX_SIDEBAR_TABS;

  const tabLabels = useMemo(() => {
    return sidebar.tabs.reduce<Record<string, string>>((result, tab, index) => {
      result[tab.id] = `Tab ${index + 1}`;
      return result;
    }, {});
  }, [sidebar.tabs]);

  return (
    <div className="tabs-row" role="tablist" aria-label="Workspace tabs">
      <div className="tabs-strip">
        {sidebar.tabs.map((tab) => {
          const isActive = tab.id === sidebar.activeTabId;
          return (
            <div key={tab.id} className={`tab-chip${isActive ? ' active' : ''}`}>
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                className="tab-chip-main"
                title={tabLabels[tab.id] ?? tab.id}
                onClick={() => {
                  void sidebar.switchTab(tab.id);
                }}
              >
                {tabLabels[tab.id] ?? tab.id}
              </button>
              {sidebar.tabs.length > 1 ? (
                <button
                  type="button"
                  className="tab-chip-close"
                  title={`Close ${tabLabels[tab.id] ?? tab.id}`}
                  onClick={() => {
                    void sidebar.closeTab(tab.id);
                  }}
                >
                  ×
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="tab-add-btn"
        disabled={!canCreateTab}
        title={canCreateTab ? 'Create tab' : `Maximum ${MAX_SIDEBAR_TABS} tabs`}
        onClick={() => {
          void sidebar.createTab();
        }}
      >
        +
      </button>
    </div>
  );
}
