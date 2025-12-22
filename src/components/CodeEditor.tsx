import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { FileCode, Copy, Check, Code2 } from 'lucide-react';
import type { FileNode } from '../utils/fileUtils';
import { getLanguage } from '../utils/fileUtils';

interface CodeEditorProps {
    file: FileNode | null;
}

export const CodeEditor = ({ file }: CodeEditorProps) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (file?.content) {
            navigator.clipboard.writeText(file.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (!file) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center bg-zinc-950">
                <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 mb-6">
                    <Code2 className="w-14 h-14 text-zinc-700" />
                </div>
                <p className="text-zinc-400 text-lg font-medium">No file selected</p>
                <p className="text-zinc-600 text-sm mt-2 max-w-xs">
                    Select a file from the explorer to view its contents
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-zinc-950">
            {/* File header */}
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-blue-500/10">
                        <FileCode className="w-4 h-4 text-blue-400" />
                    </div>
                    <span className="text-sm text-zinc-300 font-mono font-medium">{file.path}</span>
                    <span className="px-2 py-0.5 text-xs text-zinc-500 bg-zinc-800 rounded-md uppercase">
                        {getLanguage(file.path)}
                    </span>
                </div>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-sm"
                    title="Copy code"
                >
                    {copied ? (
                        <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy className="w-4 h-4 text-zinc-500" />
                            <span className="text-zinc-400">Copy</span>
                        </>
                    )}
                </button>
            </div>

            {/* Editor */}
            <div className="flex-1">
                <Editor
                    height="100%"
                    language={getLanguage(file.path)}
                    value={file.content || ''}
                    theme="vs-dark"
                    options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 14,
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        automaticLayout: true,
                        padding: { top: 16, bottom: 16 },
                        fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
                        fontLigatures: true,
                        renderLineHighlight: 'all',
                        cursorBlinking: 'smooth',
                    }}
                />
            </div>
        </div>
    );
};
