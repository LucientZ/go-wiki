const titleEditor = document.getElementById("title-editor");
const contentEditor = document.getElementById("content-editor");
let changesMade = false;
/**
 * 
 * @param {Element} element
 */
function renderPreview() {
    document.getElementById("article-preview").textContent = contentEditor.value;
    parseMarkdownElements(); // From markdown.js
}

contentEditor.addEventListener("input", () => {
    if (!changesMade) {
        document.title = `* ${document.title}`
        changesMade = true;
    }

    renderPreview();
});

titleEditor.addEventListener("input", () => {
    document.getElementById("title-preview").innerText = `${titleEditor.value} (Preview)`
});

// Capture ctrl+s or cmd+s to save the article
document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        document.getElementById("edit-form").submit();
    }
});
