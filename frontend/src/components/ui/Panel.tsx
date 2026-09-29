import { ReactNode } from 'react';

// Bordered card with a titled header strip, backed by `.panel`/.panel-body`
// in globals.css — the same shape as console.css's `.panel` (see
// redesign-and-blend/project.html's Usage/Domains cards).
export function Panel({ title, children, className }: { title: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className ?? ''}`}>
      <header>{title}</header>
      <div className="panel-body">{children}</div>
    </section>
  );
}
