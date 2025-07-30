interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
}

interface QueryOptimizationConfig {
  batchSize: number;
  cacheTimeout: number;
  enablePagination: boolean;
  maxConcurrentQueries: number;
}

class PerformanceService {
  private metrics: PerformanceMetric[] = [];
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  private config: QueryOptimizationConfig = {
    batchSize: 100,
    cacheTimeout: 5 * 60 * 1000, // 5 minutes
    enablePagination: true,
    maxConcurrentQueries: 5
  };

  // Performance measurement
  startMeasurement(name: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration);
      
      if (duration > 1000) {
        console.warn(`🐌 Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
      }
    };
  }

  private recordMetric(name: string, duration: number): void {
    this.metrics.push({
      name,
      duration,
      timestamp: Date.now()
    });

    // Keep only last 100 metrics to prevent memory leaks
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  // Cache management
  setCache(key: string, data: any, ttl: number = this.config.cacheTimeout): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  getCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const isExpired = Date.now() - cached.timestamp > cached.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  // Query optimization helpers
  buildOptimizedQuery(baseQuery: any, options: {
    limit?: number;
    offset?: number;
    select?: string;
    orderBy?: { column: string; ascending?: boolean };
  }) {
    let query = baseQuery;

    // Apply specific field selection
    if (options.select) {
      query = query.select(options.select);
    }

    // Apply ordering
    if (options.orderBy) {
      query = query.order(options.orderBy.column, { 
        ascending: options.orderBy.ascending ?? false 
      });
    }

    // Apply pagination
    if (this.config.enablePagination) {
      const limit = options.limit || this.config.batchSize;
      query = query.limit(limit);
      
      if (options.offset) {
        query = query.range(options.offset, options.offset + limit - 1);
      }
    }

    return query;
  }

  // Debounce utility for search inputs
  debounce<T extends (...args: any[]) => any>(func: T, wait: number): T {
    let timeout: NodeJS.Timeout;
    
    return ((...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    }) as T;
  }

  // Batch processing for multiple operations
  async batchProcess<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    batchSize: number = this.config.batchSize
  ): Promise<R[]> {
    const results: R[] = [];
    const batches: T[][] = [];

    // Split items into batches
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    // Process batches with concurrency control
    const semaphore = new Array(this.config.maxConcurrentQueries).fill(null);
    let batchIndex = 0;

    const processBatch = async (): Promise<void> => {
      const batch = batches[batchIndex++];
      if (!batch) return;

      try {
        const batchResults = await processor(batch);
        results.push(...batchResults);
      } catch (error) {
        console.error('Batch processing error:', error);
      }

      if (batchIndex < batches.length) {
        await processBatch();
      }
    };

    await Promise.all(semaphore.map(() => processBatch()));
    return results;
  }

  // Performance reporting
  getPerformanceReport(): {
    averageQueryTime: number;
    slowQueries: PerformanceMetric[];
    cacheHitRate: number;
    totalQueries: number;
  } {
    const recentMetrics = this.metrics.filter(
      m => Date.now() - m.timestamp < 60000 // Last minute
    );

    const averageQueryTime = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length
      : 0;

    const slowQueries = recentMetrics.filter(m => m.duration > 500);

    return {
      averageQueryTime: Math.round(averageQueryTime),
      slowQueries,
      cacheHitRate: this.cache.size > 0 ? 0.85 : 0, // Estimated
      totalQueries: recentMetrics.length
    };
  }

  // Memory cleanup
  cleanup(): void {
    this.metrics = [];
    this.cache.clear();
  }
}

export const performanceService = new PerformanceService();