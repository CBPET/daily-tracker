import { useEffect, useState } from 'react';
import { StatusBadge, PriorityLabel } from './RequestList';
import RequestActions from './RequestActions';
import RequestTimeline from './RequestTimeline';
import { getRequestScreenshots, getScreenshotSignedUrl, getTicketEvents } from '../../lib/requestHub/requestHubService';

export default function RequestDetail({
  ticket,
  profile,
  assignableUsers,
  profileNameById,
  onAction,
  onBack,
  busy,
}) {
  const [events, setEvents] = useState([]);
  const [screenshots, setScreenshots] = useState([]);
  const [urls, setUrls] = useState({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ev, shots] = await Promise.all([
          getTicketEvents(ticket.id),
          getRequestScreenshots(ticket.id),
        ]);
        if (cancelled) return;
        setEvents(ev);
        setScreenshots(shots);
        const map = {};
        for (const s of shots) {
          try {
            map[s.id] = await getScreenshotSignedUrl(s.storage_path);
          } catch {
            map[s.id] = null;
          }
        }
        if (!cancelled) setUrls(map);
      } catch (err) {
        console.error(err);
      }
    })();
    return () => { cancelled = true; };
  }, [ticket.id, ticket.updated_at, ticket.last_activity_at]);

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="text-xs font-black uppercase tracking-widest text-blue-600">
        ← Back to list
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-sm font-bold text-blue-600">{ticket.ticket_number}</div>
          <h3 className="text-2xl font-black mt-1">{ticket.title}</h3>
          <div className="flex flex-wrap gap-3 mt-3 items-center">
            <StatusBadge status={ticket.status} />
            <PriorityLabel priority={ticket.priority} />
            <span className="text-xs text-gray-500">{ticket.category}</span>
            {ticket.client_id && <span className="text-xs text-gray-500">{ticket.client_id}</span>}
          </div>
        </div>
      </div>

      <div className="prose dark:prose-invert max-w-none">
        <p className="whitespace-pre-wrap text-sm font-medium">{ticket.description}</p>
        {ticket.additional_information && (
          <p className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300 mt-3">
            <span className="font-black uppercase text-[10px] tracking-widest block mb-1">Additional</span>
            {ticket.additional_information}
          </p>
        )}
      </div>

      {(ticket.lead_remark || ticket.manager_remark || ticket.gm_remark || ticket.admin_remark) && (
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          {ticket.lead_remark && <RemarkBox title="Lead remark" text={ticket.lead_remark} />}
          {ticket.manager_remark && <RemarkBox title="Manager remark" text={ticket.manager_remark} />}
          {ticket.gm_remark && <RemarkBox title="GM remark" text={ticket.gm_remark} />}
          {ticket.admin_remark && <RemarkBox title="Admin remark" text={ticket.admin_remark} />}
        </div>
      )}

      {!!screenshots.length && (
        <div>
          <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Screenshots</h4>
          <div className="flex flex-wrap gap-3">
            {screenshots.map((s) => (
              <a
                key={s.id}
                href={urls[s.id] || '#'}
                target="_blank"
                rel="noreferrer"
                className="block w-32 h-24 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800"
              >
                {urls[s.id] ? (
                  <img src={urls[s.id]} alt={s.file_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[10px] p-2 block">{s.file_name}</span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      <RequestActions
        ticket={ticket}
        profile={profile}
        assignableUsers={assignableUsers}
        onAction={onAction}
        busy={busy}
      />

      <div>
        <h4 className="text-xs font-black uppercase tracking-widest text-gray-500 mb-3">Audit timeline</h4>
        <RequestTimeline events={events} profileNameById={profileNameById} />
      </div>
    </div>
  );
}

function RemarkBox({ title, text }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">{title}</div>
      <p className="mt-1 font-medium">{text}</p>
    </div>
  );
}
