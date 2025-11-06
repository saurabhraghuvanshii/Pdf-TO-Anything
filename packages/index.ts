import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

    await testDocling(pdfPath);
}

main().catch(console.error);
