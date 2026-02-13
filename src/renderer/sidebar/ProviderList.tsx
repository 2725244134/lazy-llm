import { SidebarSection } from './SidebarSection';
import { useSidebarContext } from './context';
import { ProviderDropdown } from './ProviderDropdown';

export function ProviderList() {
  const sidebar = useSidebarContext();

  return (
    <SidebarSection title="PROVIDERS">
      <div className="provider-list">
        {Array.from({ length: sidebar.paneCount }, (_, paneIndex) => {
          return (
            <div key={paneIndex} className="provider-item">
              <div className="provider-label">Pane {paneIndex + 1}</div>
              <ProviderDropdown
                selectedKey={sidebar.activeProviders[paneIndex] ?? 'chatgpt'}
                loading={Boolean(sidebar.providerLoadingByPane[paneIndex])}
                onChange={(providerKey) => {
                  void sidebar.setProvider(paneIndex, providerKey);
                }}
              />
            </div>
          );
        })}
      </div>
    </SidebarSection>
  );
}
