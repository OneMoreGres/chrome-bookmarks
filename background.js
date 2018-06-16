var openedTab = null;

function openMain() {
    if (openedTab != null) {
        chrome.tabs.update(openedTab, { highlighted: true });
    }
    else {
        let url = chrome.extension.getURL('index.html');
        chrome.tabs.create({ 'url': url }, function (tab) {
            openedTab = tab.id;
        });
    }
}

chrome.tabs.onRemoved.addListener(function (tabId) {
    if (tabId == openedTab) {
        openedTab = null;
    }
});

chrome.browserAction.onClicked.addListener(openMain);