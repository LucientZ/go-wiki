const articleContent = document.getElementById("article-content");
/**
 * 
 * @param {Element} element
 */
function renderPreview() {
    console.log(document.getElementById("article-preview").innerHTML);
    document.getElementById("article-preview").textContent = articleContent.value;
    parseMarkdownElements(); // From markdown.js
}

articleContent.addEventListener("input", renderPreview);
articleContent.addEventListener("propertychange", renderPreview);
