# Job Scheduler Module

Cron-like job scheduling for periodic task execution with timezone support.

## Features

- Cron expression support
- Named jobs for identification
- Start/stop individual jobs
- Async job handlers
- Logging integration

## Usage

### Basic Setup

```typescript
import { JobScheduler, Job } from "bun-node-common";

const scheduler = new JobScheduler();

// Define a job
const dailyReport: Job = {
  name: "daily-report",
  schedule: "0 9 * * *", // Every day at 9 AM
  handler: async () => {
    const report = await generateReport();
    await sendEmail(report);
  }
};

// Register and start
scheduler.register(dailyReport);
scheduler.start("daily-report");
```

### Cron Expression Format

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-6, Sunday=0)
│ │ │ │ │
* * * * *
```

### Common Schedules

| Expression | Description |
|------------|-------------|
| `* * * * *` | Every minute |
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour |
| `0 0 * * *` | Every day at midnight |
| `0 9 * * 1-5` | Weekdays at 9 AM |
| `0 0 1 * *` | First day of month |
| `0 0 * * 0` | Every Sunday |

### With Logger

```typescript
import { JobScheduler, LoggerFactory } from "bun-node-common";

const loggerFactory = new LoggerFactory({ ... });
const scheduler = new JobScheduler(loggerFactory);

scheduler.register({
  name: "cleanup",
  schedule: "0 2 * * *", // 2 AM daily
  handler: async () => {
    await cleanupOldRecords();
  }
});
```

## Use Cases

### Database Cleanup

```typescript
scheduler.register({
  name: "db-cleanup",
  schedule: "0 3 * * *", // 3 AM daily
  handler: async () => {
    await db.query(`
      DELETE FROM logs 
      WHERE created_at < NOW() - INTERVAL '30 days'
    `);
    await db.query("VACUUM ANALYZE logs");
  }
});
```

### Report Generation

```typescript
scheduler.register({
  name: "weekly-report",
  schedule: "0 8 * * 1", // Monday 8 AM
  handler: async () => {
    const data = await collectWeeklyMetrics();
    const report = generateReport(data);
    await sendToStakeholders(report);
  }
});
```

### Cache Warming

```typescript
scheduler.register({
  name: "cache-warm",
  schedule: "*/30 * * * *", // Every 30 minutes
  handler: async () => {
    const popularItems = await getPopularItems();
    for (const item of popularItems) {
      await cache.set(`item:${item.id}`, item);
    }
  }
});
```

### External API Sync

```typescript
scheduler.register({
  name: "currency-sync",
  schedule: "0 */4 * * *", // Every 4 hours
  handler: async () => {
    const rates = await fetchExchangeRates();
    await updateRatesInDb(rates);
    cache.invalidate("exchange-rates");
  }
});
```

## API

### JobScheduler

```typescript
class JobScheduler {
  constructor(loggerFactory?: LoggerFactory);
  
  register(job: Job): void;
  unregister(name: string): void;
  
  start(name: string): void;
  stop(name: string): void;
  startAll(): void;
  stopAll(): void;
  
  isRunning(name: string): boolean;
  getJobs(): Job[];
}
```

### Job Interface

```typescript
interface Job {
  name: string;
  schedule: string; // Cron expression
  handler: () => Promise<void>;
  enabled?: boolean; // Default: true
}
```

## Lifecycle Management

```typescript
const scheduler = new JobScheduler(loggerFactory);

// Register multiple jobs
scheduler.register(dailyBackup);
scheduler.register(hourlySync);
scheduler.register(weeklyReport);

// Start all registered jobs
scheduler.startAll();

// Stop specific job
scheduler.stop("weekly-report");

// Check job status
if (scheduler.isRunning("daily-backup")) {
  console.log("Backup job is active");
}

// Graceful shutdown
process.on("SIGTERM", () => {
  scheduler.stopAll();
  process.exit(0);
});
```

## Error Handling

Jobs that throw errors are logged but don't affect other jobs:

```typescript
scheduler.register({
  name: "risky-job",
  schedule: "*/10 * * * *",
  handler: async () => {
    try {
      await riskyOperation();
    } catch (error) {
      // Log and handle gracefully
      await notifyOnFailure(error);
      // Don't rethrow - job will run again at next interval
    }
  }
});
```

## Best Practices

1. **Use descriptive names** - Makes monitoring easier
2. **Handle errors within handlers** - Prevent job crashes
3. **Avoid overlapping schedules** - For resource-intensive jobs
4. **Log job execution** - Track success/failure rates
5. **Test cron expressions** - Verify schedules are correct
6. **Implement idempotency** - Jobs may run multiple times
