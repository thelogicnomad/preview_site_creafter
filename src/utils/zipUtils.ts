import JSZip from 'jszip';
import type { FileNode } from './fileUtils';
import type { FileSystemTree } from '@webcontainer/api';

// Extract ZIP file and return file tree structure
export async function extractZip(file: File): Promise<FileNode[]> {
    const zip = await JSZip.loadAsync(file);
    const fileTree: FileNode[] = [];
    const pathMap = new Map<string, FileNode>();

    // Get all file paths and sort them
    const paths = Object.keys(zip.files).sort();

    for (const path of paths) {
        const zipEntry = zip.files[path];

        // Skip __MACOSX and other hidden files
        if (path.startsWith('__MACOSX') || path.includes('/.')) {
            continue;
        }

        // Remove trailing slash for directories
        const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
        if (!cleanPath) continue;

        const parts = cleanPath.split('/');
        const name = parts[parts.length - 1];
        const parentPath = parts.slice(0, -1).join('/');

        if (zipEntry.dir) {
            const dirNode: FileNode = {
                name,
                path: cleanPath,
                type: 'directory',
                children: [],
            };
            pathMap.set(cleanPath, dirNode);

            if (parentPath && pathMap.has(parentPath)) {
                pathMap.get(parentPath)!.children!.push(dirNode);
            } else if (!parentPath) {
                fileTree.push(dirNode);
            }
        } else {
            const content = await zipEntry.async('string');
            const fileNode: FileNode = {
                name,
                path: cleanPath,
                type: 'file',
                content,
            };

            if (parentPath && pathMap.has(parentPath)) {
                pathMap.get(parentPath)!.children!.push(fileNode);
            } else if (!parentPath) {
                fileTree.push(fileNode);
            } else {
                // Create missing parent directories
                let currentPath = '';
                for (let i = 0; i < parts.length - 1; i++) {
                    const part = parts[i];
                    const newPath = currentPath ? `${currentPath}/${part}` : part;

                    if (!pathMap.has(newPath)) {
                        const dirNode: FileNode = {
                            name: part,
                            path: newPath,
                            type: 'directory',
                            children: [],
                        };
                        pathMap.set(newPath, dirNode);

                        if (currentPath && pathMap.has(currentPath)) {
                            pathMap.get(currentPath)!.children!.push(dirNode);
                        } else if (!currentPath) {
                            fileTree.push(dirNode);
                        }
                    }
                    currentPath = newPath;
                }

                if (pathMap.has(parentPath)) {
                    pathMap.get(parentPath)!.children!.push(fileNode);
                }
            }
        }
    }

    return fileTree;
}

// Convert FileNode tree to WebContainer FileSystemTree format
export function toWebContainerFS(files: FileNode[], stripPrefix?: string): FileSystemTree {
    const fsTree: FileSystemTree = {};

    function processNode(node: FileNode): void {
        // Strip prefix from path if provided (e.g., "project-name/")
        let path = node.path;
        if (stripPrefix && path.startsWith(stripPrefix)) {
            path = path.slice(stripPrefix.length);
        }
        if (!path) return;

        const parts = path.split('/');
        let current = fsTree;

        for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            if (!current[part]) {
                current[part] = { directory: {} };
            }
            const entry = current[part];
            if ('directory' in entry) {
                current = entry.directory;
            }
        }

        const name = parts[parts.length - 1];
        if (node.type === 'directory') {
            if (!current[name]) {
                current[name] = { directory: {} };
            }
        } else {
            current[name] = {
                file: {
                    contents: node.content || '',
                },
            };
        }
    }

    function traverse(nodes: FileNode[]): void {
        for (const node of nodes) {
            processNode(node);
            if (node.children) {
                traverse(node.children);
            }
        }
    }

    traverse(files);
    return fsTree;
}

// Find the root prefix if files are nested (e.g., "project-name/src/...")
export function findRootPrefix(files: FileNode[]): string | undefined {
    if (files.length === 1 && files[0].type === 'directory') {
        return files[0].path + '/';
    }
    return undefined;
}

// Flatten file tree to get all files
export function flattenFiles(files: FileNode[]): FileNode[] {
    const result: FileNode[] = [];

    function traverse(nodes: FileNode[]): void {
        for (const node of nodes) {
            if (node.type === 'file') {
                result.push(node);
            }
            if (node.children) {
                traverse(node.children);
            }
        }
    }

    traverse(files);
    return result;
}
