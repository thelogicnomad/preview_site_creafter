import { useRef, useEffect, useState } from 'react';
import { Eye, ExternalLink, Loader2, Terminal, RefreshCw, AlertCircle, Monitor } from 'lucide-react';

interface WebContainerPreviewProps {
    previewUrl: string | null;
    isBooting: boolean;
    isInstalling: boolean;
    isRunning: boolean;
    error: string | null;
    terminalOutput: string[];
    onRefresh?: () => void;
}

export const WebContainerPreview = ({
    previewUrl,
    isBooting,
    isInstalling,
    isRunning,
    error,
    terminalOutput,
    onRefresh,
}: WebContainerPreviewProps) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const [showTerminal, setShowTerminal] = useState(true);

    // Auto-scroll terminal
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [terminalOutput]);

    // Hide terminal when preview is ready
    useEffect(() => {
        if (isRunning && previewUrl) {
            setTimeout(() => setShowTerminal(false), 1000);
        } else {
            setShowTerminal(true);
        }
    }, [isRunning, previewUrl]);

    return (
        <div className="flex flex-col h-full bg-zinc-950">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-emerald-500/10">
                        <Eye className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-sm text-zinc-300 font-semibold">Preview</span>

                    {isBooting && (
                        <span className="flex items-center gap-2 px-2.5 py-1 text-xs text-amber-400 bg-amber-500/10 rounded-full">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Booting WebContainer...
                        </span>
                    )}
                    {isInstalling && (
                        <span className="flex items-center gap-2 px-2.5 py-1 text-xs text-blue-400 bg-blue-500/10 rounded-full">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Installing dependencies...
                        </span>
                    )}
                    {isRunning && (
                        <span className="flex items-center gap-2 px-2.5 py-1 text-xs text-emerald-400 bg-emerald-500/10 rounded-full">
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                            Live
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowTerminal(!showTerminal)}
                        className={`p-2 rounded-lg transition-colors ${showTerminal
                                ? 'bg-zinc-700 text-zinc-200'
                                : 'hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300'
                            }`}
                        title="Toggle terminal"
                    >
                        <Terminal className="w-4 h-4" />
                    </button>
                    {previewUrl && (
                        <>
                            {onRefresh && (
                                <button
                                    onClick={onRefresh}
                                    className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-zinc-300"
                                    title="Refresh preview"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            )}
                            <a
                                href={previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-zinc-300"
                                title="Open in new tab"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        </>
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Terminal (collapsible) */}
                {showTerminal && (
                    <div
                        ref={terminalRef}
                        className={`
              bg-zinc-950 border-b border-zinc-800 overflow-y-auto font-mono text-xs scrollbar-thin
              ${previewUrl ? 'h-36' : 'flex-1'}
            `}
                    >
                        {terminalOutput.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-zinc-600">
                                <Terminal className="w-5 h-5 mr-2 opacity-50" />
                                <p>Terminal output will appear here</p>
                            </div>
                        ) : (
                            <div className="p-4 space-y-1">
                                {terminalOutput.map((line, i) => (
                                    <div
                                        key={i}
                                        className={`leading-relaxed
                      ${line.startsWith('❌') ? 'text-red-400' : ''}
                      ${line.startsWith('✅') ? 'text-emerald-400' : ''}
                      ${line.startsWith('⚡') || line.startsWith('🚀') ? 'text-amber-400' : ''}
                      ${line.startsWith('📦') || line.startsWith('📁') ? 'text-blue-400' : ''}
                      ${!line.match(/^[❌✅⚡🚀📦📁]/) ? 'text-zinc-500' : ''}
                    `}
                                    >
                                        {line}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Preview iframe or loading state */}
                <div className="flex-1 relative bg-zinc-900">
                    {error ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8">
                            <div className="p-4 rounded-full bg-red-500/10 mb-4">
                                <AlertCircle className="w-10 h-10 text-red-400" />
                            </div>
                            <p className="text-red-400 font-semibold text-lg">Error</p>
                            <p className="text-zinc-500 text-sm mt-2 max-w-md">{error}</p>
                        </div>
                    ) : previewUrl ? (
                        <iframe
                            src={previewUrl}
                            className="w-full h-full border-0 bg-white"
                            title="Preview"
                        />
                    ) : !isBooting && !isInstalling ? (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8">
                            <div className="p-6 rounded-2xl bg-zinc-800/50 border border-zinc-700/50 mb-6">
                                <Monitor className="w-14 h-14 text-zinc-600" />
                            </div>
                            <p className="text-zinc-400 text-lg font-medium">No preview available</p>
                            <p className="text-zinc-600 text-sm mt-2 max-w-xs">
                                Upload a ZIP file and click "Start Preview" to see your project
                            </p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full">
                            <div className="relative">
                                <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse"></div>
                                <Loader2 className="relative w-12 h-12 text-emerald-400 animate-spin" />
                            </div>
                            <p className="text-zinc-400 mt-6 font-medium">
                                {isBooting ? 'Booting WebContainer...' : 'Installing dependencies...'}
                            </p>
                            <p className="text-zinc-600 text-sm mt-2">This may take a moment</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
