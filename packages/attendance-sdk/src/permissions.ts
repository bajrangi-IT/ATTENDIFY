import { UserRole } from '@campusattend/shared-types';

export const RoleHierarchy: Record<UserRole, number> = {
  student: 1,
  faculty: 2,
  hod: 3,
  director: 4,
  it_admin: 4,
  super_admin: 5,
};

export function canManageSession(role: UserRole, sessionFacultyId?: string, currentFacultyId?: string): boolean {
  if (role === 'super_admin' || role === 'director') return true;
  if (role === 'hod') return true;
  if (role === 'faculty') {
    return sessionFacultyId === currentFacultyId;
  }
  return false;
}

export function canApproveLeave(role: UserRole): boolean {
  return ['faculty', 'hod', 'director', 'super_admin'].includes(role);
}

export function canViewDepartmentAnalytics(role: UserRole): boolean {
  return ['hod', 'director', 'super_admin'].includes(role);
}

export function canViewInstitutionAnalytics(role: UserRole): boolean {
  return ['director', 'super_admin'].includes(role);
}

export function canManageClassroomDevices(role: UserRole): boolean {
  return ['it_admin', 'super_admin'].includes(role);
}

export function canAdjustStudentAttendance(role: UserRole, isTeacherOfSession: boolean): boolean {
  if (role === 'super_admin' || role === 'director' || role === 'hod') return true;
  if (role === 'faculty' && isTeacherOfSession) return true;
  return false;
}
