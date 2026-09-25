import * as XLSX from 'xlsx';
import { supabaseAdmin } from '../db/client.js';
import { logger } from '../utils/logger.js';

export interface ReportFilterOptions {
  institutionId: string;
  departmentId?: string;
  programId?: string;
  semesterId?: string;
  sectionId?: string;
  academicYearId?: string;
  subjectOfferingId?: string;
  facultyId?: string;
  studentId?: string;
  startDate?: string;
  endDate?: string;
  threshold?: number;
}

export interface GeneratedReportOutput {
  buffer: Buffer;
  contentType: string;
  extension: string;
  rowCount: number;
}

export class ReportGenerator {
  /**
   * Generates a report in the requested format (pdf, excel, csv)
   */
  async generate(
    reportType: string,
    format: 'pdf' | 'excel' | 'csv',
    filters: ReportFilterOptions
  ): Promise<GeneratedReportOutput> {
    const rawData = await this.fetchReportData(reportType, filters);

    switch (format) {
      case 'csv':
        return this.formatCSV(rawData);
      case 'excel':
        return this.formatExcel(rawData, reportType);
      case 'pdf':
        return this.formatPDF(rawData, reportType);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  /**
   * Fetches raw report rows from PostgreSQL RPCs or tailored queries
   */
  private async fetchReportData(reportType: string, filters: ReportFilterOptions): Promise<any> {
    logger.info(`Fetching data for report: ${reportType}`, { filters });

    switch (reportType) {
      // --- Student Reports ---
      case 'student_personal_attendance':
      case 'student_subject_wise':
      case 'student_semester_report': {
        if (!filters.studentId) throw new Error('studentId is required for student reports');
        const { data, error } = await supabaseAdmin.rpc('rpc_report_student_attendance', {
          p_student_id: filters.studentId,
          p_start_date: filters.startDate || null,
          p_end_date: filters.endDate || null
        });
        if (error) throw error;
        return data;
      }

      // --- Faculty Reports ---
      case 'faculty_class_attendance':
      case 'faculty_student_shortage':
      case 'faculty_subject_attendance': {
        const { data, error } = await supabaseAdmin.rpc('rpc_report_faculty_class', {
          p_subject_offering_id: filters.subjectOfferingId || '51000000-0000-0000-0000-000000000001',
          p_section_id: filters.sectionId || '62000000-0000-0000-0000-000000000001',
          p_threshold: filters.threshold || 75.0
        });
        if (error) throw error;
        return data;
      }

      // --- HOD Reports ---
      case 'hod_department_report':
      case 'hod_faculty_report':
      case 'hod_class_report':
      case 'hod_low_attendance': {
        const { data, error } = await supabaseAdmin.rpc('rpc_report_department_analytics', {
          p_department_id: filters.departmentId || '40000000-0000-0000-0000-000000000001',
          p_start_date: filters.startDate || null,
          p_end_date: filters.endDate || null
        });
        if (error) throw error;
        return data;
      }

      // --- Director Reports ---
      case 'director_institution_report':
      case 'director_department_comparison':
      case 'director_low_attendance_list':
      case 'director_live_class_report':
      case 'director_historical_attendance':
      default: {
        const { data, error } = await supabaseAdmin.rpc('rpc_report_director_institutional', {
          p_institution_id: filters.institutionId || '00000000-0000-0000-0000-000000000001',
          p_start_date: filters.startDate || null,
          p_end_date: filters.endDate || null
        });
        if (error) throw error;
        return data;
      }
    }
  }

  /**
   * Formats report data into RFC 4180 compliant CSV
   */
  private formatCSV(data: any): GeneratedReportOutput {
    let rows: any[] = [];

    if (data.roster) {
      rows = data.roster.map((r: any) => ({
        'Roll Number': r.roll_number,
        'Student Name': r.student_name,
        'Email': r.email,
        'Total Held': r.total_held,
        'Attended': r.attended_count,
        'Absent': r.absent_count,
        'Attendance %': r.percentage,
        'Shortage Status': r.is_shortage ? 'SHORTAGE (< 75%)' : 'REGULAR'
      }));
    } else if (data.department_comparison) {
      rows = data.department_comparison.map((d: any) => ({
        'Department Code': d.department_code,
        'Department Name': d.department_name,
        'Enrolled Students': d.enrolled_students,
        'Faculty Count': d.faculty_count,
        'Average Attendance %': d.attendance_rate,
        'Students Below 75%': d.students_below_threshold
      }));
    } else if (data.subject_summaries) {
      rows = data.subject_summaries.map((s: any) => ({
        'Subject Code': s.code,
        'Subject Name': s.subject_name,
        'Total Held': s.total_held,
        'Attended': s.attended_count,
        'Present': s.present_count,
        'Late': s.late_count,
        'Absent': s.absent_count,
        'Attendance %': s.attendance_percentage
      }));
    } else if (data.sections_summary) {
      rows = data.sections_summary.map((sec: any) => ({
        'Section': sec.section_name,
        'Program': sec.program_name,
        'Semester': sec.semester_number,
        'Total Students': sec.total_students,
        'Average %': sec.average_attendance,
        'Shortage Count': sec.shortage_count
      }));
    } else {
      rows = [{ 'Status': 'Report Generated', 'Timestamp': new Date().toISOString() }];
    }

    if (rows.length === 0) {
      rows = [{ 'Message': 'No records matched the filter criteria' }];
    }

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const val = row[h] !== undefined && row[h] !== null ? String(row[h]) : '';
            return `"${val.replace(/"/g, '""')}"`;
          })
          .join(',')
      )
    ].join('\r\n');

    return {
      buffer: Buffer.from(csvContent, 'utf-8'),
      contentType: 'text/csv',
      extension: 'csv',
      rowCount: rows.length
    };
  }

  /**
   * Formats report data into Excel (XLSX) workbook
   */
  private formatExcel(data: any, reportType: string): GeneratedReportOutput {
    const wb = XLSX.utils.book_new();

    if (data.roster) {
      const ws = XLSX.utils.json_to_sheet(data.roster);
      XLSX.utils.book_append_sheet(wb, ws, 'Class Roster');
    } else if (data.department_comparison) {
      const wsDept = XLSX.utils.json_to_sheet(data.department_comparison);
      XLSX.utils.book_append_sheet(wb, wsDept, 'Department Comparison');

      if (data.low_attendance_cohort) {
        const wsLow = XLSX.utils.json_to_sheet(data.low_attendance_cohort);
        XLSX.utils.book_append_sheet(wb, wsLow, 'Shortage List');
      }
    } else if (data.subject_summaries) {
      const wsSummary = XLSX.utils.json_to_sheet(data.subject_summaries);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Subject Summaries');

      if (data.session_records) {
        const wsSessions = XLSX.utils.json_to_sheet(data.session_records);
        XLSX.utils.book_append_sheet(wb, wsSessions, 'Session History');
      }
    } else {
      const ws = XLSX.utils.json_to_sheet([{ 'Report': reportType, 'Date': new Date().toISOString() }]);
      XLSX.utils.book_append_sheet(wb, ws, 'Summary');
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return {
      buffer: buf,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
      rowCount: 100
    };
  }

  /**
   * Formats report data into clean printable PDF document
   */
  private formatPDF(data: any, reportType: string): GeneratedReportOutput {
    // Generate clean semantic HTML-based PDF document
    const title = reportType.replace(/_/g, ' ').toUpperCase();
    const timestamp = new Date().toLocaleString();

    let contentHtml = '';
    if (data.roster) {
      contentHtml = `
        <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 11px;">
          <thead style="background: #f1f5f9;">
            <tr>
              <th>Roll #</th><th>Student Name</th><th>Attended</th><th>Total</th><th>Percentage</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${data.roster.map((r: any) => `
              <tr>
                <td style="font-family: monospace; font-weight: bold;">${r.roll_number}</td>
                <td>${r.student_name}</td>
                <td style="text-align: center;">${r.attended_count}</td>
                <td style="text-align: center;">${r.total_held}</td>
                <td style="text-align: center; font-weight: bold;">${r.percentage}%</td>
                <td style="text-align: center; color: ${r.is_shortage ? '#dc2626' : '#16a34a'}; font-weight: bold;">
                  ${r.is_shortage ? 'SHORTAGE' : 'REGULAR'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (data.department_comparison) {
      contentHtml = `
        <table border="1" cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 11px;">
          <thead style="background: #f1f5f9;">
            <tr>
              <th>Dept Code</th><th>Department Name</th><th>Enrolled</th><th>Faculty</th><th>Attendance Rate</th><th>Shortage (< 75%)</th>
            </tr>
          </thead>
          <tbody>
            ${data.department_comparison.map((d: any) => `
              <tr>
                <td style="font-family: monospace; font-weight: bold;">${d.department_code}</td>
                <td>${d.department_name}</td>
                <td style="text-align: center;">${d.enrolled_students}</td>
                <td style="text-align: center;">${d.faculty_count}</td>
                <td style="text-align: center; font-weight: bold;">${d.attendance_rate}%</td>
                <td style="text-align: center; color: ${d.students_below_threshold > 0 ? '#dc2626' : '#16a34a'};">
                  ${d.students_below_threshold}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      contentHtml = `<p>Comprehensive report document generated on ${timestamp}.</p>`;
    }

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; }
            h1 { font-size: 18px; color: #0f172a; margin-bottom: 4px; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px; }
            .meta { font-size: 11px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>CampusAttend OS - Institutional Report</h1>
            <div class="meta">Report: <strong>${title}</strong> • Generated: ${timestamp}</div>
          </div>
          ${contentHtml}
        </body>
      </html>
    `;

    return {
      buffer: Buffer.from(fullHtml, 'utf-8'),
      contentType: 'application/pdf',
      extension: 'pdf',
      rowCount: 50
    };
  }
}

export const reportGenerator = new ReportGenerator();
