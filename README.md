# Document Converter CLI

A CLI tool to convert documents between multiple formats using Docling.

## Installation

Install all dependencies (Node.js and Python) with one command:

```bash
npm run setup
```

Or install separately:

```bash
npm install
pip install docling
# Install opencv without dependencies to avoid numpy version conflicts
pip install --no-deps opencv-python-headless || pip install opencv-python-headless
```

**Note:** Docling requires OpenCV to work properly. We use `opencv-python-headless` (lighter version without GUI dependencies). If you encounter numpy version conflicts, try installing with `--no-deps` flag first.

## Usage


### install globally:

```bash
npm link
pdfconvert document.pdf > output.md
```

```bash
pdfconvert <input-file> [options] > output.md
```

### Options

- `-f, --format <format>` - Output format (html, markdown, json, text, doctags) [default: markdown]
- `-q, --quiet` - Suppress progress messages (output only)
- `-h, --help` - Show help message

### Supported Input Formats

PDF, Markdown, ASCIIDoc, HTML, XHTML, CSV, PNG, JPEG, TIFF, BMP, WEBP, WebVTT

### Supported Output Formats

- `html` - HTML format
- `markdown` or `md` - Markdown format
- `json` - JSON format
- `text` - Plain text format
- `doctags` - DocTags format

## Examples

```bash
# Convert PDF to Markdown
pdfconvert document.pdf > output.md

# Convert PDF to HTML
pdfconvert document.pdf --format html > output.html

# Convert image to Markdown
pdfconvert image.png --format markdown > output.md

# Convert PDF to JSON
pdfconvert document.pdf --format json > output.json

# Quiet mode (no progress messages)
pdfconvert document.pdf --quiet > output.md
```

## Development

Run directly with tsx:

```bash
npx tsx packages/index.ts document.pdf > output.md
```
