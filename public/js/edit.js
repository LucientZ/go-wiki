const articleContent = document.getElementById("article-content");
let changesMade = false;
/**
 * 
 * @param {Element} element
 */
function renderPreview() {
    document.getElementById("article-preview").textContent = articleContent.value;
    parseMarkdownElements(); // From markdown.js
}

articleContent.addEventListener("input", () => {
    if (!changesMade) {
        document.title = `* ${document.title}`
        changesMade = true;
        console.log(changesMade)
    }

    renderPreview();
});

// Capture ctrl+s or cmd+s to save the article
document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        document.getElementById("edit-form").submit();
    }
});
