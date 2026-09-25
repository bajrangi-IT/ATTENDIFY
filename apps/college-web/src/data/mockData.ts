import { 
  UserRole, 
  AttendanceStatus, 
  StudentAttendanceSummary, 
  Classroom,
  LeaveApplication,
  AttendanceAdjustmentRequest 
} from '@campusattend/shared-types';

export interface RosterStudent {
  id: string;
  rollNumber: string;
  name: string;
  email: string;
  status: AttendanceStatus;
  markedAt?: string;
  method?: string;
  remarks?: string;
}

export const initialStudentsRoster: RosterStudent[] = [
  { id: '90000000-0000-0000-0000-000000000001', rollNumber: '23CSE001', name: 'Aarav Patel', email: 'aarav.patel@student.campusattend.edu', status: 'present', markedAt: '09:02 AM', method: 'dynamic_qr' },
  { id: '90000000-0000-0000-0000-000000000002', rollNumber: '23CSE002', name: 'Ananya Iyer', email: 'ananya.iyer@student.campusattend.edu', status: 'present', markedAt: '09:05 AM', method: 'dynamic_qr' },
  { id: '90000000-0000-0000-0000-000000000003', rollNumber: '23CSE003', name: 'Rohan Gupta', email: 'rohan.gupta@student.campusattend.edu', status: 'absent' },
  { id: '90000000-0000-0000-0000-000000000004', rollNumber: '23CSE004', name: 'Diya Sen', email: 'diya.sen@student.campusattend.edu', status: 'late', markedAt: '09:18 AM', method: 'dynamic_qr', remarks: 'Arrived after 10m grace period' },
  { id: '90000000-0000-0000-0000-000000000005', rollNumber: '23CSE005', name: 'Kabir Verma', email: 'kabir.verma@student.campusattend.edu', status: 'excused', method: 'leave_override', remarks: 'Medical Leave Approved' },
  { id: '90000000-0000-0000-0000-000000000006', rollNumber: '23CSE006', name: 'Sanya Mirza', email: 'sanya.mirza@student.campusattend.edu', status: 'present', markedAt: '09:08 AM', method: 'dynamic_qr' },
  { id: '90000000-0000-0000-0000-000000000007', rollNumber: '23CSE007', name: 'Aditya Rao', email: 'aditya.rao@student.campusattend.edu', status: 'absent' },
];

export const mockDepartmentSummaries: StudentAttendanceSummary[] = [
  {
    student_id: '90000000-0000-0000-0000-000000000001',
    roll_number: '23CSE001',
    student_name: 'Aarav Patel',
    subject_id: 'A0000000-0000-0000-0000-000000000001',
    subject_code: 'CS501',
    subject_name: 'Operating Systems',
    total_conducted_sessions: 24,
    attended_sessions: 23,
    excused_sessions: 0,
    absent_sessions: 1,
    attendance_percentage: 95.83,
    threshold_status: 'good',
  },
  {
    student_id: '90000000-0000-0000-0000-000000000002',
    roll_number: '23CSE002',
    student_name: 'Ananya Iyer',
    subject_id: 'A0000000-0000-0000-0000-000000000001',
    subject_code: 'CS501',
    subject_name: 'Operating Systems',
    total_conducted_sessions: 24,
    attended_sessions: 18,
    excused_sessions: 0,
    absent_sessions: 6,
    attendance_percentage: 75.00,
    threshold_status: 'warning',
  },
  {
    student_id: '90000000-0000-0000-0000-000000000003',
    roll_number: '23CSE003',
    student_name: 'Rohan Gupta',
    subject_id: 'A0000000-0000-0000-0000-000000000001',
    subject_code: 'CS501',
    subject_name: 'Operating Systems',
    total_conducted_sessions: 24,
    attended_sessions: 14,
    excused_sessions: 0,
    absent_sessions: 10,
    attendance_percentage: 58.33,
    threshold_status: 'critical',
  },
  {
    student_id: '90000000-0000-0000-0000-000000000004',
    roll_number: '23CSE004',
    student_name: 'Diya Sen',
    subject_id: 'A0000000-0000-0000-0000-000000000001',
    subject_code: 'CS501',
    subject_name: 'Operating Systems',
    total_conducted_sessions: 24,
    attended_sessions: 20,
    excused_sessions: 0,
    absent_sessions: 4,
    attendance_percentage: 83.33,
    threshold_status: 'good',
  },
  {
    student_id: '90000000-0000-0000-0000-000000000005',
    roll_number: '23CSE005',
    student_name: 'Kabir Verma',
    subject_id: 'A0000000-0000-0000-0000-000000000001',
    subject_code: 'CS501',
    subject_name: 'Operating Systems',
    total_conducted_sessions: 24,
    attended_sessions: 22,
    excused_sessions: 2,
    absent_sessions: 0,
    attendance_percentage: 91.67,
    threshold_status: 'good',
  },
];

export const mockClassrooms: Classroom[] = [
  {
    id: '70000000-0000-0000-0000-000000000001',
    campus_id: '10000000-0000-0000-0000-000000000001',
    room_number: 'LH-101',
    building: 'Turing Academic Block',
    floor: 1,
    capacity: 65,
    device_pairing_code: 'LH101X',
    device_status: 'online',
    last_ping_at: 'Just now',
    is_active: true,
  },
  {
    id: '70000000-0000-0000-0000-000000000002',
    campus_id: '10000000-0000-0000-0000-000000000001',
    room_number: 'LH-204',
    building: 'Turing Academic Block',
    floor: 2,
    capacity: 60,
    device_pairing_code: 'TRG204',
    device_status: 'online',
    last_ping_at: '2 mins ago',
    is_active: true,
  },
  {
    id: '70000000-0000-0000-0000-000000000003',
    campus_id: '10000000-0000-0000-0000-000000000001',
    room_number: 'CS-LAB3',
    building: 'Computing Center',
    floor: 3,
    capacity: 45,
    device_pairing_code: 'CSL003',
    device_status: 'online',
    last_ping_at: '5 mins ago',
    is_active: true,
  },
  {
    id: '70000000-0000-0000-0000-000000000004',
    campus_id: '10000000-0000-0000-0000-000000000001',
    room_number: 'ME-SEM1',
    building: 'Newton Engineering Hall',
    floor: 1,
    capacity: 70,
    device_pairing_code: 'NEW701',
    device_status: 'unpaired',
    last_ping_at: null,
    is_active: true,
  },
];

export const mockLeaveRequests: LeaveApplication[] = [
  {
    id: 'D0000000-0000-0000-0000-000000000002',
    student_id: '90000000-0000-0000-0000-000000000003',
    start_date: '2026-03-28',
    end_date: '2026-03-30',
    reason: 'Representing University in Smart India National Hackathon Finale',
    leave_type: 'academic_duty',
    status: 'pending',
    created_at: '2026-03-24',
    updated_at: '2026-03-24',
  },
  {
    id: 'D0000000-0000-0000-0000-000000000003',
    student_id: '90000000-0000-0000-0000-000000000002',
    start_date: '2026-03-20',
    end_date: '2026-03-21',
    reason: 'Acute Gastroenteritis - doctor consultation slip attached',
    leave_type: 'medical',
    status: 'approved',
    approved_by: 'Dr. Aris Thorne (HOD)',
    created_at: '2026-03-19',
    updated_at: '2026-03-20',
  },
];

export const mockAdjustmentRequests: AttendanceAdjustmentRequest[] = [
  {
    id: 'E0000000-0000-0000-0000-000000000001',
    student_id: '90000000-0000-0000-0000-000000000003',
    session_id: 'C0000000-0000-0000-0000-000000000003',
    requested_status: 'excused',
    reason: 'Phone battery died during lecture, was physically present in front row',
    status: 'pending',
    created_at: '2026-03-22',
    updated_at: '2026-03-22',
  },
];
