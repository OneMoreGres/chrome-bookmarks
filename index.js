
var lastTag = "";
var lastFolder = "";
const panelId = '1';
const otherId = '2';

function cleanName(title) {
  const index = title.indexOf('#');
  if (index != -1)
    title = title.slice(0, index);
  return title;
}

function getTags(title) {
  const matches = title.toLowerCase().match(/#([\d-\w]+)/g);
  const result = matches ? matches : [];
  return result;
}

function addFolderToFilter(folder) {
  const addition = ' /' + folder;
  return function () {
    document.querySelector('#search').value += addition;
    doSearch();
  }
}

function addTagToFilter(tag) {
  const addition = ' ' + tag;
  return function () {
    document.querySelector('#search').value += addition;
    doSearch();
  }
}

function editBookmark(nodeToEdit) {
  let node = nodeToEdit;
  return function () {
    var edited = window.prompt(chrome.i18n.getMessage("editPrompt"), node.title);
    if (edited == null) return;
    chrome.bookmarks.update(node.id, { 'title': edited });
    doSearch();
  }
}

function removeBookmark(nodeToRemove) {
  let node = nodeToRemove;
  return function () {
    if (!window.confirm(chrome.i18n.getMessage("removePrompt", [node.title]))) {
      return;
    }
    chrome.bookmarks.remove(node.id);
    doSearch();
  }
}

function showBookmark(parent, counts, node, pathString) {
  if (!node.url || node.url.substring(0, 11) == "javascript:") {
    return false;
  }

  var icon = document.createElement('img');
  icon.src = 'chrome://favicon/' + node.url;
  icon.className = 'favicon';

  var title = document.createElement('a');
  title.href = node.url;
  if (counts.matched < 10) {
    const hotkeyNumber = counts.matched < 9 ? counts.matched + 1 : 0;
    title.text = hotkeyNumber + '. ' + cleanName(node.title);
  }
  else {
    title.text = cleanName(node.title);
  }
  title.className = 'title';

  var paths = document.createElement('span');
  pathString.split('/').forEach(function (text) {
    if (text.length == 0) return;
    var path = document.createElement('span');
    path.innerHTML = text;
    path.className = 'path';
    paths.appendChild(path);
    path.onclick = addFolderToFilter(text);
  });
  paths.className = 'paths';

  var hostname = document.createElement('span');
  hostname.innerHTML = title.hostname;
  hostname.className = 'hostname';
  var pathname = document.createElement('span');
  pathname.innerHTML = title.pathname;
  pathname.className = 'pathname';
  var url = document.createElement('span');
  url.className = 'url';
  url.appendChild(hostname);
  url.appendChild(pathname);

  var tags = document.createElement('span');
  getTags(node.title).forEach(function (text) {
    var tag = document.createElement('span');
    tag.innerHTML = text;
    tag.className = "tag";
    tags.appendChild(tag);
    tag.onclick = addTagToFilter(text);
  });
  tags.className = "tags";

  var controls = document.createElement('span');
  controls.className = "controls";

  var edit = document.createElement('span');
  edit.innerHTML = chrome.i18n.getMessage("editButton");
  edit.className = "edit";
  edit.onclick = editBookmark(node);
  controls.appendChild(edit);

  var remove = document.createElement('span');
  remove.innerHTML = chrome.i18n.getMessage("removeButton");
  remove.className = "remove";
  remove.onclick = removeBookmark(node);
  controls.appendChild(remove);

  var row1 = document.createElement('div');
  var row2 = document.createElement('div');

  row1.appendChild(icon);
  row1.appendChild(title);
  row1.appendChild(paths);
  row1.appendChild(tags);
  row1.appendChild(controls);
  row2.appendChild(url);

  var bookmark = document.createElement('li');
  bookmark.className = "bookmark";
  bookmark.setAttribute('id', node.id);
  bookmark.setAttribute('title', node.title);
  bookmark.appendChild(row1);
  bookmark.appendChild(row2);

  parent.appendChild(bookmark);
  return true;
}

function getSearch() {
  var search = { folders: [], words: [] };

  const words = document.querySelector('#search').value.split(' ');
  const folderRe = /^\/.*$/;
  words.forEach(function (word) {
    if (word.length == 0
      || (word.length == 1 && (word == '/' || word == '#')))
      return;
    if (folderRe.test(word)) {
      search.folders.push(word);
    }
    else {
      search.words.push(word);
    }
  });

  return search;
}

function updateServiceLabels(bookmarks, totalCount) {
  var noResults = document.querySelector('#no-results');
  const count = bookmarks !== null ? bookmarks.childNodes.length : 0;
  document.querySelector("#foundCount").innerHTML = count + '/' + totalCount;
  if (count > 0) {
    noResults.style.display = 'none';
  }
  else {
    noResults.style.display = 'block';
  }
}

function doSearch() {
  var bookmarks = document.querySelector('#bookmarks');
  bookmarks.innerHTML = '';

  const search = getSearch();

  const noFolders = search.folders.length == 0;
  const minWordLength = 2;
  const noWords = search.words.length == 0 ||
    (search.words.length == 1 && search.words[0].length < minWordLength);
  if (noFolders && noWords) {
    updateServiceLabels(null, '?');
    return;
  }

  const filter = function (list, counts, node, path) {
    if (!node.url) {
      if (node.children) {
        const newPath = path + node.title + '/';
        node.children.forEach(node => filter(list, counts, node, newPath));
      }
    }
    else {
      ++counts.total;
      if (search.words.length > 0) {
        const ok = search.words.reduce(function (prev, word) {
          if (!prev) return false;
          const isTag = (word[0] == '#');
          if (isTag) {
            if (word[word.length - 1] == '#') {
              word = word.slice(0, word.length - 1) + ' ';
              return (node.title + ' ').indexOf(word) != -1;
            }
            else {
              return node.title.indexOf(word) != -1;
            }
          }
          else {
            return (node.title.indexOf(word) != -1
              || node.url.indexOf(word) != -1);
          }
        }, true);
        if (!ok) return;
      }

      if (search.folders.length > 0) {
        const ok = search.folders.reduce(function (prev, folder) {
          return prev && path.indexOf(folder) != -1;
        }, true);
        if (!ok) return;
      }

      if (showBookmark(list, counts, node, path)) {
        ++counts.matched;
      }
    }
  }

  chrome.bookmarks.getTree(function (tree) {
    let list = document.createElement('ul');
    let counts = { 'total': 1, 'matched': 0 };
    tree.forEach(node => filter(list, counts, node, ""));
    bookmarks.innerHTML = '';
    bookmarks.appendChild(list);
    updateServiceLabels(list, counts.total);
  });
}

function openAll() {
  const items = document.querySelectorAll('.bookmark .title');
  if (items.length > 15) {
    if (!window.confirm(chrome.i18n.getMessage("openAllPrompt", [items.length]))) {
      return;
    }
  }
  for (var i = 0; i < items.length; ++i) {
    chrome.tabs.create({ 'url': items[i].href });
  };
}

function openNthLink(index) {
  const items = document.querySelectorAll('.bookmark .title');
  if (index >= items.length) { return; }
  chrome.tabs.create({ 'url': items[index].href });
}

function editionTag() {
  var tag = window.prompt(chrome.i18n.getMessage("newTagPrompt"), lastTag);
  if (tag == null) return '';
  if (tag[0] != '#') tag = '#' + tag;
  if (tag.length == 1) return '';
  lastTag = tag;
  return tag;
}

function tagRegExp(tag) {
  return new RegExp('\\s*' + tag + '(\\s|$)');
}

function addTagToAll() {
  const tag = editionTag();
  if (tag.length == 0) return;
  var re = tagRegExp(tag);

  var items = document.querySelectorAll('.bookmark');
  for (var i = 0; i < items.length; ++i) {
    var item = items[i];
    var id = item.getAttribute('id');
    var title = item.getAttribute('title');
    if (!id || !title || title.search(re) != -1) continue;
    chrome.bookmarks.update(id, { 'title': title + ' ' + tag });
  };
  doSearch();
}

function removeTagFromAll() {
  const tag = editionTag();
  if (tag.length == 0) return;
  const re = tagRegExp(tag);

  const items = document.querySelectorAll('.bookmark');
  for (var i = 0; i < items.length; ++i) {
    const item = items[i];
    const id = item.getAttribute('id');
    var title = item.getAttribute('title');
    if (!id || !title) continue;

    const index = title.search(re);
    if (index == -1) continue;
    title = title.replace(re, ' ');
    chrome.bookmarks.update(id, { 'title': title });
  };
  doSearch();
}

function addFolderTags() {
  const items = document.querySelectorAll('.bookmark');
  for (var i = 0; i < items.length; ++i) {
    const item = items[i];
    const id = item.getAttribute('id');
    var title = item.getAttribute('title');
    if (!id || !title) continue;

    var changed = false;
    const paths = item.querySelectorAll('.path');
    for (var ii = 0; ii < paths.length; ++ii) {
      const path = paths[ii].innerHTML;
      if (path.indexOf(' ') != -1) continue; // spaces are forbidden
      const re = tagRegExp(path);
      const index = title.search(re);
      if (index != -1) continue;
      title = title + ' #' + path;
      changed = true;
    }

    if (changed && title.length > 0) {
      chrome.bookmarks.update(id, { 'title': title });
    }

  };
  doSearch();
}

function moveToFolder() {
  let items = document.querySelectorAll('.bookmark');
  if (items.length == 0) return;

  let folder = window.prompt(chrome.i18n.getMessage("targetFolderPrompt"), lastFolder);
  if (folder == null) return;
  if (folder[0] != '/') folder = '/' + folder;
  if (folder.length == 1) return;
  lastFolder = folder;

  let find = function (node, parentPath) {
    if (node.url != null) return null;
    let currentPath = parentPath;
    if (node.id != otherId) currentPath += '/' + node.title;
    if (currentPath == folder) return node;
    for (let i in node.children) {
      let found = find(node.children[i], currentPath);
      if (found != null) return found;
    }
    return null;
  }

  chrome.bookmarks.getSubTree(otherId, function (nodes) {
    for (let i in nodes) {
      let newParent = find(nodes[i], "");
      if (newParent != null) {
        items.forEach(item => {
          if (item.parentId == newParent.id) return;
          chrome.bookmarks.move(item.id, { parentId: newParent.id });
        });

        document.querySelector('#search').value = folder;

        doSearch();
        return;
      }
    }
    console.log("no folder found", folder);
  });
}

function localizeHtmlPage() {
  //Localize by replacing __MSG_***__ meta tags
  var objects = document.getElementsByTagName('html');
  for (var j = 0; j < objects.length; j++) {
    var obj = objects[j];

    var valStrH = obj.innerHTML.toString();
    var valNewH = valStrH.replace(/__MSG_(\w+)__/g, function (match, v1) {
      return v1 ? chrome.i18n.getMessage(v1) : "";
    });

    if (valNewH != valStrH) {
      obj.innerHTML = valNewH;
    }
  }
}

function init() {
  localizeHtmlPage();

  document.querySelector('#search').oninput = doSearch;
  document.querySelector('#search').onfocus = function () {
    this.select();
    doSearch();
  };

  document.querySelector('#open-all').onclick = openAll;
  document.querySelector('#add-tag').onclick = addTagToAll;
  document.querySelector('#remove-tag').onclick = removeTagFromAll;
  document.querySelector('#add-folder-tags').onclick = addFolderTags;
  document.querySelector('#move-to-folder').onclick = moveToFolder;

  document.onkeydown = function (e) {
    if (!e.ctrlKey) { return; }

    if (e.keyCode == 13) { // enter
      openAll();
      return false;
    }

    if (e.keyCode >= 48 && e.keyCode <= 57) { // 0 - 9
      let index = e.keyCode - 49;
      openNthLink(index >= 0 ? index : 9);
      return false;
    }
  };
};

init();
