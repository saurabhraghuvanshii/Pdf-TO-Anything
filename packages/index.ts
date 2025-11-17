import * as fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { handleYouTubeCLI } from './video-audio';

const execAsync = promisify(exec);

const OUTPUT_FORMATS = ['html', 'markdown', 'md', 'json', 'text', 'doctags'];

async function convertDocument(
    inputPath: string,
    outputFormat: string = 'markdown',
    quiet: boolean = false
): Promise<string> {
    const startTime = Date.now();

    try {
        try {
            await execAsync('python -c "import docling"');
        } catch {
            if (!quiet) {
                console.error('Docling not installed. Install with: pip install docling opencv-python-headless');
            }
            throw new Error('Docling not installed');
        }

        try {
            await execAsync('python -c "import cv2"');
        } catch {
            if (!quiet) {
                console.error(' OpenCV (cv2) not installed. Install with: pip install opencv-python-headless');
                console.error('   Or run: npm run setup');
            }
            throw new Error('OpenCV (cv2) not installed');
        }

        const normalizedFormat = outputFormat.toLowerCase();
        let doclingFormat = normalizedFormat;

        const formatMap: { [key: string]: string } = {
            'md': 'markdown',
            'html': 'html',
            'json': 'json',
            'text': 'text',
            'doctags': 'doctags'
        };

        doclingFormat = formatMap[normalizedFormat] || normalizedFormat;

        const pythonScript = `
import sys
import re
from docling.document_converter import DocumentConverter

input_path = sys.argv[1]
output_format = sys.argv[2]

try:
    converter = DocumentConverter()
    result = converter.convert(input_path)
    
    # Export based on format
    if output_format == 'markdown':
        content = result.document.export_to_markdown()
    elif output_format == 'html':
        content = result.document.export_to_html()
    elif output_format == 'json':
        import json
        content = json.dumps(result.document.export_to_dict(), indent=2, ensure_ascii=False)
    elif output_format == 'text':
        content = result.document.export_to_text()
    elif output_format == 'doctags':
        content = result.document.export_to_doctags()
    else:
        # Default to markdown
        content = result.document.export_to_markdown()
    
    # Clean up debug output for markdown/html
    if output_format in ['markdown', 'html']:
        lines = content.split('\\n')
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
        
        content = '\\n'.join(cleaned_lines).strip()
    
    print(content)
except Exception as e:
    print(f"Error: {str(e)}", file=sys.stderr)
    sys.exit(1)
`;

        const scriptPath = './temp_docling_convert.py';
        await fs.writeFile(scriptPath, pythonScript);

        const { stdout, stderr } = await execAsync(
            `python ${scriptPath} "${inputPath}" "${doclingFormat}" 2>/dev/null || python ${scriptPath} "${inputPath}" "${doclingFormat}"`
        );

        await fs.unlink(scriptPath).catch(() => { });

        if (!quiet) {
            const duration = Date.now() - startTime;
            console.error(`✓ Converted in ${duration}ms`);
            console.error(`✓ Output length: ${stdout.length} characters`);
        }

        return stdout.trim();
    } catch (error) {
        await fs.unlink('./temp_docling_convert.py').catch(() => { });
        throw error;
    }
}

function parseArgs(): { inputPath: string; outputFormat: string; quiet: boolean } {
    const args = process.argv.slice(2);

    let inputPath = '';
    let outputFormat = 'markdown';
    let quiet = false;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--format' || arg === '-f') {
            outputFormat = args[++i] || 'markdown';
        } else if (arg === '--quiet' || arg === '-q') {
            quiet = true;
        } else if (arg === '--help' || arg === '-h') {
            console.log(`
Usage: pdfconvert <input-file> [options]

Convert documents using Docling.

Options:
  -f, --format <format>    Output format (html, markdown, json, text, doctags) [default: markdown]
  -q, --quiet             Suppress progress messages (output only)
  -h, --help              Show this help message

Supported Input Formats:
  PDF, Markdown, ASCIIDoc, HTML, XHTML, CSV, PNG, JPEG, TIFF, BMP, WEBP, WebVTT

Supported Output Formats:
  html, markdown (md), json, text, doctags

Examples:
  pdfconvert document.pdf > output.md
  pdfconvert document.pdf --format html > output.html
  pdfconvert image.png --format markdown > output.md
  pdfconvert document.pdf --format json > output.json
            `);
            process.exit(0);
        } else if (!arg.startsWith('-')) {
            inputPath = arg;
        }
    }

    return { inputPath, outputFormat, quiet };
}

async function main() {
    const args = process.argv.slice(2);

    if (args[0] === "youtube") {
        await handleYouTubeCLI(args.slice(1));
        process.exit(0);
    }

    const { inputPath, outputFormat, quiet } = parseArgs();

    if (!inputPath) {
        console.error(' Error: No input file specified');
        console.error('Usage: pdfconvert <input-file> [--format <output-format>]');
        console.error('Use --help for more information');
        process.exit(1);
    }

    try {
        await fs.access(inputPath);
    } catch {
        console.error(` Error: File not found: ${inputPath}`);
        process.exit(1);
    }

    const normalizedFormat = outputFormat.toLowerCase();
    if (!OUTPUT_FORMATS.includes(normalizedFormat) && !OUTPUT_FORMATS.includes(normalizedFormat.replace('md', 'markdown'))) {
        console.error(` Error: Unsupported output format: ${outputFormat}`);
        console.error(`Supported formats: ${OUTPUT_FORMATS.join(', ')}`);
        process.exit(1);
    }

    try {
        const output = await convertDocument(inputPath, outputFormat, quiet);
        process.stdout.write(output);
    } catch (error: any) {
        console.error(` Conversion failed: ${error.message}`);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error(' Unexpected error:', error);
    process.exit(1);
});
