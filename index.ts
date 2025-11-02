import { PDFParse } from 'pdf-parse';
import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Method 1: pdf-parse (Pure TypeScript - Fast but basic)
 * Install: npm install pdf-parse
 */
async function testPdfParse(pdfPath: string): Promise<string> {
    console.log('\n=== Testing pdf-parse ===');
    const startTime = Date.now();

    try {
        const dataBuffer = await fs.readFile(pdfPath);
        const parser = new PDFParse({ data: dataBuffer });
        const result = await parser.getText();
        await parser.destroy();

        const duration = Date.now() - startTime;
        console.log(`✓ Completed in ${duration}ms`);
        console.log(`✓ Pages: ${result.pages.length}`);
        console.log(`✓ Text length: ${result.text.length} characters`);

        // Basic markdown formatting
        let markdown = result.text
            .replace(/-- \d+ of \d+ --/g, '') // Remove page number markers (e.g., "-- 1 of 9 --")
            .replace(/\n{3,}/g, '\n\n') // Clean up excessive newlines
            .replace(/([.!?])\s+/g, '$1\n\n') // Paragraph breaks after sentences
            .trim();

        return markdown;
    } catch (error) {
        console.error('❌ pdf-parse failed:', error);
        throw error;
    }
}
/**
 * Method 2: Docling (Python-based - High quality with structure)
 * Requires: pip install docling
 */
async function testDocling(pdfPath: string): Promise<string> {
    console.log('\n=== Testing Docling ===');
    const startTime = Date.now();

    try {
        // Check if docling is installed
        try {
            await execAsync('python -c "import docling"');
        } catch {
            console.error('❌ Docling not installed. Install with: pip install docling');
            throw new Error('Docling not installed');
        }

        // Create Python script with debug output filtering
        const pythonScript = `
import sys
import re
from docling.document_converter import DocumentConverter

pdf_path = sys.argv[1]
converter = DocumentConverter()
result = converter.convert(pdf_path)
markdown = result.document.export_to_markdown()

# Clean up debug output at the start
lines = markdown.split('\\n')
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

markdown = '\\n'.join(cleaned_lines).strip()
print(markdown)
`;

        // Save temp Python script
        const scriptPath = './temp_docling.py';
        await fs.writeFile(scriptPath, pythonScript);

        // Execute with suppressed stderr warnings
        const { stdout, stderr } = await execAsync(
            `python ${scriptPath} "${pdfPath}" 2>/dev/null || python ${scriptPath} "${pdfPath}"`
        );

        // Cleanup temp file
        await fs.unlink(scriptPath).catch(() => { });

        const duration = Date.now() - startTime;
        console.log(`✓ Completed in ${duration}ms`);
        console.log(`✓ Markdown length: ${stdout.length} characters`);

        return stdout.trim();
    } catch (error) {
        console.error('❌ Docling failed:', error);
        // Cleanup temp file on error
        await fs.unlink('./temp_docling.py').catch(() => { });
        throw error;
    }
}

/**
 * Method 3: MarkItDown (Microsoft - Fast and structured)
 * Requires: pip install markitdown
 */
async function testMarkItDown(pdfPath: string): Promise<string> {
    console.log('\n=== Testing MarkItDown ===');
    const startTime = Date.now();

    try {
        // Check if markitdown is installed
        try {
            await execAsync('python -c "import markitdown"');
        } catch {
            console.error('❌ MarkItDown not installed. Install with: pip install markitdown');
            throw new Error('MarkItDown not installed');
        }

        // Create Python script
        const pythonScript = `
import sys
from markitdown import MarkItDown

pdf_path = sys.argv[1]
md = MarkItDown()
result = md.convert(pdf_path)
print(result.text_content)
`;

        // Save temp Python script
        const scriptPath = './temp_markitdown.py';
        await fs.writeFile(scriptPath, pythonScript);

        // Execute with suppressed warnings
        const { stdout, stderr } = await execAsync(
            `python ${scriptPath} "${pdfPath}" 2>/dev/null || python ${scriptPath} "${pdfPath}"`
        );

        // Cleanup temp file
        await fs.unlink(scriptPath).catch(() => { });

        const duration = Date.now() - startTime;
        console.log(`✓ Completed in ${duration}ms`);
        console.log(`✓ Markdown length: ${stdout.length} characters`);

        return stdout.trim();
    } catch (error) {
        console.error('❌ MarkItDown failed:', error);
        // Cleanup temp file on error
        await fs.unlink('./temp_markitdown.py').catch(() => { });
        throw error;
    }
}

/**
 * Clean markdown output - remove debug lines and normalize formatting
 */
function cleanMarkdown(markdown: string): string {
    return markdown
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
}

/**
 * Compare all methods side by side
 */
async function compareQuality(pdfPath: string) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing PDF: ${path.basename(pdfPath)}`);
    console.log('='.repeat(60));

    const results: { [key: string]: { markdown: string; error?: string } } = {};

    // Test 1: pdf-parse
    try {
        const markdown = await testPdfParse(pdfPath);
        results['pdf-parse'] = { markdown: cleanMarkdown(markdown) };
    } catch (error) {
        results['pdf-parse'] = { markdown: '', error: String(error) };
    }

    // Test 2: Docling
    try {
        const markdown = await testDocling(pdfPath);
        results['docling'] = { markdown: cleanMarkdown(markdown) };
    } catch (error) {
        results['docling'] = { markdown: '', error: String(error) };
    }

    // Test 3: MarkItDown
    try {
        const markdown = await testMarkItDown(pdfPath);
        results['markitdown'] = { markdown: cleanMarkdown(markdown) };
    } catch (error) {
        results['markitdown'] = { markdown: '', error: String(error) };
    }

    // Save outputs
    console.log('\n=== Saving Results ===');
    for (const [method, result] of Object.entries(results)) {
        if (result.markdown) {
            const outputPath = `./output_${method}.md`;
            await fs.writeFile(outputPath, result.markdown);
            console.log(`✓ Saved ${method} output to: ${outputPath}`);

            // Preview first 300 chars
            console.log(`\n${method} preview:`);
            const preview = result.markdown.substring(0, 300).replace(/\n/g, '\n  ');
            console.log(`  ${preview}${result.markdown.length > 300 ? '...' : ''}\n`);
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
        console.log('Usage: npx tsx index.ts <path-to-pdf>\n');
        process.exit(1);
    }

    await compareQuality(pdfPath);
}

main().catch(console.error);
