
/**
 * 
 * @param {string} filename 
 * @param {string} content 
 */
function download(filename, content) {
    if (!filename.endsWith('.png')) {
        content = new Blob([content], { type: 'text/plain' });
        content = window.URL.createObjectURL(content)
    }
    let a = document.createElement('a');
    a.href = content;
    a.download = match[1];
    a.textContent = 'Download file!';
    a.click();
}

function upload(handleFiles) {
    let input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.style.display = 'none'
    input.addEventListener("change", function (e) {
        handleFiles(this.files);
    }, false);
    input.click();
}

export { download,upload };