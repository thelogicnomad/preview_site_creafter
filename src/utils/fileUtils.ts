// Types for file system
export interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    content?: string;
    children?: FileNode[];
}

// Get language for Monaco Editor based on file extension
export const getLanguage = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
        tsx: 'typescript',
        ts: 'typescript',
        jsx: 'javascript',
        js: 'javascript',
        css: 'css',
        html: 'html',
        json: 'json',
        md: 'markdown',
        svg: 'xml',
        yaml: 'yaml',
        yml: 'yaml',
    };
    return languageMap[ext || ''] || 'plaintext';
};

// Get file icon color based on extension
export const getFileColor = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    const colorMap: Record<string, string> = {
        tsx: '#3178c6',
        ts: '#3178c6',
        jsx: '#f7df1e',
        js: '#f7df1e',
        css: '#264de4',
        html: '#e34c26',
        json: '#cbcb41',
        md: '#083fa1',
        svg: '#ffb13b',
    };
    return colorMap[ext || ''] || '#6b7280';
};
