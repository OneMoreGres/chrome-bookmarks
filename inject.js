function getTags() {
  let tags = new Set([...document.body.querySelectorAll('a[rel="tag"]')].map(x => '#' + x.textContent.trim()))
  return Array.from(tags)
}

function editTitle(message, response) {
  let tags = getTags();
  let title = message.title + " " + tags.join(" ")
  let edited = window.prompt(chrome.i18n.getMessage("editPrompt"), [title]);
  if (edited == null || edited.length === 0) {
    response(null);
    return;
  }
  let outMessage = {command: "save", title: edited};
  response(outMessage)
}

function showError(message) {
  window.alert(message.text);
}

chrome.runtime.onMessage.addListener(function (message, sender, response) {
  if (message.command == "edit_title") {
    editTitle(message, response);
    return;
  }
  if (message.command == "error") {
    showError(message);
    return;
  }
});
