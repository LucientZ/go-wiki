/**
 * @typedef {Object} ElementContext
 * @property {"markdown" | "codeblock"} innerText
 * @property {boolean} isBlock   
 */

const markdownRules = [
    // Headers
    [/^#{6}\s+([^\n]+)/gm, "<h6>$1</h6>"],
    [/^#{5}\s+([^\n]+)/gm, "<h5>$1</h5>"],
    [/^#{4}\s+([^\n]+)/gm, "<h4>$1</h4>"],
    [/^#{3}\s+([^\n]+)/gm, "<h3>$1</h3>"],
    [/^#{2}\s+([^\n]+)/gm, "<h2>$1</h2>"],
    [/^#{1}\s+([^\n]+)/gm, "<h1>$1</h1>"],

    // Text Formatting
    [/([^\n]+[\S]+)\n?/gm, "<p>$1</p>"],                  // All loose text goes into paragraphs
    [/<p>(<h[1-6]>[^\n]+<\/h[1-6]>)\n?<\/p>/g, "$1"],     // Remove Headers inside paragraphs
    [/\*\*\*([ |\t|\r|\S]+)\*\*\*/g, "<i><b>$1</b></i>"], // *italics*
    [/\*\*([ |\t|\r|\S]+)\*\*/g, "<b>$1</b>"],            // **bold**
    [/\*([ |\t|\r|\S]+)\*/g, "<i>$1</i>"],                // ***bold and italics***
    [/`([ |\t|\r|\S]+)`/g, "<code>$1</code>"],            // `code`
    [/__([ |\t|\r|\S]+)__/g, "<u>$1</u>"],                // __underline__ 
    [/~~([ |\t|\r|\S]+)~~/g, "<s>$1</s>"],                // ~~strikethrough~~

    // Images
    [/\!\[([^)]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">'], // !(alt-text)[link]

    // Links
    [/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="text-decoration: none;">$1</a>',], // (Text)

]

/**
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
        .replace(/'/g, "&#039;");
}

/**
 * Parses all elements on the page with classname "markdown" and
 * separates them into either markdown chunks or code-block chunks.
 */
function parseMarkdownElements() {
    const elements = document.querySelectorAll(".markdown");

    for (const e of elements) {
        const codeblockRegex = /(```[\S]*\r?\n[\s\S]*?```)/gm

        /** @type {String[]} */
        let splitText = e.textContent.split(codeblockRegex);

        /** @type {ElementContext[]} */
        let parsedLines = splitText.map((value) => {
            return {
                innerText: value,
                isBlock: codeblockRegex.test(value),
            };
        });

        renderMarkdownElement(e, parsedLines);
    }
}

/**
 * Takes a given element and a list of it's lines parsed into a readable format
 * @param {Element} element 
 * @param {ElementContext[]} parsedLines
 */
function renderMarkdownElement(element, parsedLines) {
    let finalHTML = "";

    for (const line of parsedLines) {
        let html = escapeHtml(line.innerText).trim();
        if (line.isBlock) {
            html = html.replace(/```[\S]*(\r?\n[\s\S]*?)```/gm, '<pre>$1</pre>')
        }
        else {
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