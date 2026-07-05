'use client';
import { ReactNode } from 'react';

export default function ProGate({ feature, description, children }: {
  feature?: string;
  description?: string;
  children?: ReactNode;
}) {
  return <>{children ?? null}</>;
}
