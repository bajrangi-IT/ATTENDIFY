import { Queue, Worker, Job } from 'bullmq';
import { reportGenerator, ReportFilterOptions } from './reportGenerator.js';
import { supabaseAdmin } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { metricsCollector } from '../utils/metrics.js';
import { notificationService } from './notificationService.js';
import fs from 'fs';
import path from 'path';

export interface ReportJobData {
  reportId: string;
  requesterId: string;
  role: string;
  reportType: string;
  format: 'pdf' | 'excel' | 'csv';
  filters: ReportFilterOptions;
}

export class ReportQueueService {
  private queue: Queue<ReportJobData> | null = null;
  private worker: Worker<ReportJobData> | null = null;
  private isRedisAvailable: boolean = false;
  private artifactsDir: string;

  constructor() {
    this.artifactsDir = path.resolve(process.cwd(), 'temp_reports');
    if (!fs.existsSync(this.artifactsDir)) {
      try {
        fs.mkdirSync(this.artifactsDir, { recursive: true });
      } catch (err) {
        // ignore
      }
    }
    this.initQueue();
  }

  private async initQueue() {
    const redisUrl = process.env.REDIS_URL;

    if (redisUrl) {
      try {
        const connection = { url: redisUrl };
        this.queue = new Queue<ReportJobData>('report-generation', { connection });
        this.worker = new Worker<ReportJobData>(
          'report-generation',
          async (job: Job<ReportJobData>) => {
            return this.processJob(job.data);
          },
          { connection, concurrency: 4 }
        );

        this.worker.on('completed', (job) => {
          logger.info(`BullMQ Report Job ${job.id} completed successfully`);
          metricsCollector.recordQueueJob(true);
        });

        this.worker.on('failed', (job, err) => {
          logger.error(`BullMQ Report Job ${job?.id} failed`, err);
          metricsCollector.recordQueueJob(false);
        });

        this.isRedisAvailable = true;
        logger.info('BullMQ worker initialized with Redis backend');
        return;
      } catch (err) {
        logger.warn('Failed to connect BullMQ to Redis, using in-memory async worker fallback');
      }
    }

    this.isRedisAvailable = false;
    logger.info('BullMQ running in resilient asynchronous in-memory worker mode');
  }

  /**
   * Enqueues report job asynchronously without blocking caller API response
   */
  async enqueueReport(data: ReportJobData): Promise<{ jobId: string; status: string }> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Mark report record as queued in database
    await supabaseAdmin
      .from('generated_reports')
      .update({ status: 'queued', updated_at: new Date().toISOString() })
      .eq('id', data.reportId);

    // 2. Enqueue via BullMQ if Redis connected
    if (this.queue && this.isRedisAvailable) {
      await this.queue.add('generate-report', data, {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true
      });
      return { jobId, status: 'queued' };
    }

    // 3. Fallback: Asynchronous non-blocking worker execution via setImmediate
    setImmediate(async () => {
      try {
        await this.processJob(data);
        metricsCollector.recordQueueJob(true);
      } catch (err) {
        logger.error('Async in-memory worker report generation failed', err);
        metricsCollector.recordQueueJob(false);
      }
    });

    return { jobId, status: 'queued' };
  }

  /**
   * Executes report generation, saves artifact, and updates database status
   */
  async processJob(data: ReportJobData) {
    const startTime = Date.now();
    logger.info(`Starting asynchronous processing for report ${data.reportId}`, {
      reportType: data.reportType,
      format: data.format
    });

    try {
      // Set status to processing
      await supabaseAdmin
        .from('generated_reports')
        .update({ status: 'processing' })
        .eq('id', data.reportId);

      // Generate output buffer
      const result = await reportGenerator.generate(data.reportType, data.format, data.filters);

      // Save file artifact to disk / storage
      const filename = `${data.reportType}_${data.reportId.slice(0, 8)}.${result.extension}`;
      const filePath = path.join(this.artifactsDir, filename);
      fs.writeFileSync(filePath, result.buffer);

      const fileUrl = `/api/reports/${data.reportId}/download?file=${encodeURIComponent(filename)}`;

      // Update database record to completed
      await supabaseAdmin
        .from('generated_reports')
        .update({
          status: 'completed',
          file_url: fileUrl,
          file_size_bytes: result.buffer.byteLength,
          row_count: result.rowCount,
          completed_at: new Date().toISOString()
        })
        .eq('id', data.reportId);

      const durationMs = Date.now() - startTime;
      logger.info(`Report ${data.reportId} generated successfully in ${durationMs}ms`, {
        fileSize: result.buffer.byteLength,
        rows: result.rowCount
      });

      // Dispatch in-app notification to requester that report is ready
      await notificationService.send({
        recipientId: data.requesterId,
        title: 'Institutional Report Ready',
        message: `Your requested ${data.reportType.replace(/_/g, ' ')} (${data.format.toUpperCase()}) has been compiled and is ready for download.`,
        type: 'report_approved',
        actionUrl: fileUrl,
        channels: ['in_app']
      });

      return { success: true, fileUrl, rowCount: result.rowCount };
    } catch (err: any) {
      logger.error(`Report generation failed for ${data.reportId}`, err);

      await supabaseAdmin
        .from('generated_reports')
        .update({
          status: 'failed',
          error_message: err.message || 'Report compilation failure',
          completed_at: new Date().toISOString()
        })
        .eq('id', data.reportId);

      throw err;
    }
  }

  getArtifactPath(filename: string): string {
    return path.join(this.artifactsDir, filename);
  }
}

export const reportQueueService = new ReportQueueService();
