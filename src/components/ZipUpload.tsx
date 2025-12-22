import { useCallback, useState } from 'react';
import { Upload, FileArchive, Loader2 } from 'lucide-react';

interface ZipUploadProps {
    onUpload: (file: File) => void;
    isLoading?: boolean;
}

export const ZipUpload = ({ onUpload, isLoading }: ZipUploadProps) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        const zipFile = files.find(f => f.name.endsWith('.zip'));

        if (zipFile) {
            onUpload(zipFile);
        }
    }, [onUpload]);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onUpload(file);
        }
    }, [onUpload]);

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
        relative flex flex-col items-center justify-center
        w-full h-72 rounded-2xl border-2 border-dashed
        transition-all duration-300 cursor-pointer
        backdrop-blur-sm
        ${isDragging
                    ? 'border-emerald-400 bg-emerald-500/10 scale-[1.02] shadow-lg shadow-emerald-500/20'
                    : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-500 hover:bg-zinc-800/50'
                }
        ${isLoading ? 'pointer-events-none opacity-75' : ''}
      `}
        >
            <input
                type="file"
                accept=".zip"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isLoading}
            />

            <div className="flex flex-col items-center gap-5 pointer-events-none">
                {isLoading ? (
                    <>
                        <div className="p-5 rounded-full bg-emerald-500/20">
                            <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" />
                        </div>
                        <div className="text-center">
                            <p className="text-xl font-semibold text-zinc-200">Extracting ZIP...</p>
                            <p className="text-sm text-zinc-500 mt-2">Please wait</p>
                        </div>
                    </>
                ) : (
                    <>
                        <div className={`
              p-5 rounded-full transition-all duration-300
              ${isDragging
                                ? 'bg-emerald-500/20 scale-110'
                                : 'bg-gradient-to-br from-zinc-800 to-zinc-900'
                            }
            `}>
                            {isDragging ? (
                                <FileArchive className="w-12 h-12 text-emerald-400" />
                            ) : (
                                <Upload className="w-12 h-12 text-zinc-400" />
                            )}
                        </div>
                        <div className="text-center">
                            <p className="text-xl font-semibold text-zinc-200">
                                {isDragging ? 'Drop ZIP file here' : 'Upload ZIP file'}
                            </p>
                            <p className="text-sm text-zinc-500 mt-2">
                                Drag and drop or click to browse
                            </p>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-800/50 border border-zinc-700">
                            <FileArchive className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs text-zinc-400">Supports .zip files</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
