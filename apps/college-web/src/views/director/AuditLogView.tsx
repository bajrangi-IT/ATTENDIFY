import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { TablePagination } from '../../components/ui/TablePagination';
import { Skeleton } from '../../components/ui/Skeleton';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { exportToExcel } from '../../lib/exportUtils';
import { useToast } from '../../context/ToastContext';
import {
  ShieldAlert,
  Search,
  Filter,
  FileSpreadsheet,
  RefreshCw,
  Eye,
  Calendar,
  User,
  Activity,
  ArrowUpDown,
  Laptop
} from 'lucide-react';

interface AuditLogEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
  actor: {
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  } | null;
}

export const AuditLogView: React.FC = () => {
  const { addToast } = useToast();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [entityFilter, setEntityFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalCount, setTotalCount] = useState(0);

  // Selected Log for JSON detail inspection
  const [inspectingLog, setInspectingLog] = useState<AuditLogEntry | null>(null);

  // Fetch audit logs with server-side pagination & filtering
  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('audit_logs')
        .select(`
          id,
          action,
          entity_type,
          entity_id,
          details,
          ip_address,
          created_at,
          actor:profiles(first_name, last_name, email, role)
        `, { count: 'exact' });

      if (actionFilter !== 'ALL') {
        query = query.ilike('action', `%${actionFilter}%`);
      }
      if (entityFilter !== 'ALL') {
        query = query.eq('entity_type', entityFilter);
      }
      if (searchTerm.trim()) {
        query = query.or(`action.ilike.%${searchTerm}%,entity_type.ilike.%${searchTerm}%`);
      }

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      setLogs((data as any) || []);
      setTotalCount(count || 0);
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
      addToast({
        title: 'Error Fetching Logs',
        message: err.message || 'Could not retrieve audit history.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [currentPage, pageSize, actionFilter, entityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchAuditLogs();
  };

  const handleExport = () => {
    if (logs.length === 0) {
      addToast({ title: 'Export Failed', message: 'No logs available to export.', type: 'warning' });
      return;
    }

    const exportData = logs.map((log) => ({
      'Log ID': log.id,
      'Timestamp': new Date(log.created_at).toLocaleString(),
      'Action': log.action,
      'Entity Type': log.entity_type,
      'Entity ID': log.entity_id || 'N/A',
      'Actor Name': log.actor ? `${log.actor.first_name} ${log.actor.last_name}` : 'System',
      'Actor Email': log.actor?.email || 'N/A',
      'Actor Role': log.actor?.role || 'N/A',
      'IP Address': log.ip_address || 'Internal',
      'Details': JSON.stringify(log.details || {})
    }));

    exportToExcel(exportData, `CampusAttend_Audit_Logs_${new Date().toISOString().slice(0, 10)}`);
    addToast({ title: 'Audit Logs Exported', message: 'Export file has been generated.', type: 'success' });
  };

  const getActionBadgeColor = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('OVERRIDE') || act.includes('DELETE') || act.includes('REJECT')) {
      return 'danger';
    }
    if (act.includes('APPROVE') || act.includes('SUBMIT') || act.includes('FINALIZED')) {
      return 'success';
    }
    if (act.includes('UPDATE') || act.includes('MODIFY') || act.includes('CONFIG')) {
      return 'warning';
    }
    return 'default';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-indigo-900 font-bold text-xl">
            <ShieldAlert className="h-6 w-6 text-indigo-600" />
            <span>Immutable Institutional Audit Trail</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time forensic record of attendance overrides, session approvals, grade locks, and administrative policy changes.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchAuditLogs}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExport}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-600/20 transition"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center space-x-2">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by action or entity..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            Search
          </button>
        </form>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium">Action:</span>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-700"
            >
              <option value="ALL">All Actions</option>
              <option value="OVERRIDE">Manual Overrides</option>
              <option value="SUBMIT">Report Submissions</option>
              <option value="APPROVE">Director Approvals</option>
              <option value="REJECT">Rejections</option>
              <option value="POLICY">Policy Updates</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-500 font-medium">Entity:</span>
            <select
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-700"
            >
              <option value="ALL">All Entities</option>
              <option value="attendance_record">Attendance Record</option>
              <option value="attendance_session">Attendance Session</option>
              <option value="attendance_session_reports">Session Report</option>
              <option value="attendance_policies">Policy</option>
              <option value="timetable_entry">Timetable</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Entity Type</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-5 w-24 rounded-full" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-40" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-28" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="py-3.5 px-4 text-right"><Skeleton className="h-6 w-14 ml-auto rounded" /></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Activity className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No audit records found</p>
                    <p className="text-[11px] mt-0.5">Matching criteria did not return any historical entries.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString([], {
                        month: 'short',
                        day: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge variant={getActionBadgeColor(log.action)}>
                        {log.action}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4">
                      {log.actor ? (
                        <div>
                          <div className="font-medium text-slate-800">
                            {log.actor.first_name} {log.actor.last_name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {log.actor.email} &bull; <span className="capitalize">{log.actor.role}</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Automated System Process</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                        {log.entity_type}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {log.ip_address || '127.0.0.1'}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setInspectingLog(log)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-slate-100">
          <TablePagination
            currentPage={currentPage}
            pageSize={pageSize}
            totalItems={totalCount}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* JSON Inspection Modal */}
      {inspectingLog && (
        <Modal
          isOpen={!!inspectingLog}
          onClose={() => setInspectingLog(null)}
          title={`Audit Event: ${inspectingLog.action}`}
          subtitle={`Entity ID: ${inspectingLog.entity_id || 'N/A'} | Log ID: ${inspectingLog.id}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs">
              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px] block">Actor</span>
                <p className="font-medium text-slate-800 mt-0.5">
                  {inspectingLog.actor ? `${inspectingLog.actor.first_name} ${inspectingLog.actor.last_name} (${inspectingLog.actor.role})` : 'System Core'}
                </p>
                <p className="text-[11px] text-slate-500">{inspectingLog.actor?.email}</p>
              </div>

              <div>
                <span className="text-slate-400 font-semibold uppercase text-[10px] block">Timestamp & Network</span>
                <p className="font-medium text-slate-800 mt-0.5">
                  {new Date(inspectingLog.created_at).toISOString()}
                </p>
                <p className="text-[11px] text-slate-500 font-mono">IP: {inspectingLog.ip_address || 'Internal'}</p>
              </div>
            </div>

            <div>
              <span className="text-slate-500 font-semibold text-xs block mb-1.5">
                Audit Payload & Event Details (JSON)
              </span>
              <pre className="bg-slate-900 text-emerald-400 p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-72 select-text border border-slate-800">
                {JSON.stringify(inspectingLog.details || {}, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectingLog(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
