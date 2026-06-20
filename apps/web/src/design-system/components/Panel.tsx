import React from "react";
import { Card } from "./Card";

interface PanelProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children?: React.ReactNode;
  noPad?: boolean;
}

export function Panel({
  title,
  subtitle,
  action,
  className = "",
  bodyClassName = "",
  children,
  noPad = false,
}: PanelProps) {
  return (
    <Card className={className}>
      {(title || subtitle || action) && (
        <Card.Header title={title} subtitle={subtitle} action={action} />
      )}
      <Card.Body noPad={noPad} className={bodyClassName}>
        {children}
      </Card.Body>
    </Card>
  );
}
