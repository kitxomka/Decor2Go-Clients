import { Badge } from '@/components/ui/badge';
import { InvoiceStatus, ProjectStatus } from '@/src/types';

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const variants: Record<InvoiceStatus, string> = {
    pending: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
    paid: 'bg-green-100 text-green-800 hover:bg-green-100',
    canceled: 'bg-red-100 text-red-800 hover:bg-red-100',
    deposit: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  };

  return (
    <Badge className={`${variants[status]} capitalize border-none`} data-testid={`invoice-status-${status}`}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const variants: Record<ProjectStatus, string> = {
    design_selection: 'bg-purple-100 text-purple-800 hover:bg-purple-100',
    measurements: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100',
    invoice_sent: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    order_print: 'bg-orange-100 text-orange-800 hover:bg-orange-100',
    received_contacted: 'bg-teal-100 text-teal-800 hover:bg-teal-100',
    ready_for_installation: 'bg-cyan-100 text-cyan-800 hover:bg-cyan-100',
    waiting_for_installation: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
    completed: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
  };

  return (
    <Badge className={`${variants[status]} capitalize border-none`} data-testid={`project-status-${status}`}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}
