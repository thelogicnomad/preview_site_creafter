import { useState, useCallback, useEffect, useRef } from 'react';
import { ZipUpload } from './components/ZipUpload';
import { FileExplorer } from './components/FileExplorer';
import { CodeEditor } from './components/CodeEditor';
import { WebContainerPreview } from './components/WebContainerPreview';
import type { FileNode } from './utils/fileUtils';
import { extractZip, toWebContainerFS, findRootPrefix, flattenFiles } from './utils/zipUtils';
import { useWebContainer } from './hooks/useWebContainer';
import { parseStackTrace } from './utils/errorReporter';
import { Play, FileArchive, RotateCcw, Zap, Sparkles, Database, Loader2, Wand2, CheckCircle, AlertTriangle } from 'lucide-react';

const API_URL = 'http://localhost:3001';
const MAX_FIX_ATTEMPTS = 15;

function App() {
    const [files, setFiles] = useState<FileNode[]>([]);
    const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [zipName, setZipName] = useState<string>('');
    const [isFixing, setIsFixing] = useState(false);
    const [fixCount, setFixCount] = useState(0);
    const [currentAction, setCurrentAction] = useState<string | null>(null);
    const [fixLog, setFixLog] = useState<string[]>([]);

    const fixingRef = useRef(false);
    const fixAttempts = useRef(0);
    const lastErrorRef = useRef<string>('');
    const filesRef = useRef<FileNode[]>([]);

    // Keep files ref in sync
    useEffect(() => {
        filesRef.current = files;
    }, [files]);

    const {
        isBooting,
        isInstalling,
        isRunning,
        previewUrl,
        error,
        terminalOutput,
        isPreWarmed,
        isPreWarming,
        mountFiles,
        startDevServer,
        updateFile,
        reset,
    } = useWebContainer();

    // Parse error from terminal output
    const parseError = useCallback((output: string[]): { file: string; error: string } | null => {
        const text = output.slice(-60).join('\n');

        // Check for various error patterns
        const patterns = [
            // Vite resolve error
            /Failed to resolve import ["']([^"']+)["'] from ["']([^"']+)["']/,
            // Module not found
            /Cannot find module ['"]([^'"]+)['"]/,
            // X is not defined
            /(\w+) is not defined/,
            // Syntax/Type errors
            /(SyntaxError|TypeError|ReferenceError):\s*(.+?)(?:\n|$)/,
        ];

        for (const pattern of patterns) {
            if (pattern.test(text)) {
                const fileMatch = text.match(/(?:src\/[\w\-\/]+\.tsx?)/);
                if (fileMatch) {
                    return { file: fileMatch[0], error: text.slice(-500) };
                }
            }
        }

        return null;
    }, []);

    // Fix code error using LLM
    const fixCodeError = useCallback(async (errorFile: string, errorText: string) => {
        if (fixingRef.current) return false;

        const errorKey = `${errorFile}:${errorText.slice(0, 50)}`;
        if (errorKey === lastErrorRef.current) return false;
        lastErrorRef.current = errorKey;

        fixingRef.current = true;
        setIsFixing(true);
        setCurrentAction(`Fixing: ${errorFile}`);
        fixAttempts.current++;

        try {
            const allFiles = flattenFiles(filesRef.current);

            let targetFile = allFiles.find(f =>
                f.path === errorFile ||
                f.path.endsWith(errorFile) ||
                f.path.includes(errorFile.replace('src/', ''))
            );

            if (!targetFile?.content) {
                const fileName = errorFile.split('/').pop();
                if (fileName) {
                    targetFile = allFiles.find(f => f.name === fileName);
                }
            }

            if (!targetFile?.content) {
                setFixLog(prev => [...prev, `❌ File not found: ${errorFile}`]);
                return false;
            }

            console.log(`🔧 Fixing code in: ${targetFile.path}`);
            setFixLog(prev => [...prev, `🔧 Fixing: ${targetFile.path}`]);

            const response = await fetch(`${API_URL}/api/fix-error`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: errorText,
                    filePath: targetFile.path,
                    fileContent: targetFile.content,
                }),
            });

            if (!response.ok) throw new Error('Backend failed');

            const { fixedCode } = await response.json();

            if (fixedCode && fixedCode !== targetFile.content) {
                await updateFile(targetFile.path, fixedCode);

                const updateFileInTree = (nodes: FileNode[]): FileNode[] => {
                    return nodes.map(node => {
                        if (node.path === targetFile!.path) {
                            return { ...node, content: fixedCode };
                        }
                        if (node.children) {
                            return { ...node, children: updateFileInTree(node.children) };
                        }
                        return node;
                    });
                };
                setFiles(updateFileInTree(filesRef.current));
                setFixCount(prev => prev + 1);
                setFixLog(prev => [...prev, `✅ Fixed: ${targetFile.path}`]);
                return true;
            }
        } catch (err) {
            console.error('Fix failed:', err);
            setFixLog(prev => [...prev, `❌ Error: ${err}`]);
        } finally {
            fixingRef.current = false;
            setIsFixing(false);
            setCurrentAction(null);
        }
        return false;
    }, [updateFile]);

    // Watch terminal and auto-fix
    useEffect(() => {
        if (!isRunning || fixingRef.current || isFixing) return;
        if (fixAttempts.current >= MAX_FIX_ATTEMPTS) return;

        const errorInfo = parseError(terminalOutput);
        if (errorInfo && errorInfo.file) {
            const timeoutId = setTimeout(() => {
                fixCodeError(errorInfo.file, errorInfo.error);
            }, 2000);

            return () => clearTimeout(timeoutId);
        }
    }, [terminalOutput, isRunning, isFixing, parseError, fixCodeError]);

    // Listen for runtime errors from preview iframe
    useEffect(() => {
        const handleRuntimeError = (event: MessageEvent) => {
            // Only process runtime error messages
            if (event.data?.type !== 'RUNTIME_ERROR') return;
            if (!isRunning || fixingRef.current || isFixing) return;
            if (fixAttempts.current >= MAX_FIX_ATTEMPTS) return;

            const { message, stack, errorType } = event.data;
            console.log('🔴 Runtime error received:', { message, stack, errorType });

            // Parse stack trace to find file
            const { filePath } = parseStackTrace(stack || '');

            if (filePath) {
                // Create error string with context
                const errorContext = `Runtime Error (${errorType})\n${message}\n\nStack trace:\n${stack}`;

                setFixLog(prev => [...prev, `🔴 Runtime Error in ${filePath}`]);

                // Trigger fix with a slight delay
                setTimeout(() => {
                    fixCodeError(filePath, errorContext);
                }, 1500);
            } else {
                console.warn('Could not extract file path from runtime error:', stack);
                setFixLog(prev => [...prev, `⚠️ Runtime error detected but file path not found`]);
            }
        };

        window.addEventListener('message', handleRuntimeError);
        return () => window.removeEventListener('message', handleRuntimeError);
    }, [isRunning, isFixing, fixCodeError]);


    const handleFileUpload = useCallback(async (file: File) => {
        setIsExtracting(true);
        setZipName(file.name);
        setFixCount(0);
        setFixLog([]);
        fixAttempts.current = 0;
        lastErrorRef.current = '';
        reset();

        try {
            const extracted = await extractZip(file);
            setFiles(extracted);
            filesRef.current = extracted;

            const allFiles = flattenFiles(extracted);
            if (allFiles.length > 0) {
                const mainFile = allFiles.find(f =>
                    f.name === 'App.tsx' || f.name === 'App.jsx'
                ) || allFiles[0];
                setSelectedFile(mainFile);
            }
        } catch (err) {
            console.error('Failed to extract ZIP:', err);
        } finally {
            setIsExtracting(false);
        }
    }, [reset]);

    const handleStartPreview = useCallback(async () => {
        if (files.length === 0) return;

        fixAttempts.current = 0;
        lastErrorRef.current = '';
        setFixLog([]);

        const prefix = findRootPrefix(files);
        const fsTree = toWebContainerFS(files, prefix);

        await mountFiles(fsTree);
        await startDevServer();
    }, [files, mountFiles, startDevServer]);

    const handleReset = useCallback(() => {
        setFiles([]);
        setSelectedFile(null);
        setZipName('');
        setFixCount(0);
        setFixLog([]);
        fixAttempts.current = 0;
        lastErrorRef.current = '';
        reset();
    }, [reset]);

    const handleSelectFile = useCallback((file: FileNode) => {
        if (file.type === 'file') {
            setSelectedFile(file);
        }
    }, []);

    const totalFiles = flattenFiles(files).length;
    const hasActiveError = terminalOutput.slice(-20).some(line =>
        line.includes('Failed to resolve') ||
        line.includes('Cannot find module') ||
        line.includes('is not defined') ||
        line.includes('Error')
    );

    return (
        <div className="h-screen w-screen bg-zinc-950 text-white flex flex-col overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-900/95 border-b border-zinc-800/80">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl blur-lg opacity-50"></div>
                        <div className="relative p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                            <Zap className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                            Preview Testing
                        </h1>
                        <p className="text-xs text-zinc-500 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            WebContainers + AI Auto-Fix
                        </p>
                    </div>

                    {isPreWarming && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Installing base packages...
                        </div>
                    )}

                    {isPreWarmed && !isPreWarming && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Database className="w-3.5 h-3.5" />
                            Ready
                        </div>
                    )}

                    {isFixing && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 animate-pulse">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            {currentAction || 'AI Fixing...'}
                        </div>
                    )}

                    {hasActiveError && !isFixing && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Error detected
                        </div>
                    )}

                    {fixCount > 0 && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle className="w-3.5 h-3.5" />
                            {fixCount} fixed
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    {zipName && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-zinc-800/80 rounded-xl border border-zinc-700/50">
                            <FileArchive className="w-4 h-4 text-emerald-400" />
                            <span className="text-sm text-zinc-300 font-medium">{zipName}</span>
                            <span className="px-2 py-0.5 text-xs text-emerald-400 bg-emerald-500/10 rounded-full">
                                {totalFiles} files
                            </span>
                        </div>
                    )}

                    {files.length > 0 && !isRunning && (
                        <button
                            onClick={handleStartPreview}
                            disabled={isBooting || isInstalling}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-zinc-400 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-emerald-500/25"
                        >
                            <Play className="w-4 h-4" />
                            {isBooting ? 'Booting...' : isInstalling ? 'Installing...' : 'Start Preview'}
                        </button>
                    )}

                    {files.length > 0 && (
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-xl transition-all border border-zinc-700/50"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Reset
                        </button>
                    )}
                </div>
            </header>

            {/* Fix activity log */}
            {fixLog.length > 0 && (
                <div className="px-6 py-2 bg-zinc-900/80 border-b border-zinc-800/50 overflow-x-auto">
                    <div className="flex items-center gap-3 text-xs">
                        <Wand2 className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        <div className="flex gap-3 overflow-x-auto">
                            {fixLog.slice(-6).map((log, i) => (
                                <span key={i} className={`whitespace-nowrap ${log.includes('✅') ? 'text-emerald-400' :
                                    log.includes('❌') ? 'text-red-400' : 'text-zinc-400'
                                    }`}>
                                    {log}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Main content */}
            <div className="flex-1 flex overflow-hidden">
                {files.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center p-8 bg-gradient-to-b from-zinc-950 to-zinc-900">
                        <div className="w-full max-w-xl">
                            <ZipUpload onUpload={handleFileUpload} isLoading={isExtracting} />
                            <div className="mt-8 text-center">
                                <p className="text-zinc-400 text-lg">
                                    Upload a React project ZIP file
                                </p>
                                <p className="text-zinc-600 text-sm mt-2">
                                    Start Preview → Errors detected → AI auto-fixes → Preview updates
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="w-72 flex-shrink-0 bg-zinc-900/95 border-r border-zinc-800 flex flex-col">
                            <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-900">
                                <h2 className="text-sm font-semibold text-zinc-300">Explorer</h2>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <FileExplorer
                                    files={files}
                                    selectedFile={selectedFile?.path || null}
                                    onSelectFile={handleSelectFile}
                                />
                            </div>
                        </div>

                        <div className="flex-1 border-r border-zinc-800 min-w-0">
                            <CodeEditor file={selectedFile} />
                        </div>

                        <div className="w-[45%] flex-shrink-0">
                            <WebContainerPreview
                                previewUrl={previewUrl}
                                isBooting={isBooting}
                                isInstalling={isInstalling}
                                isRunning={isRunning}
                                error={error}
                                terminalOutput={terminalOutput}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default App;
