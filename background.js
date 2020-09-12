var openedTab = null;
var completeCount = 0;

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
});

chrome.browserAction.onClicked.addListener(openMain);
