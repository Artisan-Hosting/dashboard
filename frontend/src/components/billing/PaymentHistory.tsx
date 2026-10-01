import { useCallback, useEffect, useState } from 'react';
import { Button, Panel, Pill } from '@/components/ui';
import { fetchInvoices } from '@/lib/api';
import { Invoice } from '@/lib/types';
import { fmtDate, usd } from './format';

const PAGE_SIZE = 10;

const STATUS_LABEL: Record<string, string> = {
  paid: 'Paid',
  open: 'Waiting',
  void: 'Void',
  uncollectible: 'Failed',
  draft: 'Draft',
};

function describe(invoice: Invoice): { title: string; detail: string } {
  const base = invoice.line_items.find((l) => !l.unit_code);
  const extras = invoice.line_items.filter((l) => l.unit_code).length;
  return {
    title: base?.description ?? 'Plan payment',
    detail: `${fmtDate(invoice.period_start)} – ${fmtDate(invoice.period_end)}${extras ? `, plus ${extras} above-plan charge${extras === 1 ? '' : 's'}` : ''}`,
  };
}

// Plan invoices, newest first. Credit top-ups live in the ledger on the Credits
// page, and domain orders will join here once they can be bought.
export function PaymentHistory({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [locked, setLocked] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(
    async (at: number) => {
      try {
        const page = await fetchInvoices({ organizationId: orgId || undefined, limit: PAGE_SIZE, offset: at });
        setRows(page.invoices);
        setTotal(page.total);
        setLocked(false);
      } catch {
        setLocked(true);
      } finally {
        setLoaded(true);
      }
    },
    [orgId],
  );

  useEffect(() => {
    load(offset);
  }, [offset, load]);

  if (!loaded) return null;
  if (locked) {
    return (
      <Panel title="Billing is limited to admins">
        <p className="text-sm">Ask an admin of your organization if you need to see payments.</p>
      </Panel>
    );
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <Panel title="Payment history">
      {rows.length === 0 ? (
        <p className="sub">No payments yet.</p>
      ) : (
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>What</th>
                <th className="r">Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((inv) => {
                const d = describe(inv);
                return (
                  <tr key={inv.id}>
                    <td>{fmtDate(inv.created_at)}</td>
                    <td className="desc">
                      {d.title}
                      <small>{d.detail}</small>
                    </td>
                    <td className="amt">{usd(inv.total_cents)}</td>
                    <td>
                      <Pill status={inv.status} label={STATUS_LABEL[inv.status] ?? inv.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {total > PAGE_SIZE && (
        <div className="pager">
          <span>
            Page {page} of {pages}
          </span>
          <span className="flex gap-2">
            <Button small variant="ghost" disabled={offset === 0} onClick={() => setOffset(offset - PAGE_SIZE)}>
              Newer
            </Button>
            <Button small variant="ghost" disabled={page >= pages} onClick={() => setOffset(offset + PAGE_SIZE)}>
              Older
            </Button>
          </span>
        </div>
      )}
      <p className="sub text-sm">Credit top-ups are listed in the history on the Credit page.</p>
    </Panel>
  );
}
