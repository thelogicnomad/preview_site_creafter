/**
 * Preview Testing Server
 * Node.js backend with Gemini LLM for error fixing
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
const PORT = 3001;

// Request counter for logging
let requestId = 0;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-lite-preview-09-2025',
});

// Logger utility
function log(id, type, message, data = null) {
    const timestamp = new Date().toISOString();
    const prefix = {
        'START': '🔵',
        'INFO': '📋',
        'SUCCESS': '✅',
        'ERROR': '❌',
        'PROMPT': '📝',
        'RESPONSE': '📤',
    }[type] || '•';

    console.log(`[${timestamp}] [REQ-${id}] ${prefix} ${message}`);
    if (data) {
        if (typeof data === 'string') {
            // Truncate long strings
            const truncated = data.length > 500 ? data.slice(0, 500) + '...' : data;
            console.log(`    └─ ${truncated}`);
        } else {
            console.log(`    └─`, JSON.stringify(data, null, 2).slice(0, 500));
        }
    }
}

/**
 * POST /api/fix-error
 * Receives error details and code, returns fixed code using Gemini
 */
app.post('/api/fix-error', async (req, res) => {
    const id = ++requestId;
    const startTime = Date.now();

    try {
        const { error, filePath, fileContent } = req.body;

        log(id, 'START', `=== FIX ERROR REQUEST ===`);
        log(id, 'INFO', `File: ${filePath}`);
        log(id, 'INFO', `File size: ${fileContent?.length || 0} chars`);
        log(id, 'INFO', `Error message:`, error?.slice(0, 300));

        if (!error || !filePath || !fileContent) {
            log(id, 'ERROR', 'Missing required fields');
            return res.status(400).json({
                error: 'Missing required fields: error, filePath, fileContent'
            });
        }

        // Detect if this is a runtime error
        const isRuntimeError = error.includes('Runtime Error') ||
            error.includes('RUNTIME_ERROR') ||
            error.includes('error boundary') ||
            error.includes('The above error occurred');

        const prompt = isRuntimeError
            ? `You are an expert React/TypeScript developer. Fix the following RUNTIME ERROR in this code.

## Runtime Error Details:
\`\`\`
${error}
\`\`\`

## File: ${filePath}
\`\`\`tsx
${fileContent}
\`\`\`

## Instructions for Runtime Errors:
1. This is a RUNTIME error that occurred in the browser, not a build error
2. Common runtime errors include:
   - Accessing properties of undefined/null (cannot read property 'x' of undefined)
   - React component errors (hooks, render errors)
   - Unhandled promise rejections
   - Type errors (undefined is not a function)
3. Look for:
   - Missing null/undefined checks
   - Incorrect hook usage (hooks called conditionally)
   - Accessing array/object properties without validation
   - Missing optional chaining (?.)
   - Async errors without try-catch
4. Fix the code to prevent the runtime error
5. Add defensive programming (null checks, optional chaining, fallbacks)
6. Keep all existing functionality
7. Return ONLY the complete fixed code
8. Do NOT include markdown code fences or explanations
9. The response should be valid TypeScript/React code

## Fixed Code:`
            : `You are an expert React/TypeScript developer. Fix the following error in this code.

## Error Message:
\`\`\`
${error}
\`\`\`

## File: ${filePath}
\`\`\`tsx
${fileContent}
\`\`\`

## Instructions:
1. Analyze the error carefully
2. Fix the code to resolve the error
3. Keep all existing functionality
4. Return ONLY the complete fixed code
5. Do NOT include markdown code fences or explanations
6. The response should be valid TypeScript/React code that can be saved directly to a file

## Fixed Code:`;

        log(id, 'PROMPT', `Sending to Gemini (${prompt.length} chars)`);

        const result = await model.generateContent(prompt);
        const response = result.response;
        let fixedCode = response.text().trim();

        log(id, 'RESPONSE', `Received from Gemini (${fixedCode.length} chars)`);

        // Clean up response - remove markdown fences if present
        if (fixedCode.startsWith('```')) {
            const lines = fixedCode.split('\n');
            lines.shift(); // Remove opening fence
            if (lines[lines.length - 1] === '```') {
                lines.pop(); // Remove closing fence
            }
            fixedCode = lines.join('\n');
            log(id, 'INFO', 'Cleaned markdown fences from response');
        }

        const duration = Date.now() - startTime;
        log(id, 'SUCCESS', `Fix generated in ${duration}ms`);
        log(id, 'INFO', `Fixed code preview:`, fixedCode.slice(0, 200));
        console.log(`[REQ-${id}] === END FIX ERROR ===\n`);

        res.json({
            fixedCode,
            filePath,
            success: true,
            duration,
        });

    } catch (err) {
        const duration = Date.now() - startTime;
        log(id, 'ERROR', `Fix failed after ${duration}ms: ${err.message}`);
        console.log(`[REQ-${id}] === END FIX ERROR (FAILED) ===\n`);

        res.status(500).json({
            error: err instanceof Error ? err.message : 'Unknown error',
            success: false,
        });
    }
});

/**
 * POST /api/analyze-code
 * Analyze code for potential issues before running
 */
app.post('/api/analyze-code', async (req, res) => {
    const id = ++requestId;
    const startTime = Date.now();

    try {
        const { files } = req.body; // Array of { path, content }

        log(id, 'START', `=== ANALYZE CODE REQUEST ===`);
        log(id, 'INFO', `Files to analyze: ${files?.length || 0}`);

        if (!files || !Array.isArray(files)) {
            log(id, 'ERROR', 'Missing files array');
            return res.status(400).json({ error: 'Missing files array' });
        }

        // Log each file being analyzed
        files.slice(0, 10).forEach((f, i) => {
            log(id, 'INFO', `  [${i + 1}] ${f.path} (${f.content?.length || 0} chars)`);
        });

        const filesContent = files
            .slice(0, 10) // Limit to first 10 files
            .map(f => `### ${f.path}\n\`\`\`tsx\n${f.content}\n\`\`\``)
            .join('\n\n');

        const prompt = `You are an expert React/TypeScript developer. Analyze these files for potential issues.

${filesContent}

## Instructions:
1. Look for syntax errors, missing imports, type errors
2. Check for common React patterns issues
3. Return a JSON array of issues found, or empty array if none

## Response format (JSON only):
[
  { "file": "path/to/file.tsx", "line": 10, "issue": "Description of issue", "severity": "error|warning" }
]`;

        log(id, 'PROMPT', `Sending to Gemini (${prompt.length} chars)`);

        const result = await model.generateContent(prompt);
        let responseText = result.response.text().trim();

        log(id, 'RESPONSE', `Received from Gemini (${responseText.length} chars)`);

        // Clean up JSON response
        if (responseText.startsWith('```')) {
            responseText = responseText.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
            log(id, 'INFO', 'Cleaned markdown fences from response');
        }

        const issues = JSON.parse(responseText);

        const duration = Date.now() - startTime;
        log(id, 'SUCCESS', `Analysis complete in ${duration}ms`);
        log(id, 'INFO', `Issues found: ${issues.length}`);

        // Log each issue
        issues.forEach((issue, i) => {
            log(id, 'INFO', `  [${i + 1}] ${issue.severity.toUpperCase()}: ${issue.file}:${issue.line} - ${issue.issue}`);
        });

        console.log(`[REQ-${id}] === END ANALYZE CODE ===\n`);

        res.json({ issues, success: true, duration });

    } catch (err) {
        const duration = Date.now() - startTime;
        log(id, 'ERROR', `Analysis failed after ${duration}ms: ${err.message}`);
        console.log(`[REQ-${id}] === END ANALYZE CODE (FAILED) ===\n`);

        res.status(500).json({
            error: err instanceof Error ? err.message : 'Analysis failed',
            issues: [],
            success: false,
        });
    }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    console.log(`[${new Date().toISOString()}] Health check`);
    res.json({
        status: 'ok',
        model: 'gemini-2.0-flash-lite',
        timestamp: new Date().toISOString(),
        requestCount: requestId,
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🚀 Preview Testing Server`);
    console.log(`${'='.repeat(50)}`);
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📦 Model: gemini-2.0-flash-lite`);
    console.log(`\nEndpoints:`);
    console.log(`  POST /api/fix-error     - Fix code errors with LLM`);
    console.log(`  POST /api/analyze-code  - Analyze code for issues`);
    console.log(`  GET  /api/health        - Health check`);
    console.log(`${'='.repeat(50)}\n`);
});
