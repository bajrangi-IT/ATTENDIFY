/**
 * Utility functions for consistent Academic Year, Semester, and Section formatting
 * across all dashboards, dropdowns, badges, and timetable slots.
 */

export interface SectionEntity {
  id?: string;
  name?: string;
  semester_id?: string;
  semester?: {
    id?: string;
    semester_number?: number;
    program?: {
      id?: string;
      name?: string;
      code?: string;
    };
  };
  semester_number?: number;
  program_code?: string;
  program_name?: string;
}

/**
 * Calculates academic year string from a semester number
 * e.g., Sem 1, 2 => "1st Year", Sem 3, 4 => "2nd Year", Sem 5, 6 => "3rd Year", Sem 7, 8 => "4th Year"
 */
export function getYearFromSemester(semNumber?: number): string {
  if (!semNumber || semNumber < 1) return '';
  const year = Math.ceil(semNumber / 2);
  if (year === 1) return '1st Year';
  if (year === 2) return '2nd Year';
  if (year === 3) return '3rd Year';
  return `${year}th Year`;
}

/**
 * Returns a comprehensive, crystal-clear label for any section
 * Format: "[Program] • [Year] (Semester [X]) — Section [Name]"
 * Example: "CSE • 2nd Year (Semester 3) — Section A"
 */
export function formatSectionLabel(
  section: SectionEntity | null | undefined,
  extraTag?: string
): string {
  if (!section) return 'Unassigned Class';

  const rawName = (section.name || '').trim();
  const secName = rawName.replace(/^Section\s*/i, '');
  const semNum = section.semester?.semester_number || section.semester_number;
  const progCode = section.semester?.program?.code || section.program_code;
  const progName = section.semester?.program?.name || section.program_name;
  const prog = progCode || progName || '';

  if (semNum) {
    const yearStr = getYearFromSemester(semNum);
    const progPrefix = prog ? `${prog} • ` : '';
    const base = `${progPrefix}${yearStr} (Semester ${semNum}) — Section ${secName || 'A'}`;
    return extraTag ? `${base} ${extraTag}` : base;
  }

  const base = `Section ${secName || 'A'}`;
  return extraTag ? `${base} ${extraTag}` : base;
}

/**
 * Shorter badge format for tables and cards
 * Format: "2nd Year (Sem 3) • Sec A"
 */
export function formatSectionShortBadge(
  section: SectionEntity | null | undefined
): string {
  if (!section) return 'Class';

  const rawName = (section.name || '').trim();
  const secName = rawName.replace(/^Section\s*/i, '');
  const semNum = section.semester?.semester_number || section.semester_number;

  if (semNum) {
    const yearStr = getYearFromSemester(semNum);
    return `${yearStr} (Sem ${semNum}) • Sec ${secName || 'A'}`;
  }

  return `Sec ${secName || 'A'}`;
}
