/**
 * Enum used for rendering markdown in different situations
 * @readonly
 * @enum {number}
 */
const RenderModes = Object.freeze({
    NORMAL: 0,
    BLOCK: 1,
    TABLE: 2,
    LIST: 3,
});

/**
 * @typedef {Object} ElementContext
 * @property {string} innerText
 * @property {number} renderingMode   
 */

/** @typedef {[RegExp, string][]} ParsingRules */

/**
 * Used for rendering any text formatting like Italics, Bold, etc.. 
 * @type {ParsingRules}
 */
const textFormatRules = [
    [/\*\*\*([ \t\r\S]+)\*\*\*/g, "<i><b>$1</b></i>"], // *italics*
    [/\*\*([ \t\r\S]+)\*\*/g, "<b>$1</b>"],            // **bold**
    [/\*([ \t\r\S]+)\*/g, "<i>$1</i>"],                // ***bold and italics***
    [/`([ \t\r\S]+)`/g, "<code>$1</code>"],            // `code`
    [/__([ \t\r\S]+)__/g, "<u>$1</u>"],                // __underline__ 
    [/~~([ \t\r\S]+)~~/g, "<s>$1</s>"],                // ~~strikethrough~~
]

/**
 * Used for rendering anything that links to an external resource
 *  @type {ParsingRules} 
 */
const externalContentRules = [
    // Images
    [/\!\[([^)]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">'], // !(alt-text)[link]

    // Links
    [/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="text-decoration: none;">$1</a>',], // (Text)
]

/** 
 * Used rendering for non-specific cases
 * @type {ParsingRules} 
 */
const markdownRules = [
    // Headers
    [/^#{6}\s+([^\n]+)/gm, "<h6>$1</h6>"],
    [/^#{5}\s+([^\n]+)/gm, "<h5>$1</h5>"],
    [/^#{4}\s+([^\n]+)/gm, "<h4>$1</h4>"],
    [/^#{3}\s+([^\n]+)/gm, "<h3>$1</h3>"],
    [/^#{2}\s+([^\n]+)/gm, "<h2>$1</h2>"],
    [/^#{1}\s+([^\n]+)/gm, "<h1>$1</h1>"],

    // Thematic Break
    [/^---\n/g, "<hr>"],

    // Images/Links
    ...externalContentRules,

    // Text Formatting (must go after all other styling)
    [/([^\n]+[\S]+)\n?/g, "<p>$1</p>"],                   // All loose text goes into paragraphs
    [/<p>(<[^\n]+>)\n?<\/p>/g, "$1"],                     // Remove html inside of paragraphs
    ...textFormatRules,
]

/**
 * Used for rendering tables 
 * @type {ParsingRules} 
 */
const tableRules = [
    ...externalContentRules,
    ...textFormatRules
]

/**
 * Used for rendering ordered/unordered lists 
 * @type {ParsingRules} 
 */
const listRules = [
    [/^\s*(?:[-|\+|\*]|[{0-9}]+\.)\s+([^\n]+)/gm, "<li>$1</li>"], // Create list-items
    ...externalContentRules,
    ...textFormatRules,
]

/**
 * Replaces special html characters with escaped characters to
 * attempt prevention of possible Cross-Site scripting
 * 
 * Note: There may be other ways of scripting involving 
 *       the actual rendering process, so be careful!
 * 
 * @param {string} unsafe 
 * @returns {string}
 */
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
        .replace(/\\[^\n]/g, (match) => {
            return `&#${match.charCodeAt(1)};`;
        });
}

/**
 * Parses all elements on the page with classname "markdown" and
 * separates them into either markdown chunks or code-block chunks.
 */
function parseMarkdownElements() {
    const elements = document.querySelectorAll(".markdown");

    for (const e of elements) {
        const codeblockRegex = /(```[\S]*\r?\n[\s\S]*?```)/gm
        const listRegex = /^((?:\s*(?:[-\+\*]|[{0-9}]+\.)\s+[^\n]+\n?)+)/gm

        /** @type {String[]} */
        let splitText = e.textContent
            .split(codeblockRegex)
            .map(val => val.split(listRegex))
            .flat();

        /** @type {ElementContext[]} */
        let parsedLines = splitText.map((value) => {
            let renderMode = 0;

            if (codeblockRegex.test(value)) {
                renderMode = RenderModes.BLOCK;
            }
            else if (listRegex.test(value)) {
                renderMode = RenderModes.LIST;
            }

            return {
                innerText: value,
                renderingMode: renderMode,
            };
        });

        console.log(parsedLines);

        renderMarkdownElement(e, parsedLines);
    }
}

/**
 * Takes a given element and a list of it's lines parsed into a readable format
 * @param {Element} element 
 * @param {ElementContext[]} parsedLines
 */
async function renderMarkdownElement(element, parsedLines) {
    let finalHTML = "";

    for (const line of parsedLines) {
        let html = escapeHtml(line.innerText).trim();

        switch (line.renderingMode) {
            case RenderModes.BLOCK:
                html = html.replace(/```[\S]*(\r?\n[\s\S]*?)```/gm, '<pre>$1</pre>')
                break;
            case RenderModes.TABLE:
                for (const [rule, template] of tableRules) {
                    html = html.replace(rule, template);
                }
                break;
            case RenderModes.LIST:
                let isOrdered = /\s+[{1-9}]+\..*$/.test(html);
                for (const [rule, template] of listRules) {
                    html = html.replace(rule, template);
                }
                html = isOrdered ? `<ol>${html}</ol>` : `<ul>${html}</ul>`
                break;
            default:
            case RenderModes.NORMAL:
                for (const [rule, template] of markdownRules) {
                    html = html.replace(rule, template);
                }
        }

        finalHTML = finalHTML.concat(html);
    }

    element.innerHTML = finalHTML;
}

window.onload = () => {
    parseMarkdownElements()
}