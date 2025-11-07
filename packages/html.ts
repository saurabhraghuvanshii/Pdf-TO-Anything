import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

async function testDoclingToHtml(pdfPath: string): Promise<string> {
    console.log('\n=== Testing Docling (HTML) ===');
    const startTime = Date.now();

    try {
        try {
            await execAsync('python -c "import docling"');
        } catch {
            console.error('Docling not installed. Install with: pip install docling');
            throw new Error('Docling not installed');
        }

        const pythonScript = `
import sys
import re
from docling.document_converter import DocumentConverter

pdf_path = sys.argv[1]
converter = DocumentConverter()
result = converter.convert(pdf_path)
html = result.document.export_to_html()

# Clean up debug output at the start if any
lines = html.split('\\n')
cleaned_lines = []

for line in lines:
    # Skip debug lines like "len(pages)=1, 0-0" or "len(valid_pages)=1"
    if re.match(r'^len\\([^)]+\\)=', line.strip()):
        continue
    # Skip lines that look like debug output (e.g., "0-0" or "1, 2-3")
    if re.match(r'^\\d+(-\\d+)?(,\\s*\\d+(-\\d+)?)*\\s*$', line.strip()):
        continue
    cleaned_lines.append(line)

# Remove leading empty lines
while cleaned_lines and not cleaned_lines[0].strip():
    cleaned_lines.pop(0)

html = '\\n'.join(cleaned_lines).strip()
print(html)
`;

        const scriptPath = './temp_docling_html.py';
        await fs.writeFile(scriptPath, pythonScript);

        const { stdout, stderr } = await execAsync(
            `python ${scriptPath} "${pdfPath}" 2>/dev/null || python ${scriptPath} "${pdfPath}"`
        );

        await fs.unlink(scriptPath).catch(() => { });

        const duration = Date.now() - startTime;
        console.log(`✓ Completed in ${duration}ms`);
        console.log(`✓ HTML length: ${stdout.length} characters`);

        return stdout.trim();
    } catch (error) {
        console.error('Docling failed:', error);
        await fs.unlink('./temp_docling_html.py').catch(() => { });
        throw error;
    }
}


async function testMarkItDownToHtml(pdfPath: string): Promise<string> {
    console.log('\n=== Testing MarkItDown (HTML) ===');
    const startTime = Date.now();

    try {
        try {
            await execAsync('python -c "import markitdown"');
        } catch {
            console.error('MarkItDown not installed. Install with: pip install markitdown');
            throw new Error('MarkItDown not installed');
        }

        const pythonScript = `
import sys
from markitdown import MarkItDown

pdf_path = sys.argv[1]
md = MarkItDown()
result = md.convert(pdf_path)

# MarkItDown result has text_content (markdown) but we need HTML
# Convert markdown to HTML using a simple converter or use the markdown property
try:
    # Try to get HTML if available
    if hasattr(result, 'html_content'):
        print(result.html_content)
    elif hasattr(result, 'html'):
        print(result.html)
    else:
        # Fallback: convert markdown to HTML manually
        import markdown
        html = markdown.markdown(result.text_content, extensions=['extra', 'tables', 'fenced_code'])
        print(html)
except ImportError:
    # If markdown library not available, create basic HTML from text
    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>PDF Converted</title>
    <style>
        body {{ font-family: sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; }}
        h1, h2, h3 {{ color: #333; }}
        p {{ line-height: 1.6; }}
    </style>
</head>
<body>
    <pre>{result.text_content}</pre>
</body>
</html>"""
    print(html)
`;

        const scriptPath = './temp_markitdown_html.py';
        await fs.writeFile(scriptPath, pythonScript);

        const { stdout, stderr } = await execAsync(
            `python ${scriptPath} "${pdfPath}" 2>/dev/null || python ${scriptPath} "${pdfPath}"`
        );
        await fs.unlink(scriptPath).catch(() => { });

        const duration = Date.now() - startTime;
        console.log(`✓ Completed in ${duration}ms`);
        console.log(`✓ HTML length: ${stdout.length} characters`);

        return stdout.trim();
    } catch (error) {
        console.error('MarkItDown failed:', error);
        await fs.unlink('./temp_markitdown_html.py').catch(() => { });
        throw error;
    }
}


function convertUrlsToLinks(html: string): string {
    const segments: Array<{ type: 'tag' | 'text'; content: string }> = [];
    let lastIndex = 0;

    const tagPattern = /<[^>]+>/g;
    let match;

    while ((match = tagPattern.exec(html)) !== null) {
        if (match.index > lastIndex) {
            const textContent = html.substring(lastIndex, match.index);
            if (textContent.trim()) {
                segments.push({ type: 'text', content: textContent });
            }
        }

        segments.push({ type: 'tag', content: match[0] });
        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < html.length) {
        const textContent = html.substring(lastIndex);
        if (textContent.trim()) {
            segments.push({ type: 'text', content: textContent });
        }
    }

    return segments.map(segment => {
        if (segment.type === 'tag') {
            return segment.content;
        }

        const urlPattern = /(https?:\/\/[^\s<>"{}|\\^`\[\](){}]+|www\.[^\s<>"{}|\\^`\[\](){}]+)/gi;

        return segment.content.replace(urlPattern, (url) => {
            const href = url.startsWith('www.') ? `http://${url}` : url;

            const escapedUrl = href
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');

            const displayText = url
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">${displayText}</a>`;
        });
    }).join('');
}


function cleanHtml(html: string): string {
    let cleaned = html
        .split('\n')
        .filter(line => {
            if (/^len\([^)]+\)=/.test(line.trim())) return false;
            if (/^\d+(-\d+)?(,\s*\d+(-\d+)?)*\s*$/.test(line.trim())) return false;
            return true;
        })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    cleaned = convertUrlsToLinks(cleaned);

    return cleaned;
}

async function compareQualityHtml(pdfPath: string) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing PDF to HTML: ${path.basename(pdfPath)}`);
    console.log('='.repeat(60));

    const results: { [key: string]: { html: string; error?: string } } = {};


    try {
        const html = await testDoclingToHtml(pdfPath);
        results['docling'] = { html: cleanHtml(html) };
    } catch (error) {
        results['docling'] = { html: '', error: String(error) };
    }

    try {
        const html = await testMarkItDownToHtml(pdfPath);
        results['markitdown'] = { html: cleanHtml(html) };
    } catch (error) {
        results['markitdown'] = { html: '', error: String(error) };
    }

    console.log('\n=== Saving Results ===');
    for (const [method, result] of Object.entries(results)) {
        if (result.html) {
            const outputPath = `./output_${method}.html`;
            await fs.writeFile(outputPath, result.html);
            console.log(`✓ Saved ${method} output to: ${outputPath}`);

            console.log(`\n${method} preview:`);
            const preview = result.html.substring(0, 300).replace(/\n/g, '\n  ');
            console.log(`  ${preview}${result.html.length > 300 ? '...' : ''}\n`);
        } else if (result.error) {
            console.log(`✗ ${method} failed: ${result.error}`);
        }
    }
}

async function main() {
    const pdfPath = process.argv[2] || './sample.pdf';

    try {
        await fs.access(pdfPath);
    } catch {
        console.error(`\nError: PDF file not found at ${pdfPath}`);
        console.log('Usage: npx tsx html.ts <path-to-pdf>\n');
        process.exit(1);
    }

    await compareQualityHtml(pdfPath);

    console.log('\n All HTML conversions completed! Check output_*.html files for results.\n');
}

main().catch(console.error);

