var openedTab = null;
var completeCount = 0;
var injectedTabs = new Set();

function openMain() {
  if (openedTab != null) {
    chrome.tabs.update(openedTab, { highlighted: true });
  }
  else {
    let url = chrome.extension.getURL('index.html');
    chrome.tabs.create({ 'url': url }, function (tab) {
      openedTab = tab.id;
      completeCount = 0;
    });
  }
}

chrome.tabs.onUpdated.addListener(function (tabId, change, tab) {
  if (tabId == openedTab) {
    if (change.status == "complete")
      completeCount += 1;
    if (completeCount > 1) // url changed? precise check requires "tabs" permission
      openedTab = null;
  }
});

chrome.tabs.onRemoved.addListener(function (tabId) {
  if (tabId == openedTab) {
    openedTab = null;
  }
  injectedTabs.delete(tabId);
});

chrome.browserAction.onClicked.addListener(openMain);

function suggestTags(tab) {
  chrome.bookmarks.search({ "url": tab.url }, function (bookmarks) {
    if (bookmarks.length != 1) {
      let message = { command: "error", text: "Not in bookmarks or multiple bookmarks" };
      chrome.tabs.sendMessage(tab.id, message)
      return;
    }

    let bookmark = bookmarks[0];
    let message = { command: "edit_title", title: bookmark.title };
    chrome.tabs.sendMessage(tab.id, message, function (response) {
      if (response !== null)
        chrome.bookmarks.update(bookmark.id, { title: response.title })
    })
  });
}

function handleCommand(command, tab) {
  if (command == "suggest_tags") {
    suggestTags(tab);
  }
}

chrome.commands.onCommand.addListener(function (command) {
  chrome.tabs.query({ active: true }, function (tabs) {
    if (tabs.length != 1)
      return;

    let tab = tabs[0];
    if (injectedTabs.has(tab.id)) {
      handleCommand(command, tab);
    }
    else {
      chrome.tabs.executeScript(tab.id, { file: 'inject.js' }, function () {
        injectedTabs.add(tab.id);
        handleCommand(command, tab);
      });
    }

  });
});
