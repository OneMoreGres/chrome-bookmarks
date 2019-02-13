
var lastTag = "";
var lastFolder = "";
const panelId = '1';
const otherId = '2';
var urlParser = document.createElement('a');
var searchTimeout = null;
const searchDelay = 200; //ms
var delaySearch = true;
const modeBookmark = 1;
const modeTags = 2;
const modeDublicates = 3;
var currentMode = modeBookmark;

function getNthParent(element, i) {
  while (i > 0) {
    element = element.parentElement;
    --i;
  }
  return element;
}

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

function addFolderToFilter(event) {
  document.querySelector('#search').value += ' /' + event.target.innerText;
  doSearch();
}

function addTagToFilter(event) {
  document.querySelector('#search').value += ' ' + event.target.innerText;
  doSearch();
}

function editBookmark(event) {
  const li = getNthParent(event.target, 3);
  if (!(li.id > 0)) return;
  var edited = window.prompt(chrome.i18n.getMessage("editPrompt"), [li.title]);
  if (edited == null) return;
  chrome.bookmarks.update(li.id, { 'title': edited });
  currentMode == modeBookmark ? doSearch() : showDuplicates();
}

function removeBookmark(event) {
  const li = getNthParent(event.target, 3);
  if (!(li.id > 0)) return;
  if (!window.confirm(chrome.i18n.getMessage("removePrompt", [li.title]))) return;
  chrome.bookmarks.remove(li.id);
  currentMode == modeBookmark ? doSearch() : showDuplicates();
}

function showBookmark(node, pathString, index, fullUrl = false) {
  if (!node.url || node.url.substring(0, 11) == "javascript:") {
    return "";
  }

  var title;
  if (index < 10) {
    const hotkeyNumber = index < 9 ? index + 1 : 0;
    title = hotkeyNumber + '. ' + cleanName(node.title);
  }
  else {
    title = cleanName(node.title);
  }

  var folders = "";
  pathString.split('/').forEach(function (text) {
    if (text.length == 0) return;
    folders += `<span class="path">${text}</span>`;
  });

  var tags = "";
  getTags(node.title).forEach(function (text) {
    if (text.length == 0) return;
    tags += `<span class="tag">${text}</span>`;
  });

  urlParser.href = node.url;

  const row1 = `<div>
  <img src="chrome://favicon/${node.url}" class="favicon"/>
  <a href=${node.url} class="title">${title}</a>
  <span class="paths">${folders}</span>
  <span class="tags">${tags}</span>
  <span class="controls">
   <span class="edit">${chrome.i18n.getMessage("editButton")}</span>
   <span class="remove">${chrome.i18n.getMessage("removeButton")}</span>
  </span>
  </div>`;

  const row2head = `<div>
  <span class="url" title="${node.url}">
   <span class="hostname">${urlParser.hostname}</span>
   <span class="pathname">${urlParser.pathname}</span>`;
  const row2mid = fullUrl
    ? `<span class="restUrl">${urlParser.hash}${urlParser.search}</span>`
    : '';
  const row2tail = `
  </span>
  </div>`;

  return `<li class="bookmark" id=${node.id} title="${node.title}">
  ${row1}
  ${row2head}${row2mid}${row2tail}
  </li>`;
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

function updateServiceLabels(matched, total) {
  document.querySelector("#foundCount").innerHTML = matched + '/' + total;
  var noResults = document.querySelector('#no-results');
  if (matched > 0) {
    noResults.style.display = 'none';
  }
  else {
    noResults.style.display = 'block';
  }
}

function updateBookmarkHandlers() {
  document.querySelectorAll(".bookmark .path").forEach(e => e.onclick = addFolderToFilter);
  document.querySelectorAll(".bookmark .tag").forEach(e => e.onclick = addTagToFilter);
  document.querySelectorAll(".bookmark .edit").forEach(e => e.onclick = editBookmark);
  document.querySelectorAll(".bookmark .remove").forEach(e => e.onclick = removeBookmark);
}

function filterBookmarks(node, path, search, state) {
  if (!node.url) {
    if (node.children) {
      const newPath = path + node.title + '/';
      node.children.forEach(node => filterBookmarks(node, newPath, search, state));
    }
    return;
  }

  ++state.total;
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

  const added = showBookmark(node, path, state.index);
  if (added.length > 0) {
    state.text += added;
    ++state.index;
  }
}

function doSearch() {
  if (delaySearch) {
    if (searchTimeout != null) { clearTimeout(searchTimeout); }
    searchTimeout = setTimeout(function () { delaySearch = false; doSearch(); },
      searchDelay);
    return;
  }
  delaySearch = true;

  const search = getSearch();

  const noFolders = search.folders.length == 0;
  const minWordLength = 2;
  const noWords = search.words.length == 0 ||
    (search.words.length == 1 && search.words[0].length < minWordLength);
  if (noFolders && noWords) {
    document.querySelector('#bookmarks').innerHTML = '';
    updateServiceLabels(0, 0);
    return;
  }

  chrome.bookmarks.getTree(function (tree) {
    currentMode = modeBookmark;
    let state = { 'text': '', 'index': 0, 'total': 0 };
    tree.forEach(node => filterBookmarks(node, "", search, state));
    document.querySelector('#bookmarks').innerHTML = `<ul>${state.text}</ul>`;
    updateBookmarkHandlers();
    updateServiceLabels(state.index, state.total);
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

function parseTags(node, tags) {
  if (node.url) {
    getTags(node.title).forEach(tag =>
      tags[tag] = tags.hasOwnProperty(tag) ? tags[tag] + 1 : 1);
    return;
  }
  if (node.children) {
    node.children.forEach(node => parseTags(node, tags));
  }
}

function showAllTags() {
  chrome.bookmarks.getTree(function (tree) {
    currentMode = modeTags;
    let tags = {};
    tree.forEach(node => parseTags(node, tags));
    const tagNames = Object.keys(tags).sort();
    const tagsHtml = tagNames.reduce((sum, name) =>
      sum + `<li class="tagOnly"><span class="tag">${name}</span><span>${tags[name]}</span></li>`,
      "");
    document.querySelector("#bookmarks").innerHTML = `<ul>${tagsHtml}</ul>`;
    document.querySelectorAll(".tag").forEach(tag => tag.onclick = addTagToFilter);
    updateServiceLabels(tagNames.length, tagNames.length);
  });
}

function findDuplicates(node, path, state) {
  if (node.url) {
    urlParser.href = node.url;
    const key = urlParser.hostname + urlParser.pathname;
    node.path = path;
    state.hasOwnProperty(key) ? state[key].push(node) : state[key] = [node];
    return;
  }

  if (node.children) {
    const newPath = path + node.title + '/';
    node.children.forEach(node => findDuplicates(node, newPath, state));
  }
}

function showDuplicates() {
  chrome.bookmarks.getTree(function (tree) {
    currentMode = modeDublicates;
    let state = {};
    tree.forEach(node => findDuplicates(node, "", state));
    const names = Object.keys(state).sort();
    let count = 0;
    const html = names.reduce(function (sum, name) {
      const nodes = state[name];
      if (nodes.length < 2) return sum;
      count += nodes.length;
      return sum + nodes.reduce((sum, node) =>
        sum + showBookmark(node, node.path, 999, true), "");
    }, "");
    document.querySelector("#bookmarks").innerHTML = `<ul>${html}</ul>`;
    updateBookmarkHandlers(showDuplicates);
    updateServiceLabels(count, 0);
  });
}

function init() {
  localizeHtmlPage();

  var currentId = null;
  chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
    if (tabs.length == 0) return;
    currentId = tabs[0].id;
  });
  chrome.tabs.onActivated.addListener(function (tab) {
    if (currentId != tab.tabId) return;
    document.querySelector('#search').focus();
  });

  document.querySelector('#search').oninput = doSearch;
  document.querySelector('#open-all').onclick = openAll;
  document.querySelector('#add-tag').onclick = addTagToAll;
  document.querySelector('#remove-tag').onclick = removeTagFromAll;
  document.querySelector('#add-folder-tags').onclick = addFolderTags;
  document.querySelector('#move-to-folder').onclick = moveToFolder;
  document.querySelector('#show-all-tags').onclick = showAllTags;
  document.querySelector('#show-duplicates').onclick = showDuplicates;

  document.onkeydown = function (e) {
    if (!e.ctrlKey || currentMode != modeBookmark) { return; }

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
