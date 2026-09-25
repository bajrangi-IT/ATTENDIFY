/**
 * Metrics and Telemetry Collector for CampusAttend OS
 * Tracks latencies, throughput, error rates, QR failures, and queue status.
 */

export class MetricsCollector {
  private totalRequests: number = 0;
  private totalErrors: number = 0;
  private attendanceScans: number = 0;
  private qrFailures: number = 0;
  private queueCompleted: number = 0;
  private queueFailed: number = 0;
  private latencySamples: number[] = [];
  private maxSamples: number = 1000;

  recordRequest(latencyMs: number, isError: boolean = false) {
    this.totalRequests++;
    if (isError) this.totalErrors++;

    this.latencySamples.push(latencyMs);
    if (this.latencySamples.length > this.maxSamples) {
      this.latencySamples.shift();
    }
  }

  recordAttendanceScan(success: boolean) {
    this.attendanceScans++;
    if (!success) {
      this.qrFailures++;
    }
  }

  recordQueueJob(success: boolean) {
    if (success) {
      this.queueCompleted++;
    } else {
      this.queueFailed++;
    }
  }

  getSnapshot() {
    const total = this.totalRequests || 1;
    const avgLatency =
      this.latencySamples.length > 0
        ? Math.round(
            this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length
          )
        : 0;

    const sorted = [...this.latencySamples].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95Latency = sorted[p95Index] || 0;

    return {
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      errorRatePercent: +((this.totalErrors / total) * 100).toFixed(2),
      avgLatencyMs: avgLatency,
      p95LatencyMs: p95Latency,
      attendanceScansTotal: this.attendanceScans,
      qrFailuresTotal: this.qrFailures,
      qrFailureRatePercent:
        this.attendanceScans > 0
          ? +((this.qrFailures / this.attendanceScans) * 100).toFixed(2)
          : 0,
      queueJobsCompleted: this.queueCompleted,
      queueJobsFailed: this.queueFailed
    };
  }

  reset() {
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.attendanceScans = 0;
    this.qrFailures = 0;
    this.queueCompleted = 0;
    this.queueFailed = 0;
    this.latencySamples = [];
  }
}

export const metricsCollector = new MetricsCollector();
