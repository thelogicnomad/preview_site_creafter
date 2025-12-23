import { useState, useCallback, useRef, useEffect } from 'react';
import { WebContainer } from '@webcontainer/api';
import type { FileSystemTree } from '@webcontainer/api';
import { getErrorReporterScript } from '../utils/errorReporter';

interface UseWebContainerReturn {
    isBooting: boolean;
    isInstalling: boolean;
    isRunning: boolean;
    previewUrl: string | null;
    error: string | null;
    terminalOutput: string[];
    isPreWarmed: boolean;
    isPreWarming: boolean;
    mountFiles: (files: FileSystemTree) => Promise<void>;
    startDevServer: () => Promise<void>;
    updateFile: (path: string, content: string) => Promise<void>;
    reset: () => void;
}

// Singleton WebContainer instance
let webcontainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;
let preWarmPromise: Promise<void> | null = null;
let isPreWarmedFlag = false;

// Base package.json with 16 common dependencies
const BASE_PACKAGE_JSON = {
    name: 'preview-project',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: {
        dev: 'vite --host',
        build: 'vite build',
    },
    dependencies: {
        // Core React
        'react': '^18.3.1',
        'react-dom': '^18.3.1',
        // Routing
        'react-router-dom': '^7.1.1',
        // Animation
        'framer-motion': '^11.14.4',
        // Icons
        'lucide-react': '^0.460.0',
        // Styling utilities
        'clsx': '^2.1.1',
        'tailwind-merge': '^2.5.5',
        'class-variance-authority': '^0.7.1',
        // HTTP
        'axios': '^1.7.9',
        // State management
        'zustand': '^5.0.2',
        // Date utilities
        'date-fns': '^4.1.0',
    },
    devDependencies: {
        // Vite & React plugin
        '@vitejs/plugin-react': '^4.3.4',
        'vite': '^6.0.3',
        // TypeScript
        'typescript': '^5.7.2',
        '@types/react': '^18.3.12',
        '@types/react-dom': '^18.3.1',
        // Tailwind CSS
        'tailwindcss': '^3.4.17',
        'postcss': '^8.4.49',
        'autoprefixer': '^10.4.20',
    },
};

const BASE_FILES: FileSystemTree = {
    'package.json': {
        file: { contents: JSON.stringify(BASE_PACKAGE_JSON, null, 2) },
    },
    'vite.config.ts': {
        file: {
            contents: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()] })`,
        },
    },
    'index.html': {
        file: {
            contents: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
        },
    },
    'tailwind.config.js': {
        file: {
            contents: `export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
}`,
        },
    },
    'postcss.config.js': {
        file: {
            contents: `export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
}`,
        },
    },
    'src': {
        directory: {
            'main.tsx': {
                file: {
                    contents: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)`,
                },
            },
            'App.tsx': {
                file: { contents: `export default function App() { return <div className="p-4 text-white bg-zinc-900 min-h-screen">Loading...</div> }` },
            },
            'index.css': {
                file: { contents: `@tailwind base;\n@tailwind components;\n@tailwind utilities;` },
            },
        },
    },
};

export function useWebContainer(): UseWebContainerReturn {
    const [isBooting, setIsBooting] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
    const [isPreWarmed, setIsPreWarmed] = useState(false);
    const [isPreWarming, setIsPreWarming] = useState(false);

    const processRef = useRef<any>(null);

    const appendOutput = useCallback((line: string) => {
        if (line.includes('[0K') || line.includes('[1G') || line.trim().length < 2) return;
        setTerminalOutput(prev => [...prev.slice(-100), line]);
    }, []);

    // Boot WebContainer (singleton)
    const boot = useCallback(async (): Promise<WebContainer> => {
        if (webcontainerInstance) return webcontainerInstance;
        if (bootPromise) return bootPromise;

        bootPromise = (async () => {
            setIsBooting(true);
            setError(null);
            appendOutput('⚡ Booting WebContainer...');

            try {
                const instance = await WebContainer.boot();
                webcontainerInstance = instance;

                instance.on('server-ready', (_port, url) => {
                    appendOutput(`🚀 Server ready at ${url}`);
                    setPreviewUrl(url);
                    setIsRunning(true);
                    setIsInstalling(false);
                });

                appendOutput('✅ WebContainer booted');
                setIsBooting(false);
                return instance;
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Failed to boot';
                setError(message);
                appendOutput(`❌ Error: ${message}`);
                setIsBooting(false);
                bootPromise = null;
                throw err;
            }
        })();

        return bootPromise;
    }, [appendOutput]);

    // Pre-warm: Install base 16 packages on page load
    const preWarm = useCallback(async () => {
        if (isPreWarmedFlag || preWarmPromise) return preWarmPromise;

        preWarmPromise = (async () => {
            setIsPreWarming(true);

            try {
                const instance = await boot();
                appendOutput('📦 Installing 16 base packages...');
                appendOutput('⏳ This runs once on page load (~2-3 min)...');

                await instance.mount(BASE_FILES);

                const installProcess = await instance.spawn('npm', [
                    'install', '--prefer-offline', '--no-audit', '--no-fund', '--legacy-peer-deps',
                ]);

                installProcess.output.pipeTo(new WritableStream({
                    write(data) {
                        data.split('\n').filter(Boolean).forEach(line => appendOutput(line));
                    }
                }));

                const exitCode = await installProcess.exit;
                if (exitCode !== 0) throw new Error('npm install failed');

                isPreWarmedFlag = true;
                setIsPreWarmed(true);
                appendOutput('✅ Base packages installed! Ready for projects.');

            } catch (err) {
                appendOutput(`⚠️ Pre-warm error: ${err}`);
            } finally {
                setIsPreWarming(false);
            }
        })();

        return preWarmPromise;
    }, [boot, appendOutput]);

    // Pre-warm on page load
    useEffect(() => { preWarm(); }, []);

    const mountFiles = useCallback(async (files: FileSystemTree) => {
        try {
            const instance = await boot();
            if (preWarmPromise && !isPreWarmedFlag) {
                appendOutput('⏳ Waiting for base setup...');
                await preWarmPromise;
            }
            appendOutput('📁 Mounting project files...');

            // Inject error reporter into index.html
            if (files['index.html']) {
                const indexHtmlEntry = files['index.html'];
                if ('file' in indexHtmlEntry && indexHtmlEntry.file && 'contents' in indexHtmlEntry.file) {
                    const originalHtml = indexHtmlEntry.file.contents;
                    const errorReporter = getErrorReporterScript();

                    // Inject error reporter after <head> tag
                    const modifiedHtml = typeof originalHtml === 'string'
                        ? originalHtml.replace('</head>', `  ${errorReporter}\n  </head>`)
                        : originalHtml;

                    files['index.html'] = {
                        file: { contents: modifiedHtml }
                    };

                    appendOutput('🔍 Error reporter injected');
                }
            }

            await instance.mount(files);
            appendOutput('✅ Files mounted');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Mount failed';
            setError(message);
            throw err;
        }
    }, [boot, appendOutput]);

    const startDevServer = useCallback(async () => {
        try {
            const instance = await boot();

            if (processRef.current) processRef.current.kill();

            setPreviewUrl(null);
            setIsInstalling(true);

            // Run npm install to get any additional packages from user's project
            appendOutput('⚡ Installing project dependencies...');

            const installProcess = await instance.spawn('npm', [
                'install', '--prefer-offline', '--no-audit', '--no-fund', '--legacy-peer-deps',
            ]);

            installProcess.output.pipeTo(new WritableStream({
                write(data) {
                    data.split('\n').filter(Boolean).forEach(line => appendOutput(line));
                }
            }));

            await installProcess.exit;
            appendOutput('✅ Dependencies ready');
            appendOutput('🚀 Starting dev server...');

            const devProcess = await instance.spawn('npm', ['run', 'dev']);
            processRef.current = devProcess;

            devProcess.output.pipeTo(new WritableStream({
                write(data) {
                    data.split('\n').filter(Boolean).forEach(line => appendOutput(line));
                }
            }));

        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to start';
            setError(message);
            setIsInstalling(false);
        }
    }, [boot, appendOutput]);

    const updateFile = useCallback(async (path: string, content: string) => {
        try {
            const instance = await boot();
            await instance.fs.writeFile(path, content);
            appendOutput(`✏️ Updated: ${path}`);
        } catch (err) {
            appendOutput(`❌ Failed to update ${path}: ${err}`);
        }
    }, [boot, appendOutput]);

    const reset = useCallback(() => {
        if (processRef.current) {
            processRef.current.kill();
            processRef.current = null;
        }
        setPreviewUrl(null);
        setIsRunning(false);
        setIsInstalling(false);
        setError(null);
        setTerminalOutput([]);
    }, []);

    useEffect(() => {
        return () => { if (processRef.current) processRef.current.kill(); };
    }, []);

    return {
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
    };
}
