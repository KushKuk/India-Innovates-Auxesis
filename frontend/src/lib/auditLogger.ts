import { AuditEntry } from '@/types/verification';

/**
 * Audit logger for manual verification process
 * Tracks all actions with timestamps for compliance and monitoring
 */
export class AuditLogger {
  private logs: AuditEntry[] = [];

  /**
   * Log an information event
   */
  info(action: string, details?: string): AuditEntry {
    return this.log(action, 'info', details);
  }

  /**
   * Log a success event
   */
  success(action: string, details?: string): AuditEntry {
    return this.log(action, 'success', details);
  }

  /**
   * Log an error event
   */
  error(action: string, details?: string): AuditEntry {
    return this.log(action, 'error', details);
  }

  /**
   * Log a warning event
   */
  warning(action: string, details?: string): AuditEntry {
    return this.log(action, 'warning', details);
  }

  /**
   * Internal method to create a log entry
   */
  private log(action: string, status: AuditEntry['status'], details?: string): AuditEntry {
    const entry: AuditEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      action,
      status,
      details,
    };
    this.logs.push(entry);
    return entry;
  }

  /**
   * Get all audit logs
   */
  getLogs(): AuditEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs filtered by status
   */
  getLogsByStatus(status: AuditEntry['status']): AuditEntry[] {
    return this.logs.filter((log) => log.status === status);
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Export logs as JSON
   */
  export(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Format logs for display
   */
  format(): string {
    return this.logs
      .map((log) => {
        const time = log.timestamp.toLocaleTimeString();
        const status = `[${log.status.toUpperCase()}]`;
        const details = log.details ? ` - ${log.details}` : '';
        return `${time} ${status} ${log.action}${details}`;
      })
      .join('\n');
  }
}

// Export a singleton instance for use across the app
export const auditLogger = new AuditLogger();
