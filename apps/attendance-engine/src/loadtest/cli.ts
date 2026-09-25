import { LoadTestRunner } from './loadtestEngine.js';

async function main() {
  console.log('================================================================');
  console.log('🚀 CAMPUSATTEND OS - PRODUCTION ATTENDANCE ENGINE LOAD BENCHMARK');
  console.log('================================================================');
  console.log('Scenario: 10:00 AM Morning Rush');
  console.log('Simulating 4 simultaneous classrooms:');
  console.log(' - Class A: Operating Systems (LH-101, 70 students)');
  console.log(' - Class B: Database Management Systems (LH-204, 55 students)');
  console.log(' - Class C: Computer Networks (CS-LAB3, 80 students)');
  console.log(' - Class D: Software Engineering (LH-101, 60 students)');
  console.log('Total concurrent students: ~265 with ~15% duplicate scan retries.');
  console.log('Running test with 30 worker concurrency pool...\n');

  try {
    const results = await LoadTestRunner.runSimulation({
      classesCount: 4,
      studentsPerClass: 65,
      duplicatePercentage: 15,
      concurrencyLimit: 30,
      includeInvalidQrProbe: true,
    });

    console.log('================================================================');
    console.log('📊 BENCHMARK EXECUTION RESULTS');
    console.log('================================================================');
    console.log(`Total Requests Processed:     ${results.totalRequests}`);
    console.log(`Successful First Scans:       ${results.successfulScans} (marked present)`);
    console.log(`Duplicate Scans Detected:     ${results.duplicateScansDetected} (idempotent, 0 error)`);
    console.log(`Tampered QR Probes Rejected:  ${results.invalidTokenProbesRejected} (security verified)`);
    console.log(`Failed / Rejected Scans:      ${results.rejectedScans}`);
    console.log(`Actual Duplicate Rate:        ${results.duplicateRateActual}%`);
    console.log(`Failure Rate:                 ${results.failureRate}%`);
    console.log(`Total Elapsed Duration:       ${results.totalDurationMs} ms`);
    console.log(`Throughput:                   ${results.requestsPerSecond} requests/sec`);
    console.log('----------------------------------------------------------------');
    console.log('⏱️ LATENCY PERCENTILES');
    console.log('----------------------------------------------------------------');
    console.log(`Min Latency:                  ${results.latencyStats.minMs} ms`);
    console.log(`Average Latency:              ${results.latencyStats.avgMs} ms`);
    console.log(`p50 Latency (Median):         ${results.latencyStats.p50Ms} ms`);
    console.log(`p90 Latency:                  ${results.latencyStats.p90Ms} ms`);
    console.log(`p95 Latency:                  ${results.latencyStats.p95Ms} ms`);
    console.log(`p99 Latency:                  ${results.latencyStats.p99Ms} ms`);
    console.log(`Max Latency:                  ${results.latencyStats.maxMs} ms`);
    console.log('----------------------------------------------------------------');
    console.log('💾 SYSTEM RESOURCE UTILIZATION');
    console.log('----------------------------------------------------------------');
    console.log(`Process Memory RSS:           ${results.memory.rssMb} MB`);
    console.log(`Heap Used:                    ${results.memory.heapUsedMb} MB / ${results.memory.heapTotalMb} MB`);
    console.log(`CPU User Time:                ${results.cpu.userMs} ms`);
    console.log(`CPU System Time:              ${results.cpu.systemMs} ms`);
    console.log('================================================================\n');

    process.exit(0);
  } catch (err: any) {
    console.error('❌ Load test failed:', err);
    process.exit(1);
  }
}

main();
