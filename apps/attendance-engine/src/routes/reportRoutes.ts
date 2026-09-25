import { Router, Request, Response } from 'express';
import fs from 'fs';
import { authenticateJwt } from '../middleware/authMiddleware.js';
import { reportQueueService } from '../services/reportQueue.js';
import { supabaseAdmin } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { auditService } from '../services/auditService.js';

export const reportRouter = Router();

const ROLE_PERMITTED_REPORTS: Record<string, string[]> = {
  student: [
    'student_personal_attendance',
    'student_subject_wise',
    'student_semester_report'
  ],
  faculty: [
    'student_personal_attendance',
    'student_subject_wise',
    'student_semester_report',
    'faculty_class_attendance',
    'faculty_subject_attendance',
    'faculty_student_shortage',
    'faculty_session_report'
  ],
  hod: [
    'student_personal_attendance',
    'student_subject_wise',
    'student_semester_report',
    'faculty_class_attendance',
    'faculty_subject_attendance',
    'faculty_student_shortage',
    'faculty_session_report',
    'hod_department_report',
    'hod_faculty_report',
    'hod_class_report',
    'hod_low_attendance'
  ],
  director: [
    'student_personal_attendance',
    'student_subject_wise',
    'student_semester_report',
    'faculty_class_attendance',
    'faculty_subject_attendance',
    'faculty_student_shortage',
    'faculty_session_report',
    'hod_department_report',
    'hod_faculty_report',
    'hod_class_report',
    'hod_low_attendance',
    'director_institution_report',
    'director_department_comparison',
    'director_section_report',
    'director_subject_report',
    'director_faculty_session_report',
    'director_low_attendance_list',
    'director_live_class_report',
    'director_historical_attendance'
  ],
  it_admin: [
    'student_personal_attendance',
    'student_subject_wise',
    'student_semester_report',
    'faculty_class_attendance',
    'faculty_subject_attendance',
    'faculty_student_shortage',
    'faculty_session_report',
    'hod_department_report',
    'hod_faculty_report',
    'hod_class_report',
    'hod_low_attendance',
    'director_institution_report',
    'director_department_comparison',
    'director_section_report',
    'director_subject_report',
    'director_faculty_session_report',
    'director_low_attendance_list',
    'director_live_class_report',
    'director_historical_attendance'
  ],
  super_admin: ['*']
};

/**
 * POST /api/reports/generate
 * Asynchronously enqueues report generation via BullMQ worker without blocking API
 */
reportRouter.post('/generate', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { reportType, format = 'pdf', filters = {} } = req.body;

    if (!reportType) {
      return res.status(400).json({ error: 'reportType is required' });
    }

    const validFormats = ['pdf', 'excel', 'csv'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({
        error: `Invalid format: ${format}. Allowed formats: ${validFormats.join(', ')}`
      });
    }

    // Role-based Access Control (RBAC) validation
    const allowedReports = ROLE_PERMITTED_REPORTS[user.role] || [];
    if (!allowedReports.includes('*') && !allowedReports.includes(reportType)) {
      logger.security(`Unauthorized report request: ${user.id} (${user.role}) -> ${reportType}`);
      return res.status(403).json({
        error: `Forbidden: Role '${user.role}' is not authorized to generate '${reportType}'`
      });
    }

    // IDOR Protection: Students can only generate reports for their own profile
    if (user.role === 'student') {
      filters.studentId = user.id;
    }

    const institutionId = filters.institutionId || '00000000-0000-0000-0000-000000000001';

    // Create tracking record in PostgreSQL
    const { data: dbReport, error: dbError } = await supabaseAdmin
      .from('generated_reports')
      .insert({
        institution_id: institutionId,
        requester_id: user.id,
        role: user.role,
        report_type: reportType,
        format,
        status: 'queued',
        filters
      })
      .select('id, status, created_at')
      .single();

    if (dbError) {
      logger.error('Failed to create report record in database', dbError);
      return res.status(500).json({ error: 'Database tracking error for report job' });
    }

    // Enqueue asynchronously into BullMQ
    const queueResult = await reportQueueService.enqueueReport({
      reportId: dbReport.id,
      requesterId: user.id,
      role: user.role,
      reportType,
      format,
      filters: {
        institutionId,
        ...filters
      }
    });

    // Audit the report generation request
    await auditService.log({
      actorId: user.id,
      action: 'REPORT_REQUESTED',
      entityType: 'generated_report',
      entityId: dbReport.id,
      reason: `Asynchronous report generation for ${reportType} (${format})`,
      metadata: { format, filters }
    });

    // Respond immediately with 202 Accepted without blocking the API
    return res.status(202).json({
      success: true,
      reportId: dbReport.id,
      status: 'queued',
      jobId: queueResult.jobId,
      message: 'Report generation has been queued asynchronously. Check status using the status endpoint.',
      statusUrl: `/api/reports/${dbReport.id}`
    });
  } catch (err: any) {
    logger.error('Error in /api/reports/generate', err);
    return res.status(500).json({ error: 'Failed to enqueue report generation' });
  }
});

/**
 * GET /api/reports/:id
 * Polls report status and metadata
 */
reportRouter.get('/:id', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const { data: report, error } = await supabaseAdmin
      .from('generated_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // IDOR Check: Requester must be creator OR have administrative privileges
    const isOwner = report.requester_id === user.id;
    const isPrivileged = ['director', 'hod', 'it_admin', 'super_admin'].includes(user.role);
    if (!isOwner && !isPrivileged) {
      logger.security(`IDOR blocked: ${user.id} tried to view report ${id} belonging to ${report.requester_id}`);
      return res.status(403).json({ error: 'Access denied to this report' });
    }

    return res.status(200).json({
      id: report.id,
      reportType: report.report_type,
      format: report.format,
      status: report.status,
      fileUrl: report.file_url,
      rowCount: report.row_count,
      fileSizeBytes: report.file_size_bytes,
      errorMessage: report.error_message,
      createdAt: report.created_at,
      completedAt: report.completed_at
    });
  } catch (err: any) {
    logger.error('Error fetching report status', err);
    return res.status(500).json({ error: 'Failed to retrieve report status' });
  }
});

/**
 * GET /api/reports/:id/download
 * Streams or downloads generated report file
 */
reportRouter.get('/:id/download', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    const { data: report, error } = await supabaseAdmin
      .from('generated_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !report) {
      return res.status(404).json({ error: 'Report record not found' });
    }

    // IDOR Check
    const isOwner = report.requester_id === user.id;
    const isPrivileged = ['director', 'hod', 'it_admin', 'super_admin'].includes(user.role);
    if (!isOwner && !isPrivileged) {
      return res.status(403).json({ error: 'Access denied: You cannot download reports generated by other users' });
    }

    if (report.status !== 'completed') {
      return res.status(400).json({
        error: `Report is not ready for download. Current status: ${report.status}`
      });
    }

    const ext = report.format === 'excel' ? 'xlsx' : report.format;
    const filename = `${report.report_type}_${report.id.slice(0, 8)}.${ext}`;
    const filePath = reportQueueService.getArtifactPath(filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Report file artifact not found on server' });
    }

    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv'
    };

    res.setHeader('Content-Type', mimeTypes[report.format] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const stream = fs.createReadStream(filePath);
    return stream.pipe(res);
  } catch (err: any) {
    logger.error('Error downloading report', err);
    return res.status(500).json({ error: 'Failed to download report artifact' });
  }
});

/**
 * GET /api/reports
 * Lists reports requested by current user (with pagination)
 */
reportRouter.get('/', authenticateJwt, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    let query = supabaseAdmin
      .from('generated_reports')
      .select('id, report_type, format, status, row_count, file_size_bytes, created_at, completed_at')
      .order('created_at', { ascending: false })
      .limit(50);

    // Normal users only see their own reports
    if (!['director', 'super_admin'].includes(user.role)) {
      query = query.eq('requester_id', user.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({ reports: data || [] });
  } catch (err: any) {
    logger.error('Error listing reports', err);
    return res.status(500).json({ error: 'Failed to list reports' });
  }
});
