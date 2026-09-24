import { FC, ReactNode } from 'react';

export interface LegalCardProps {
  heading: string;
  children: ReactNode;
}

/** One titled card in the Contact and Refund pages. */
export const LegalCard: FC<LegalCardProps> = ({ heading, children }) => (
  <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-6 space-y-3">
    <h2 className="text-base font-bold text-slate-100">{heading}</h2>
    <div className="text-xs text-slate-300 leading-relaxed">{children}</div>
  </div>
);
