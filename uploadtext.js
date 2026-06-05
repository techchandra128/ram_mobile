// uploadtext.js - Shared txt file parser utility

/**
 * Parses a plain text file into a structured sections array.
 *
 * Rules:
 * - Indentation via tabs only (\t). 0 tabs = level 1, 1 tab = level 2, etc.
 * - Max level: 4 (3 tabs). 4+ tabs = error.
 * - Empty lines are skipped.
 * - Max name length: 60 chars (after stripping " - dummy" suffix).
 * - Names ending with " - dummy" (case-insensitive) → type: 'dummy', suffix stripped.
 * - Level jump validation: can't jump more than 1 level deeper than current max.
 * - On any error → returns { error: "message" }, nothing is added.
 * - On success → returns { sections: [...] }
 *
 * Each returned section: { title, level, type }
 * Caller is responsible for adding id, progress, etc.
 */

const UPLOAD_TEXT_MAX_NAME_LENGTH = 60;
const UPLOAD_TEXT_MAX_LEVEL = 4;
const DUMMY_SUFFIX_REGEX = /\s*-\s*dummy$/i;

function parseUploadText(text) {
    const lines = text.split('\n');
    const sections = [];
    let maxLevelSeen = 0;

    for (let i = 0; i < lines.length; i++) {
        const rawLine = lines[i];

        // Remove trailing \r (Windows line endings)
        const line = rawLine.replace(/\r$/, '');

        // Detect mixed tabs and spaces
        if (/^\t+ /.test(line) || /^ +\t/.test(line)) {
            return { error: `Line ${i + 1}: Mixed tabs and spaces. Use either tabs or 4-spaces consistently.` };
        }

        // Count indentation
        let tabCount = 0;
        if (line[0] === '\t') {
            while (tabCount < line.length && line[tabCount] === '\t') tabCount++;
        } else if (line.startsWith('    ')) {
            let spaceCount = 0;
            while (spaceCount < line.length && line[spaceCount] === ' ') spaceCount++;
            if (spaceCount % 4 !== 0) {
                return { error: `Line ${i + 1}: Space indentation must be a multiple of 4 (found ${spaceCount} spaces).` };
            }
            tabCount = spaceCount / 4;
        }

        const content = line.slice(line[0] === '\t' ? tabCount : tabCount * 4);

        // Skip empty lines
        if (content.trim() === '') continue;
        

        // Check max level
        const level = tabCount + 1;
        if (level > UPLOAD_TEXT_MAX_LEVEL) {
            return { error: `Line ${i + 1}: Too many tabs (${tabCount}). Maximum indentation is ${UPLOAD_TEXT_MAX_LEVEL - 1} tabs (level ${UPLOAD_TEXT_MAX_LEVEL}).` };
        }

        // Level jump validation: can't go deeper than maxLevelSeen + 1
        if (level > maxLevelSeen + 1) {
            return { error: `Line ${i + 1}: Invalid indentation jump. Level ${level} used but no level ${level - 1} parent exists above it.` };
        }

        // Detect dummy
        const isDummy = DUMMY_SUFFIX_REGEX.test(content);
        let title = isDummy ? content.replace(DUMMY_SUFFIX_REGEX, '').trim() : content.trim();

        // Check name length
        if (title.length === 0) {
            return { error: `Line ${i + 1}: Section name is empty after stripping the dummy suffix.` };
        }
        if (title.length > UPLOAD_TEXT_MAX_NAME_LENGTH) {
            return { error: `Line ${i + 1}: Section name is too long (${title.length} chars). Maximum is ${UPLOAD_TEXT_MAX_NAME_LENGTH} characters.` };
        }

        sections.push({
            title,
            level,
            type: isDummy ? 'dummy' : 'real'
        });

        if (level > maxLevelSeen) maxLevelSeen = level;
    }

    if (sections.length === 0) {
        return { error: 'The file has no valid section names.' };
    }

    return { sections };
}