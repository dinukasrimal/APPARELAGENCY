import { Component, ReactNode } from 'react';

interface ModuleErrorBoundaryProps {
  children: ReactNode;
  moduleName: string;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

class ModuleErrorBoundary extends Component<
  ModuleErrorBoundaryProps,
  ModuleErrorBoundaryState
> {
  state: ModuleErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): ModuleErrorBoundaryState {
    return {
      hasError: true,
      errorMessage:
        error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }

  componentDidCatch(error: unknown, errorInfo: unknown) {
    // eslint-disable-next-line no-console
    console.error(
      `[ModuleErrorBoundary] Error in ${this.props.moduleName}:`,
      error,
      errorInfo
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 md:p-6">
          <div className="max-w-xl mx-auto border border-red-200 bg-red-50 rounded-lg p-4 space-y-2">
            <h2 className="text-sm font-semibold text-red-700">
              {this.props.moduleName} failed to load
            </h2>
            <p className="text-xs text-red-600">
              An error occurred while rendering this module on your device.
            </p>
            {this.state.errorMessage && (
              <pre className="text-[11px] text-red-700 bg-white/80 border border-red-100 rounded p-2 overflow-x-auto">
                {this.state.errorMessage}
              </pre>
            )}
            <p className="text-[11px] text-gray-500">
              Try switching to another module and back again. If this keeps
              happening, share a screenshot of this box with the developer.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ModuleErrorBoundary;
