/**
 * Error Reporter - Injected into user projects to capture runtime errors
 * This script runs in the preview iframe and sends errors to parent window
 */

export function getErrorReporterScript(): string {
    return `
<script>
(function() {
    'use strict';
    
    // Throttle error reporting to prevent spam
    let lastErrorTime = 0;
    const ERROR_THROTTLE_MS = 2000;
    
    function canReportError() {
        const now = Date.now();
        if (now - lastErrorTime < ERROR_THROTTLE_MS) {
            return false;
        }
        lastErrorTime = now;
        return true;
    }
    
    function sendErrorToParent(errorData) {
        if (!canReportError()) return;
        
        try {
            window.parent.postMessage({
                type: 'RUNTIME_ERROR',
                ...errorData,
                timestamp: Date.now()
            }, '*');
        } catch (e) {
            console.error('Failed to send error to parent:', e);
        }
    }
    
    // Capture global JavaScript errors
    window.addEventListener('error', function(event) {
        const errorData = {
            message: event.message,
            stack: event.error?.stack || '',
            filename: event.filename || '',
            lineno: event.lineno || 0,
            colno: event.colno || 0,
            errorType: 'GLOBAL_ERROR'
        };
        
        console.error('🔴 Runtime Error:', errorData);
        sendErrorToParent(errorData);
    });
    
    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', function(event) {
        const errorData = {
            message: event.reason?.message || String(event.reason),
            stack: event.reason?.stack || '',
            errorType: 'UNHANDLED_REJECTION'
        };
        
        console.error('🔴 Unhandled Promise Rejection:', errorData);
        sendErrorToParent(errorData);
    });
    
    // Intercept console.error to catch React error boundary errors
    const originalConsoleError = console.error;
    console.error = function(...args) {
        // Call original first
        originalConsoleError.apply(console, args);
        
        // Check if this is a React error
        const errorText = args.map(arg => String(arg)).join(' ');
        
        if (errorText.includes('error boundary') || 
            errorText.includes('The above error occurred') ||
            errorText.includes('React will try to recreate')) {
            
            // Extract stack trace from arguments
            let stack = '';
            for (const arg of args) {
                if (typeof arg === 'string' && (arg.includes('at ') || arg.includes('http'))) {
                    stack = arg;
                    break;
                }
            }
            
            const errorData = {
                message: errorText,
                stack: stack,
                errorType: 'REACT_ERROR_BOUNDARY',
                isReactError: true
            };
            
            console.log('🔴 React Error Detected:', errorData);
            sendErrorToParent(errorData);
        }
    };
    
    console.log('✅ Error Reporter initialized');
})();
</script>
`.trim();
}

/**
 * Parse stack trace to extract file path and line number
 */
export function parseStackTrace(stack: string): { filePath: string | null; lineNumber: number | null } {
    if (!stack) return { filePath: null, lineNumber: null };

    // Match patterns like:
    // at Component (https://.../src/components/Component.tsx:24:31)
    // at https://.../src/App.tsx:45:12

    const patterns = [
        // React component format
        /at\s+\w+\s+\(https?:\/\/[^)]+\/(src\/[^:)]+):(\d+):\d+\)/,
        // Direct URL format
        /at\s+https?:\/\/[^/]+\/(src\/[^:)]+):(\d+):\d+/,
        // Simple path format
        /(src\/[\w\/.-]+\.(?:tsx?|jsx?))/
    ];

    for (const pattern of patterns) {
        const match = stack.match(pattern);
        if (match) {
            return {
                filePath: match[1],
                lineNumber: match[2] ? parseInt(match[2], 10) : null
            };
        }
    }

    return { filePath: null, lineNumber: null };
}
