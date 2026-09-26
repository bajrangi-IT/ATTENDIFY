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

export const initialStudentsRoster: RosterStudent[] = [];

export const mockDepartmentSummaries: StudentAttendanceSummary[] = [];

export const mockClassrooms: Classroom[] = [];

export const mockLeaveRequests: LeaveApplication[] = [];

export const mockAdjustmentRequests: AttendanceAdjustmentRequest[] = [];
