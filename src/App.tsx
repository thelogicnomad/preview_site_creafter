import { useState, useCallback } from 'react';
import { ZipUpload } from './components/ZipUpload';
import { FileExplorer } from './components/FileExplorer';
import { CodeEditor } from './components/CodeEditor';
import { WebContainerPreview } from './components/WebContainerPreview';
import type { FileNode } from './utils/fileUtils';
import { extractZip, toWebContainerFS, findRootPrefix, flattenFiles } from './utils/zipUtils';
import { useWebContainer } from './hooks/useWebContainer';
import { Play, FileArchive, RotateCcw, Zap, Sparkles, Database, Loader2 } from 'lucide-react';

function App() {
    const [files, setFiles] = useState<FileNode[]>([]);
    const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [zipName, setZipName] = useState<string>('');

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
        reset,
    } = useWebContainer();

    const handleFileUpload = useCallback(async (file: File) => {
        setIsExtracting(true);
        setZipName(file.name);
        reset();

        try {
            const extracted = await extractZip(file);
            setFiles(extracted);

            const allFiles = flattenFiles(extracted);
            if (allFiles.length > 0) {
                const mainFile = allFiles.find(f =>
                    f.name === 'App.tsx' || f.name === 'App.jsx' ||
                    f.name === 'index.tsx' || f.name === 'index.jsx'
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

        const prefix = findRootPrefix(files);
        const fsTree = toWebContainerFS(files, prefix);

        await mountFiles(fsTree);
        await startDevServer();
    }, [files, mountFiles, startDevServer]);

    const handleReset = useCallback(() => {
        setFiles([]);
        setSelectedFile(null);
        setZipName('');
        reset();
    }, [reset]);

    const handleSelectFile = useCallback((file: FileNode) => {
        if (file.type === 'file') {
            setSelectedFile(file);
        }
    }, []);

    const totalFiles = flattenFiles(files).length;

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
                            WebContainers
                        </p>
                    </div>

                    {/* Status badge */}
                    {isPreWarming ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Installing 16 base packages...
                        </div>
                    ) : isPreWarmed ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Database className="w-3.5 h-3.5" />
                            Ready - Fast Load!
                        </div>
                    ) : null}
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
                                    Upload → Start Preview → See your app!
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
