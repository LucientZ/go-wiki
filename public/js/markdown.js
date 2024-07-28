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
    [/([^\n]+[\S]+\n?)/g, `<p>$1</p>`]
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
        let html = escapeHtml(line.innerText);
        console.log(html)
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

    console.log(finalHTML)

    element.innerHTML = finalHTML;
}

window.onload = () => {
    parseMarkdownElements()
}