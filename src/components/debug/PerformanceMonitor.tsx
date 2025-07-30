import React, { useState, useEffect, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { performanceService } from '@/services/performance.service';
import { Activity, Clock, Database, Zap, RefreshCw } from 'lucide-react';

const PerformanceMonitor = memo(() => {
  const [metrics, setMetrics] = useState({
    averageQueryTime: 0,
    slowQueries: [],
    cacheHitRate: 0,
    totalQueries: 0
  });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateMetrics = () => {
      const report = performanceService.getPerformanceReport();
      setMetrics(report);
    };

    // Update metrics every 5 seconds
    const interval = setInterval(updateMetrics, 5000);
    updateMetrics();

    return () => clearInterval(interval);
  }, []);

  const getPerformanceStatus = () => {
    if (metrics.averageQueryTime < 200) return { color: 'green', label: 'Excellent' };
    if (metrics.averageQueryTime < 500) return { color: 'yellow', label: 'Good' };
    if (metrics.averageQueryTime < 1000) return { color: 'orange', label: 'Fair' };
    return { color: 'red', label: 'Poor' };
  };

  const status = getPerformanceStatus();

  if (!isVisible) {
    return (
      <div className=\"fixed bottom-4 right-4 z-50\">
        <Button
          onClick={() => setIsVisible(true)}
          variant=\"outline\"
          size=\"sm\"
          className=\"bg-white/90 backdrop-blur-sm\"
        >
          <Activity className=\"h-4 w-4 mr-2\" />
          Performance
        </Button>
      </div>
    );
  }

  return (
    <div className=\"fixed bottom-4 right-4 z-50 w-80\">
      <Card className=\"bg-white/95 backdrop-blur-sm shadow-xl border border-gray-200\">
        <CardHeader className=\"pb-3\">
          <div className=\"flex items-center justify-between\">
            <CardTitle className=\"text-sm font-semibold flex items-center gap-2\">
              <Activity className=\"h-4 w-4\" />
              Performance Monitor
            </CardTitle>
            <div className=\"flex items-center gap-2\">
              <Badge 
                variant={status.color === 'green' ? 'default' : 'secondary'}
                className={`text-xs ${
                  status.color === 'green' ? 'bg-green-100 text-green-800' :
                  status.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                  status.color === 'orange' ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800'
                }`}
              >
                {status.label}
              </Badge>
              <Button
                onClick={() => setIsVisible(false)}
                variant=\"ghost\"
                size=\"sm\"
                className=\"h-6 w-6 p-0\"
              >
                ×
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className=\"space-y-4\">
          {/* Average Query Time */}
          <div className=\"flex items-center justify-between\">
            <div className=\"flex items-center gap-2\">
              <Clock className=\"h-4 w-4 text-blue-600\" />
              <span className=\"text-sm\">Avg Query Time</span>
            </div>
            <span className=\"text-sm font-semibold\">{metrics.averageQueryTime}ms</span>
          </div>

          {/* Cache Hit Rate */}
          <div className=\"flex items-center justify-between\">
            <div className=\"flex items-center gap-2\">
              <Zap className=\"h-4 w-4 text-green-600\" />
              <span className=\"text-sm\">Cache Hit Rate</span>
            </div>
            <span className=\"text-sm font-semibold\">{Math.round(metrics.cacheHitRate * 100)}%</span>
          </div>

          {/* Total Queries */}
          <div className=\"flex items-center justify-between\">
            <div className=\"flex items-center gap-2\">
              <Database className=\"h-4 w-4 text-purple-600\" />
              <span className=\"text-sm\">Total Queries</span>
            </div>
            <span className=\"text-sm font-semibold\">{metrics.totalQueries}</span>
          </div>

          {/* Slow Queries */}
          {metrics.slowQueries.length > 0 && (
            <div>
              <div className=\"flex items-center gap-2 mb-2\">
                <RefreshCw className=\"h-4 w-4 text-orange-600\" />
                <span className=\"text-sm font-medium\">Slow Queries ({metrics.slowQueries.length})</span>
              </div>
              <div className=\"space-y-1 max-h-24 overflow-y-auto\">
                {metrics.slowQueries.slice(0, 3).map((query, index) => (
                  <div key={index} className=\"text-xs bg-gray-50 p-2 rounded\">
                    <div className=\"font-medium text-gray-800\">{query.name}</div>
                    <div className=\"text-gray-600\">{Math.round(query.duration)}ms</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className=\"flex gap-2 pt-2 border-t\">
            <Button
              onClick={() => performanceService.clearCache()}
              variant=\"outline\"
              size=\"sm\"
              className=\"flex-1 text-xs\"
            >
              Clear Cache
            </Button>
            <Button
              onClick={() => performanceService.cleanup()}
              variant=\"outline\"
              size=\"sm\"
              className=\"flex-1 text-xs\"
            >
              Reset Metrics
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

PerformanceMonitor.displayName = 'PerformanceMonitor';

export default PerformanceMonitor;