import { SidebarSection } from './SidebarSection';
import { MAX_PANES, useSidebarContext } from './context';

export function PaneSelector() {
  const sidebar = useSidebarContext();

  return (
    <SidebarSection title="PANES">
      <div className="pane-toggle">
        {Array.from({ length: MAX_PANES }, (_, index) => {
          const paneNumber = index + 1;
          const active = sidebar.paneCount === paneNumber;

          return (
            <button
              key={paneNumber}
              type="button"
              className={`chip${active ? ' active' : ''}`}
              onClick={() => {
                void sidebar.setPaneCount(paneNumber);
              }}
            >
              {paneNumber}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="new-all-btn"
        title="Open provider home in all panes (Ctrl/Cmd+R)"
        onClick={() => {
          void sidebar.newAll();
        }}
      >
        NEW ALL
      </button>
    </SidebarSection>
  );
}
