import type { ReactNode } from 'react';

export function SidebarSection(props: { title: string; children: ReactNode }) {
  return (
    <div className="section">
      <div className="section-title">{props.title}</div>
      {props.children}
    </div>
  );
}
