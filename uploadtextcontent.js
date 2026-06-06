// uploadtextcontent.js - Content upload parser for Column 3

/**
 * Parses a formatted .txt file into an array of cell objects.
 *
 * FORMAT DECLARATION:
 * - First non-empty line must be ++++ for cornell format
 * - No ++++ = plain text (entire content → one plain text version)
 *
 * CORNELL FORMAT CELLS:
 * // Header text          → header cell (single line)
 * [ ... ]                 → cornell cell
 * ( ... )                 → normal cell
 * { ... }                 → code cell
 *
 * INSIDE [ cornell cell ]:
 * > left side text        → exactly one, must be first line
 * - text                  → right side plain (all lines must use same marker)
 * -- text                 → right side bullet
 * --- text                → right side numbered
 *
 * INSIDE ( normal cell ):
 * * text                  → plain text (all lines must use same marker)
 * ** text                 → bullet
 * *** text                → numbered
 *
 * INSIDE { code cell }:
 * any text                → code lines (no marker rules)
 *
 * GENERAL:
 * - Empty lines skipped everywhere
 * - Mixed markers inside a cell = error
 * - Multiple > in one cornell cell = error
 * - > not first content line in cornell cell = error
 * - Unclosed bracket = error
 * - Nested brackets = error
 * - Unrecognised line outside a cell = error
 *
 * Returns { plain: true, html: '...' } for plain text
 * Returns { cells: [...] } for cornell format
 * Returns { error: '...' } on any validation failure
 *
 * Cell object shapes:
 * { type: 'header',  content: 'html string' }
 * { type: 'cornell', left: 'html string', right: 'html string' }
 * { type: 'normal',  content: 'html string' }
 * { type: 'code',    content: 'html string' }
 */

function parseUploadTextContent(text) {
    const rawLines = text.split('\n');
    const lines = rawLines.map(l => l.replace(/\r$/, ''));

    // Find first non-empty line
    let firstNonEmpty = '';
    for (const l of lines) {
        if (l.trim() !== '') { firstNonEmpty = l.trim(); break; }
    }

    // Plain text mode
    if (firstNonEmpty !== '++++') {
        const html = lines
            .map(l => `<p>${escapeHtml(l) || '<br>'}</p>`)
            .join('');
        return { plain: true, html };
    }

    // Cornell format mode
    const cells = [];
    let i = 0;

    // Skip the ++++ line
    while (i < lines.length && lines[i].trim() === '') i++;
    if (lines[i] && lines[i].trim() === '++++') i++;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip empty lines
        if (trimmed === '') { i++; continue; }

        // Header cell
        if (trimmed.startsWith('//')) {
            const content = trimmed.slice(2).trim();
            if (!content) return { error: `Line ${i + 1}: Header cell is empty after //.` };
            cells.push({ type: 'header', content: escapeHtml(content) });
            i++;
            continue;
        }

        // Cornell cell [...]
        if (trimmed === '[') {
            i++;
            const result = parseCornellCell(lines, i);
            if (result.error) return { error: result.error };
            cells.push(result.cell);
            i = result.nextIndex;
            continue;
        }

        // Normal cell (...)
        if (trimmed === '(') {
            i++;
            const result = parseNormalCell(lines, i);
            if (result.error) return { error: result.error };
            cells.push(result.cell);
            i = result.nextIndex;
            continue;
        }

        // Code cell {...}
        if (trimmed === '{') {
            i++;
            const result = parseCodeCell(lines, i);
            if (result.error) return { error: result.error };
            cells.push(result.cell);
            i = result.nextIndex;
            continue;
        }

        // Nested or misplaced brackets
        if (trimmed === ']' || trimmed === ')' || trimmed === '}') {
            return { error: `Line ${i + 1}: Unexpected closing bracket '${trimmed}' without an opening bracket.` };
        }

        return { error: `Line ${i + 1}: Unrecognised line. Each line must start with //, [, (, or {.` };
    }

    if (cells.length === 0) {
        return { error: 'The file has no valid cells after ++++.' };
    }

    return { cells };
}

// ===== PARSE CORNELL CELL =====
function parseCornellCell(lines, startIndex) {
    let i = startIndex;
    let leftText = null;
    let rightLines = [];
    let markerUsed = null;
    let hasContent = false;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '') { i++; continue; }

        // Closing bracket
        if (trimmed === ']') {
            if (leftText === null) return { error: `Line ${i + 1}: Cornell cell [ ] has no > line.` };
            i++;
            return {
                cell: {
                    type: 'cornell',
                    left: escapeHtml(leftText),
                    right: buildRightSideHtml(rightLines, markerUsed)
                },
                nextIndex: i
            };
        }

        // Nested brackets
        if (trimmed === '[' || trimmed === '(' || trimmed === '{') {
            return { error: `Line ${i + 1}: Nested brackets are not allowed inside a cornell cell.` };
        }

        // Left side
        if (trimmed.startsWith('> ') || trimmed === '>') {
            if (leftText !== null) return { error: `Line ${i + 1}: Multiple > lines in one cornell cell. Only one is allowed.` };
            if (hasContent) return { error: `Line ${i + 1}: > must be the first line inside a cornell cell [ ].` };
            leftText = trimmed.slice(1).trim();
            hasContent = true;
            i++;
            continue;
        }

        if (leftText === null) {
            return { error: `Line ${i + 1}: > must be the first line inside a cornell cell [ ].` };
        }

        // Right side markers
        if (trimmed.startsWith('---')) {
            if (markerUsed && markerUsed !== '---') return { error: `Line ${i + 1}: Mixed markers inside cornell cell. Use only one of -, --, ---.` };
            markerUsed = '---';
            rightLines.push({ marker: '---', text: trimmed.slice(3).trim() });
            hasContent = true; i++; continue;
        }
        if (trimmed.startsWith('--')) {
            if (markerUsed && markerUsed !== '--') return { error: `Line ${i + 1}: Mixed markers inside cornell cell. Use only one of -, --, ---.` };
            markerUsed = '--';
            rightLines.push({ marker: '--', text: trimmed.slice(2).trim() });
            hasContent = true; i++; continue;
        }
        if (trimmed.startsWith('-')) {
            if (markerUsed && markerUsed !== '-') return { error: `Line ${i + 1}: Mixed markers inside cornell cell. Use only one of -, --, ---.` };
            markerUsed = '-';
            rightLines.push({ marker: '-', text: trimmed.slice(1).trim() });
            hasContent = true; i++; continue;
        }

        return { error: `Line ${i + 1}: Unrecognised line inside cornell cell. Use >, -, --, or ---.` };
    }

    return { error: `Unclosed cornell cell [ — missing closing ].` };
}

// ===== PARSE NORMAL CELL =====
function parseNormalCell(lines, startIndex) {
    let i = startIndex;
    let textLines = [];
    let markerUsed = null;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '') { i++; continue; }

        if (trimmed === ')') {
            if (textLines.length === 0) return { error: `Line ${i + 1}: Normal cell ( ) is empty.` };
            i++;
            return {
                cell: { type: 'text', content: buildNormalHtml(textLines, markerUsed) },
                nextIndex: i
            };
        }

        if (trimmed === '[' || trimmed === '(' || trimmed === '{') {
            return { error: `Line ${i + 1}: Nested brackets are not allowed inside a normal cell.` };
        }

        if (trimmed.startsWith('***')) {
            if (markerUsed && markerUsed !== '***') return { error: `Line ${i + 1}: Mixed markers inside normal cell. Use only one of *, **, ***.` };
            markerUsed = '***';
            textLines.push({ marker: '***', text: trimmed.slice(3).trim() });
            i++; continue;
        }
        if (trimmed.startsWith('**')) {
            if (markerUsed && markerUsed !== '**') return { error: `Line ${i + 1}: Mixed markers inside normal cell. Use only one of *, **, ***.` };
            markerUsed = '**';
            textLines.push({ marker: '**', text: trimmed.slice(2).trim() });
            i++; continue;
        }
        if (trimmed.startsWith('*')) {
            if (markerUsed && markerUsed !== '*') return { error: `Line ${i + 1}: Mixed markers inside normal cell. Use only one of *, **, ***.` };
            markerUsed = '*';
            textLines.push({ marker: '*', text: trimmed.slice(1).trim() });
            i++; continue;
        }

        return { error: `Line ${i + 1}: Unrecognised line inside normal cell. Use *, **, or ***.` };
    }

    return { error: `Unclosed normal cell ( — missing closing ).` };
}

// ===== PARSE CODE CELL =====
function parseCodeCell(lines, startIndex) {
    let i = startIndex;
    let codeLines = [];

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed === '}') {
            if (codeLines.length === 0) return { error: `Line ${i + 1}: Code cell { } is empty.` };
            i++;
            return {
                cell: { type: 'code', content: codeLines.map(l => escapeHtml(l)).join('<br>') },
                nextIndex: i
            };
        }

        if (trimmed === '{') {
            return { error: `Line ${i + 1}: Nested { brackets are not allowed inside a code cell.` };
        }

        codeLines.push(line);
        i++;
    }

    return { error: `Unclosed code cell { — missing closing }.` };
}

// ===== HTML BUILDERS =====
function buildRightSideHtml(rightLines, marker) {
    if (rightLines.length === 0) return '';
    if (marker === '--') {
        return '<ul>' + rightLines.map(l => `<li>${escapeHtml(l.text)}</li>`).join('') + '</ul>';
    }
    if (marker === '---') {
        return '<ol>' + rightLines.map(l => `<li>${escapeHtml(l.text)}</li>`).join('') + '</ol>';
    }
    // plain -
    return rightLines.map(l => `<p>${escapeHtml(l.text)}</p>`).join('');
}

function buildNormalHtml(textLines, marker) {
    if (marker === '**') {
        return '<ul>' + textLines.map(l => `<li>${escapeHtml(l.text)}</li>`).join('') + '</ul>';
    }
    if (marker === '***') {
        return '<ol>' + textLines.map(l => `<li>${escapeHtml(l.text)}</li>`).join('') + '</ol>';
    }
    // plain *
    return textLines.map(l => `<p>${escapeHtml(l.text)}</p>`).join('');
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}