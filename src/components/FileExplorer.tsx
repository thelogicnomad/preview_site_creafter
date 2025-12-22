import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';
import type { FileNode } from '../utils/fileUtils';
import { getFileColor } from '../utils/fileUtils';

interface FileExplorerProps {
    files: FileNode[];
    selectedFile: string | null;
    onSelectFile: (file: FileNode) => void;
}

interface FileTreeItemProps {
    node: FileNode;
    depth: number;
    selectedFile: string | null;
    onSelectFile: (file: FileNode) => void;
    expandedFolders: Set<string>;
    toggleFolder: (path: string) => void;
}

const FileTreeItem = ({
    node,
    depth,
    selectedFile,
    onSelectFile,
    expandedFolders,
    toggleFolder,
}: FileTreeItemProps) => {
    const isFolder = node.type === 'directory';
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFile === node.path;

    const handleClick = () => {
        if (isFolder) {
            toggleFolder(node.path);
        } else {
            onSelectFile(node);
        }
    };

    return (
        <div>
            <div
                onClick={handleClick}
                className={`
          flex items-center gap-2 px-3 py-1.5 cursor-pointer
          transition-all duration-150 text-sm group
          ${isSelected
                        ? 'bg-emerald-500/15 text-emerald-300 border-l-2 border-emerald-400'
                        : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 border-l-2 border-transparent'
                    }
        `}
                style={{ paddingLeft: `${depth * 16 + 12}px` }}
            >
                {isFolder ? (
                    <>
                        <span className="text-zinc-500 transition-transform duration-200">
                            {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                            ) : (
                                <ChevronRight className="w-4 h-4" />
                            )}
                        </span>
                        {isExpanded ? (
                            <FolderOpen className="w-4 h-4 text-amber-400" />
                        ) : (
                            <Folder className="w-4 h-4 text-amber-500/80" />
                        )}
                    </>
                ) : (
                    <>
                        <span className="w-4" />
                        <File
                            className="w-4 h-4 flex-shrink-0"
                            style={{ color: getFileColor(node.path) }}
                        />
                    </>
                )}
                <span className="truncate font-medium">{node.name}</span>
            </div>

            {isFolder && isExpanded && node.children && (
                <div>
                    {node.children
                        .sort((a, b) => {
                            if (a.type === b.type) return a.name.localeCompare(b.name);
                            return a.type === 'directory' ? -1 : 1;
                        })
                        .map((child) => (
                            <FileTreeItem
                                key={child.path}
                                node={child}
                                depth={depth + 1}
                                selectedFile={selectedFile}
                                onSelectFile={onSelectFile}
                                expandedFolders={expandedFolders}
                                toggleFolder={toggleFolder}
                            />
                        ))}
                </div>
            )}
        </div>
    );
};

export const FileExplorer = ({
    files,
    selectedFile,
    onSelectFile,
}: FileExplorerProps) => {
    // Auto-expand first level folders
    const initialExpanded = useMemo(() => {
        const expanded = new Set<string>();
        files.forEach(f => {
            if (f.type === 'directory') {
                expanded.add(f.path);
                f.children?.forEach(child => {
                    if (child.type === 'directory' && ['src', 'components', 'pages'].includes(child.name)) {
                        expanded.add(child.path);
                    }
                });
            }
        });
        return expanded;
    }, [files]);

    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(initialExpanded);

    const toggleFolder = (path: string) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    };

    if (files.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="p-4 rounded-full bg-zinc-800/50 mb-4">
                    <Folder className="w-10 h-10 text-zinc-600" />
                </div>
                <p className="text-zinc-400 font-medium">No files loaded</p>
                <p className="text-zinc-600 text-sm mt-1">Upload a ZIP file to view files</p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto py-2 scrollbar-thin">
            {files
                .sort((a, b) => {
                    if (a.type === b.type) return a.name.localeCompare(b.name);
                    return a.type === 'directory' ? -1 : 1;
                })
                .map((node) => (
                    <FileTreeItem
                        key={node.path}
                        node={node}
                        depth={0}
                        selectedFile={selectedFile}
                        onSelectFile={onSelectFile}
                        expandedFolders={expandedFolders}
                        toggleFolder={toggleFolder}
                    />
                ))}
        </div>
    );
};
