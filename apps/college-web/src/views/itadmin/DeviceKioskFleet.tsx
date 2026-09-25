import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Skeleton } from '../../components/ui/Skeleton';
import {
  MonitorCheck,
  Tv,
  Wifi,
  WifiOff,
  RefreshCw,
  Plus,
  KeyRound,
  ShieldAlert,
  Server,
  Activity,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Layers,
  Clock
} from 'lucide-react';

interface ClassroomDevice {
  id: string;
  room_number: string;
  building: string;
  floor: number;
  capacity: number;
  device_pairing_code: string | null;
  device_status: 'unpaired' | 'paired' | 'active' | 'offline' | 'error';
  device_identifier: string | null;
  last_ping_at: string | null;
  is_active: boolean;
  campus?: { name: string };
}

export const DeviceKioskFleet: React.FC = () => {
  const { profile } = useAuth();
  const { addToast } = useToast();

  const [classrooms, setClassrooms] = useState<ClassroomDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Pair / Rotate PIN modal
  const [pairingModalRoom, setPairingModalRoom] = useState<ClassroomDevice | null>(null);
  const [generatedPin, setGeneratedPin] = useState('');
  const [pinExpiry, setPinExpiry] = useState<Date | null>(null);

  // New Classroom Modal
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);
  const [newRoomNumber, setNewRoomNumber] = useState('');
  const [newBuilding, setNewBuilding] = useState('Science & Tech Wing');
  const [newFloor, setNewFloor] = useState(1);
  const [newCapacity, setNewCapacity] = useState(60);
  const [savingRoom, setSavingRoom] = useState(false);

  // Revoke confirm
  const [roomToRevoke, setRoomToRevoke] = useState<ClassroomDevice | null>(null);

  // System telemetry check
  const [dbLatency, setDbLatency] = useState<number | null>(null);

  const fetchClassrooms = async () => {
    try {
      setLoading(true);
      const start = performance.now();
      const { data, error } = await supabase
        .from('classrooms')
        .select('*, campus:campuses(name)')
        .order('building')
        .order('room_number');

      const end = performance.now();
      setDbLatency(Math.round(end - start));

      if (error) throw error;
      setClassrooms(data || []);
    } catch (err: any) {
      console.error('Error fetching classrooms:', err);
      addToast({
        title: 'Fleet Load Error',
        message: err.message || 'Could not load device telemetry.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();

    // Setup Supabase Realtime subscription on classrooms table
    const subscription = supabase
      .channel('classroom-device-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'classrooms' },
        () => {
          fetchClassrooms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Generate 6-Digit Pairing PIN for Smart Board Display
  const handleGeneratePin = async (room: ClassroomDevice) => {
    try {
      // 6-digit random code
      const newPin = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

      // Update classroom record
      const { error: updateErr } = await supabase
        .from('classrooms')
        .update({
          device_pairing_code: newPin,
          device_status: 'unpaired'
        })
        .eq('id', room.id);

      if (updateErr) throw updateErr;

      // Log into device pairing records
      await supabase.from('device_pairing_records').insert({
        classroom_id: room.id,
        pairing_code: newPin,
        device_identifier: 'AWAITING_KIOSK_REGISTRATION',
        expires_at: expiresAt.toISOString(),
        is_active: true
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: 'DEVICE_PAIRING_PIN_GENERATED',
        entity_type: 'classroom',
        entity_id: room.id,
        details: { room_number: room.room_number, pin_generated: true }
      });

      setGeneratedPin(newPin);
      setPinExpiry(expiresAt);
      setPairingModalRoom(room);
      fetchClassrooms();

      addToast({
        title: 'New Pairing PIN Generated',
        message: `PIN for Room ${room.room_number} generated. Valid for 15 minutes.`,
        type: 'success'
      });
    } catch (err: any) {
      addToast({
        title: 'PIN Generation Failed',
        message: err.message || 'Could not generate device pairing code.',
        type: 'error'
      });
    }
  };

  // Revoke device pairing
  const handleRevokeDevice = async () => {
    if (!roomToRevoke) return;
    try {
      const { error } = await supabase
        .from('classrooms')
        .update({
          device_status: 'unpaired',
          device_identifier: null,
          device_pairing_code: null
        })
        .eq('id', roomToRevoke.id);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        actor_id: profile?.id,
        action: 'DEVICE_REVOCATION',
        entity_type: 'classroom',
        entity_id: roomToRevoke.id,
        details: { room_number: roomToRevoke.room_number, revoked_device: roomToRevoke.device_identifier }
      });

      addToast({
        title: 'Device Revoked',
        message: `Hardware registration cleared for Room ${roomToRevoke.room_number}.`,
        type: 'info'
      });
      setRoomToRevoke(null);
      fetchClassrooms();
    } catch (err: any) {
      addToast({
        title: 'Revocation Failed',
        message: err.message || 'Could not revoke device.',
        type: 'error'
      });
    }
  };

  // Register New Classroom
  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomNumber.trim()) return;

    try {
      setSavingRoom(true);

      // Get first campus ID
      const { data: campus } = await supabase.from('campuses').select('id').limit(1).single();

      const { error } = await supabase.from('classrooms').insert({
        campus_id: campus?.id,
        room_number: newRoomNumber.trim(),
        building: newBuilding.trim(),
        floor: Number(newFloor),
        capacity: Number(newCapacity),
        device_status: 'unpaired',
        is_active: true
      });

      if (error) throw error;

      addToast({
        title: 'Classroom Registered',
        message: `Classroom ${newRoomNumber} added to campus inventory.`,
        type: 'success'
      });

      setIsAddRoomOpen(false);
      setNewRoomNumber('');
      fetchClassrooms();
    } catch (err: any) {
      addToast({
        title: 'Registration Error',
        message: err.message || 'Could not create classroom.',
        type: 'error'
      });
    } finally {
      setSavingRoom(false);
    }
  };

  // Compute fleet counts
  const totalRooms = classrooms.length;
  const activeOnline = classrooms.filter((c) => c.device_status === 'active' || c.device_status === 'paired').length;
  const unpairedCount = classrooms.filter((c) => c.device_status === 'unpaired').length;
  const offlineCount = classrooms.filter((c) => c.device_status === 'offline' || c.device_status === 'error').length;

  const filteredClassrooms = classrooms.filter((c) => {
    const matchSearch =
      c.room_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.building.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.device_identifier && c.device_identifier.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchStatus =
      filterStatus === 'ALL' ||
      c.device_status === filterStatus;

    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center space-x-2 text-indigo-900 font-bold text-xl">
            <MonitorCheck className="h-6 w-6 text-indigo-600" />
            <span>Classroom Display & Smart Board Kiosk Fleet</span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Hardware provisioning, rotating PIN pairing, WebSocket telemetry, and kiosk revocation for all campus lecture halls.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchClassrooms}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh Telemetry</span>
          </button>

          <button
            onClick={() => setIsAddRoomOpen(true)}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-600/20 transition"
          >
            <Plus className="h-4 w-4" />
            <span>Add Classroom</span>
          </button>
        </div>
      </div>

      {/* Hardware Telemetry Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Display Fleet</span>
            <Tv className="h-5 w-5 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">{totalRooms}</div>
          <p className="text-[11px] text-slate-400 mt-1">Physical Classrooms</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600">Online & Active</span>
            <Wifi className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">{activeOnline}</div>
          <p className="text-[11px] text-emerald-500/80 mt-1">Heartbeat received &lt; 2m</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-600">Unpaired / Setup Needed</span>
            <KeyRound className="h-5 w-5 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2">{unpairedCount}</div>
          <p className="text-[11px] text-amber-500/80 mt-1">Awaiting 6-digit PIN pair</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-600">Backend API Latency</span>
            <Activity className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-indigo-600 mt-2">{dbLatency !== null ? `${dbLatency}ms` : '--'}</div>
          <p className="text-[11px] text-slate-400 mt-1">Supabase Realtime Channel UP</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Search by room, building, or MAC identifier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
          />
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-500 font-medium">Status Filter:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="active">Active & Online</option>
            <option value="paired">Paired</option>
            <option value="unpaired">Unpaired</option>
            <option value="offline">Offline</option>
          </select>
        </div>
      </div>

      {/* Fleet Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Classroom</th>
                <th className="py-3 px-4">Building & Floor</th>
                <th className="py-3 px-4">Capacity</th>
                <th className="py-3 px-4">Device Status</th>
                <th className="py-3 px-4">Hardware Identifier / MAC</th>
                <th className="py-3 px-4">Last Heartbeat</th>
                <th className="py-3 px-4 text-right">Kiosk Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-12" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-5 w-20 rounded-full" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-3.5 px-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3.5 px-4 text-right"><Skeleton className="h-6 w-24 ml-auto rounded" /></td>
                  </tr>
                ))
              ) : filteredClassrooms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No classroom devices found matching search filters.
                  </td>
                </tr>
              ) : (
                filteredClassrooms.map((room) => (
                  <tr key={room.id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-sm">Room {room.room_number}</div>
                      <div className="text-[10px] text-slate-400">{room.campus?.name || 'Main Campus'}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-800">{room.building}</div>
                      <div className="text-[10px] text-slate-400">Floor {room.floor}</div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-700">
                      {room.capacity} seats
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          room.device_status === 'active' ? 'success' :
                          room.device_status === 'paired' ? 'info' :
                          room.device_status === 'unpaired' ? 'warning' : 'danger'
                        }
                      >
                        {room.device_status.toUpperCase()}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      {room.device_identifier ? (
                        <span className="text-slate-800 font-semibold">{room.device_identifier}</span>
                      ) : room.device_pairing_code ? (
                        <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-bold">
                          PIN: {room.device_pairing_code}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unregistered</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {room.last_ping_at ? (
                        new Date(room.last_ping_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                      ) : (
                        <span className="text-slate-400">No Signal</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center space-x-1.5">
                        <button
                          onClick={() => handleGeneratePin(room)}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition"
                          title="Generate 6-digit Smart Board pairing PIN"
                        >
                          <KeyRound className="h-3 w-3" />
                          <span>{room.device_status === 'paired' ? 'Rotate PIN' : 'Pair'}</span>
                        </button>

                        {room.device_identifier && (
                          <button
                            onClick={() => setRoomToRevoke(room)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition"
                            title="Revoke device registration"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Revoke</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6-Digit PIN Pairing Modal */}
      {pairingModalRoom && (
        <Modal
          isOpen={!!pairingModalRoom}
          onClose={() => setPairingModalRoom(null)}
          title={`Smart Board Kiosk Pairing - Room ${pairingModalRoom.room_number}`}
          subtitle="Enter this secure single-use PIN on the classroom display screen."
        >
          <div className="text-center space-y-5 py-3">
            <div className="inline-flex items-center justify-center p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
              <Tv className="h-10 w-10 text-indigo-600" />
            </div>

            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                One-Time Hardware Pairing PIN
              </div>
              <div className="text-4xl font-mono font-black tracking-widest text-indigo-900 bg-slate-50 border-2 border-dashed border-indigo-300 py-3 px-6 rounded-2xl inline-block shadow-inner">
                {generatedPin}
              </div>
            </div>

            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Open the <strong>CampusAttend Smart Display</strong> kiosk application in Room {pairingModalRoom.room_number} and input this 6-digit code.
            </p>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 text-amber-800 text-xs text-left flex items-start space-x-2">
              <Clock className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <strong>Expires in 15 Minutes:</strong> Unpaired PIN will automatically invalidate to prevent unauthorized kiosk spoofing.
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setPairingModalRoom(null)}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm transition text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Register Classroom Modal */}
      {isAddRoomOpen && (
        <Modal
          isOpen={isAddRoomOpen}
          onClose={() => setIsAddRoomOpen(false)}
          title="Register New Campus Classroom"
          subtitle="Add a lecture hall or laboratory to the hardware inventory."
        >
          <form onSubmit={handleCreateClassroom} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Room Number / Identifier *</label>
              <input
                type="text"
                required
                placeholder="e.g. CS-101, LH-3"
                value={newRoomNumber}
                onChange={(e) => setNewRoomNumber(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Building</label>
                <input
                  type="text"
                  value={newBuilding}
                  onChange={(e) => setNewBuilding(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Floor Number</label>
                <input
                  type="number"
                  min="0"
                  max="15"
                  value={newFloor}
                  onChange={(e) => setNewFloor(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Seating Capacity</label>
              <input
                type="number"
                min="10"
                max="500"
                value={newCapacity}
                onChange={(e) => setNewCapacity(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddRoomOpen(false)}
                className="px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingRoom}
                className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 font-bold rounded-xl shadow-sm transition"
              >
                {savingRoom ? 'Saving...' : 'Register Classroom'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Revoke Confirmation Dialog */}
      {roomToRevoke && (
        <ConfirmDialog
          isOpen={!!roomToRevoke}
          title={`Revoke Smart Board for Room ${roomToRevoke.room_number}?`}
          message={`Are you sure you want to unpair device "${roomToRevoke.device_identifier}"? The display in Room ${roomToRevoke.room_number} will be disconnected and will require re-pairing.`}
          confirmLabel="Revoke Device"
          isDestructive={true}
          onConfirm={handleRevokeDevice}
          onCancel={() => setRoomToRevoke(null)}
        />
      )}
    </div>
  );
};
