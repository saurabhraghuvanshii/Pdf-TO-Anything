import { PDFParse } from 'pdf-parse';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Method 2: Docling (Python-based - High quality with structure)
 * Requires: pip install docling
 */
async function testDoclingToHtml(pdfPath: string): Promise<string> {
    console.log('\n=== Testing Docling (HTML) ===');
    const startTime = Date.now();

    try {
        // Check if docling is installed
        try {
            await execAsync('python -c "import docling"');
        } catch {
            console.error('❌ Docling not installed. Install with: pip install docling');
            throw new Error('Docling not installed');
        }

        // Create Python script with HTML export
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

        // Save temp Python script
        const scriptPath = './temp_docling_html.py';
        await fs.writeFile(scriptPath, pythonScript);

        // Execute with suppressed stderr warnings
        const { stdout, stderr } = await execAsync(
            `python ${scriptPath} "${pdfPath}" 2>/dev/null || python ${scriptPath} "${pdfPath}"`
        );

        // Cleanup temp file
        await fs.unlink(scriptPath).catch(() => { });

        const duration = Date.now() - startTime;
        console.log(`✓ Completed in ${duration}ms`);
        console.log(`✓ HTML length: ${stdout.length} characters`);

        return stdout.trim();
    } catch (error) {
        console.error('❌ Docling failed:', error);
        // Cleanup temp file on error
        await fs.unlink('./temp_docling_html.py').catch(() => { });
        throw error;
    }
}

/**
 * Method 3: MarkItDown (Microsoft - Fast and structured)
 * Requires: pip install markitdown
 */
async function testMarkItDownToHtml(pdfPath: string): Promise<string> {
    console.log('\n=== Testing MarkItDown (HTML) ===');
    const startTime = Date.now();

    try {
        // Check if markitdown is installed
        try {
            await execAsync('python -c "import markitdown"');
        } catch {
            console.error('❌ MarkItDown not installed. Install with: pip install markitdown');
            throw new Error('MarkItDown not installed');
        }

        // Create Python script - MarkItDown can output HTML directly
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

        // Save temp Python script
        const scriptPath = './temp_markitdown_html.py';
        await fs.writeFile(scriptPath, pythonScript);

        // Execute with suppressed warnings
        const { stdout, stderr } = await execAsync(
            `python ${scriptPath} "${pdfPath}" 2>/dev/null || python ${scriptPath} "${pdfPath}"`
        );

        // Cleanup temp file
        await fs.unlink(scriptPath).catch(() => { });

        const duration = Date.now() - startTime;
        console.log(`✓ Completed in ${duration}ms`);
        console.log(`✓ HTML length: ${stdout.length} characters`);

        // MarkItDown should output HTML directly, but if it's markdown, 
        // use Python's markdown library to convert (already handled in Python script)
        return stdout.trim();
    } catch (error) {
        console.error('❌ MarkItDown failed:', error);
        // Cleanup temp file on error
        await fs.unlink('./temp_markitdown_html.py').catch(() => { });
        throw error;
    }
}


/**
 * Convert plain text URLs to clickable HTML links
 * Only processes text content (between HTML tags) to avoid modifying existing links
 */
function convertUrlsToLinks(html: string): string {
    // Split HTML into segments: tags and text content
    const segments: Array<{ type: 'tag' | 'text'; content: string }> = [];
    let lastIndex = 0;

    // Find all HTML tags
    const tagPattern = /<[^>]+>/g;
    let match;

    while ((match = tagPattern.exec(html)) !== null) {
        // Add text before tag
        if (match.index > lastIndex) {
            const textContent = html.substring(lastIndex, match.index);
            if (textContent.trim()) {
                segments.push({ type: 'text', content: textContent });
            }
        }

        // Add the tag itself
        segments.push({ type: 'tag', content: match[0] });
        lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last tag
    if (lastIndex < html.length) {
        const textContent = html.substring(lastIndex);
        if (textContent.trim()) {
            segments.push({ type: 'text', content: textContent });
        }
    }

    // Process each segment - only convert URLs in text segments
    return segments.map(segment => {
        if (segment.type === 'tag') {
            // Don't modify tags
            return segment.content;
        }

        // Convert URLs in text content
        // Pattern: http:// or https:// or www. followed by valid URL characters
        const urlPattern = /(https?:\/\/[^\s<>"{}|\\^`\[\](){}]+|www\.[^\s<>"{}|\\^`\[\](){}]+)/gi;

        return segment.content.replace(urlPattern, (url) => {
            // Add http:// if URL starts with www.
            const href = url.startsWith('www.') ? `http://${url}` : url;

            // Escape HTML in URL for href attribute
            const escapedUrl = href
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');

            // Escape HTML in display text
            const displayText = url
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer">${displayText}</a>`;
        });
    }).join('');
}

/**
 * Clean HTML output - remove debug lines and normalize formatting
 */
function cleanHtml(html: string): string {
    let cleaned = html
        .split('\n')
        .filter(line => {
            // Remove debug lines
            if (/^len\([^)]+\)=/.test(line.trim())) return false;
            if (/^\d+(-\d+)?(,\s*\d+(-\d+)?)*\s*$/.test(line.trim())) return false;
            return true;
        })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
        .trim();

    // Convert plain text URLs to clickable links
    cleaned = convertUrlsToLinks(cleaned);

    return cleaned;
}

/**
 * Compare all methods side by side for HTML conversion
 */
async function compareQualityHtml(pdfPath: string) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing PDF to HTML: ${path.basename(pdfPath)}`);
    console.log('='.repeat(60));

    const results: { [key: string]: { html: string; error?: string } } = {};

    // Test 2: Docling
    try {
        const html = await testDoclingToHtml(pdfPath);
        results['docling'] = { html: cleanHtml(html) };
    } catch (error) {
        results['docling'] = { html: '', error: String(error) };
    }

    // Test 3: MarkItDown
    try {
        const html = await testMarkItDownToHtml(pdfPath);
        results['markitdown'] = { html: cleanHtml(html) };
    } catch (error) {
        results['markitdown'] = { html: '', error: String(error) };
    }

    // Save outputs
    console.log('\n=== Saving Results ===');
    for (const [method, result] of Object.entries(results)) {
        if (result.html) {
            const outputPath = `./output_${method}.html`;
            await fs.writeFile(outputPath, result.html);
            console.log(`✓ Saved ${method} output to: ${outputPath}`);

            // Preview first 300 chars
            console.log(`\n${method} preview:`);
            const preview = result.html.substring(0, 300).replace(/\n/g, '\n  ');
            console.log(`  ${preview}${result.html.length > 300 ? '...' : ''}\n`);
        } else if (result.error) {
            console.log(`✗ ${method} failed: ${result.error}`);
        }
    }
}

// Main execution
async function main() {
    const pdfPath = process.argv[2] || './sample.pdf';

    // Check if PDF exists
    try {
        await fs.access(pdfPath);
    } catch {
        console.error(`\n❌ Error: PDF file not found at ${pdfPath}`);
        console.log('Usage: npx tsx html.ts <path-to-pdf>\n');
        process.exit(1);
    }

    await compareQualityHtml(pdfPath);

    console.log('\n✅ All HTML conversions completed! Check output_*.html files for results.\n');
}

main().catch(console.error);

