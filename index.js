
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
const modeSearchTags = 3;
const modeDuplicates = 4;

var currentComparer = null;
var comparerForMode = {};
var currentMode = modeBookmark;


function titleComparer(left, right) {
  return left.title < right.title;
}

function titleComparerInv(left, right) {
  return titleComparer(right, left);
}

function dateAddedComparer(left, right) {
  return left.node.dateAdded < right.node.dateAdded
    || (left.node.dateAdded == right.node.dateAdded && left.title < right.title);
}

function dateAddedComparerInv(left, right) {
  return dateAddedComparer(right, left);
}

function countComparer(left, right) {
  return left.count < right.count
    || (left.count == right.count && left.title < right.title);
}

function countComparerInv(left, right) {
  return countComparer(right, left);
}

function setTitleComparer() {
  currentComparer = currentComparer == titleComparerInv ? titleComparer : titleComparerInv;
  refreshSorting();
  refresh();
}

function setDateComparer() {
  currentComparer = currentComparer == dateAddedComparer ? dateAddedComparerInv : dateAddedComparer;
  refreshSorting();
  refresh();
}

function setCountComparer() {
  currentComparer = currentComparer == countComparer ? countComparerInv : countComparer;
  refreshSorting();
  refresh();
}

function insertSorted(items, item) {
  var left = 0;
  var right = items.length;

  while (left < right) {
    const mid = (left + right) >>> 1;
    if (!currentComparer(item, items[mid]))
      left = mid + 1;
    else
      right = mid;
  }

  items.splice(left, 0, item);
}

function refreshSorting() {
  const updateTitle = function (selector, text, down, up) {
    let div = document.querySelector(selector);
    div.text = chrome.i18n.getMessage(text);
    if (!(currentComparer == up || currentComparer == down)) {
      return;
    }
    div.text += String.fromCharCode(currentComparer == up ? 8593 : 8595);
  };
  updateTitle("#sortByName", "sortByName", titleComparer, titleComparerInv);
  updateTitle("#sortByDate", "sortByDate", dateAddedComparer, dateAddedComparerInv);
  updateTitle("#sortByCount", "sortByCount", countComparer, countComparerInv);
  comparerForMode[currentMode] = currentComparer;
}

function refresh() {
  if (currentMode == modeBookmark) doSearch();
  else if (currentMode == modeTags) showAllTags();
  else if (currentMode == modeSearchTags) showSearchTags();
  else showDuplicates();
}


function setBookmarksHtml(text) {
  document.querySelector("#bookmarks").innerHTML = text;
  document.querySelector("#tags").innerHTML = "";
}
function setTagsHtml(text) {
  document.querySelector("#tags").innerHTML = text;
  document.querySelector("#bookmarks").innerHTML = "";
}


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
  const matches = title.toLowerCase().match(/#(\S+)/g);
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
  if (li.id == "") return;
  var edited = window.prompt(chrome.i18n.getMessage("editPrompt"), [li.title]);
  if (edited == null) return;
  chrome.bookmarks.update(li.id, { 'title': edited });
  currentMode == modeBookmark ? doSearch() : showDuplicates();
}

function removeBookmark(event) {
  const li = getNthParent(event.target, 3);
  if (li.id == "") return;
  if (!window.confirm(chrome.i18n.getMessage("removePrompt", [li.title]))) return;
  chrome.bookmarks.remove(li.id);
  currentMode == modeBookmark ? doSearch() : showDuplicates();
}

function canHandleBookmark(node) {
  return node.url && node.url.substring(0, 11) != "javascript:";
}

function showBookmark(node, pathString, index, fullUrl = false) {
  if (!canHandleBookmark(node)) {
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

  var dateDiv = "";
  if (node.dateAdded) {
    const date = new Date(node.dateAdded);
    dateDiv = `<span class="dateAdded" title="${chrome.i18n.getMessage("dateAdded")}">\
    ${date.toLocaleDateString()}</span>`;
  }

  urlParser.href = node.url;

  const row1 = `<div>
  <img src="chrome://favicon/${node.url}" class="favicon"/>
  <a href=${node.url} class="title">${title}</a>
  <span class="paths">${folders}</span>
  <span class="tags">${tags}</span>
  ${dateDiv}
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

  const nodeTitle = node.title.replace(/"/g, '&quot;');
  return `<li class="bookmark hidden" id=${node.id} title="${nodeTitle}">
  ${row1}
  ${row2head}${row2mid}${row2tail}
  </li>`;
}

function getSearch() {
  var search = { folders: [], words: [], tags: [] };

  const searchString = document.querySelector('#search').value;
  if (searchString == '*') {
    search.words.push({ "re": new RegExp(".*"), "shouldMatch": true });
    return search;
  }

  searchString.split(' ').forEach(function (word) {
    const minWordLength = 2;
    if (word.length < minWordLength)
      return {};

    let shouldMatch = true;
    if (word[0] == '!') {
      shouldMatch = false;
      word = word.slice(1);
    }
    else if (word.startsWith('\\!')) {
      word = '!' + word.slice(2)
    }

    if (word.length < minWordLength)
      return {};

    const escaped = word
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/[*]/g, '[^' + word[0] + ']*')
      .replace(/[?]/g, '.');

    if (escaped[0] == '#') {
      let pattern = escaped;
      const isExact = escaped[escaped.length - 1] == '#';
      if (isExact) pattern = escaped.slice(0, escaped.length - 1) + '\\b';
      search.tags.push({ "re": new RegExp(pattern, 'i'), "shouldMatch": shouldMatch });
      return;
    }

    if (escaped[0] == '/') {
      let pattern = escaped;
      const isExact = escaped[escaped.length - 1] == '/';
      if (isExact) pattern = escaped.slice(0, escaped.length - 1) + '\\b';
      search.folders.push({ "re": new RegExp(pattern, 'i'), "shouldMatch": shouldMatch });
      return;
    }

    search.words.push({ "re": new RegExp(escaped, 'i'), "shouldMatch": shouldMatch });
  });

  return search;
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
      return prev && (word.shouldMatch == (node.title.search(word.re) != -1
        || node.url.search(word.re) != -1));
    }, true);
    if (!ok) return;
  }

  if (search.tags.length > 0) {
    const ok = search.tags.reduce(function (prev, tag) {
      return prev && (tag.shouldMatch == (node.title.search(tag.re) != -1));
    }, true);
    if (!ok) return;
  }

  if (search.folders.length > 0) {
    const ok = search.folders.reduce(function (prev, folder) {
      return prev && (folder.shouldMatch == (path.search(folder.re) != -1));
    }, true);
    if (!ok) return;
  }

  if (!canHandleBookmark(node)) return;

  const item = { 'node': node, 'title': node.title, 'path': path }
  insertSorted(state.items, item);
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

  if (search.folders.length == 0
    && search.words.length == 0
    && search.tags.length == 0) {
    document.querySelector('#bookmarks').innerHTML = '';
    updateServiceLabels(0, 0);
    return;
  }

  chrome.bookmarks.getTree(function (tree) {
    setMode(modeBookmark);
    let state = { 'items': [], 'total': 0 };
    tree.forEach(node => filterBookmarks(node, "", search, state));
    const text = state.items.reduce((sum, node, index) =>
      sum + showBookmark(node.node, node.path, index), "");
    setBookmarksHtml(`<ul>${text}</ul>`);
    updateBookmarkHandlers();
    updateServiceLabels(state.items.length, state.total);
    updateBookmarkVisibility();
  });
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

function updateBookmarkVisibility() {
  let container = document.querySelector("#bookmarks ul");
  if (container == null) return;
  let children = container.children;
  const height = window.innerHeight;
  const offset = 100;

  for (let i = 0; i < children.length; ++i) {
    let e = children[i];
    const rect = e.getBoundingClientRect();
    const isAbove = rect.bottom < -offset;
    const isBelow = rect.top > height + offset;
    const isHidden = e.classList.contains("hidden");

    if ((isAbove || isBelow) && !isHidden) {
      e.style.height = rect.height + "px";
      e.classList.add("hidden");
      continue;
    }

    if (isAbove) continue;
    if (isBelow) break;

    e.style.height = '';
    e.classList.remove("hidden");
  }
}

function openAll() {
  if (currentMode != modeBookmark) return;
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
  if (currentMode != modeBookmark) return;
  const items = document.querySelectorAll('.bookmark .title');
  if (index >= items.length) { return; }
  chrome.tabs.create({ 'url': items[index].href });
}

function editionTags() {
  const input = window.prompt(chrome.i18n.getMessage("newTagPrompt"), lastTag);
  if (input == null) return [];
  lastTag = input;

  const parts = input.split(/\s/);
  const tags = parts.reduce(function (sum, value) {
    if (value.length == 0) return sum;
    if (value[0] != '#') value = '#' + value;
    if (sum.indexOf(value) != -1) return sum;
    return sum.concat([value]);
  }, []);
  return tags;
}

function tagRegExp(tag) {
  return new RegExp('\\s*' + tag + '(\\s|$)');
}

function addTagToAll() {
  if (currentMode != modeBookmark) return;
  const tags = editionTags();
  if (tags.length == 0) return;

  var items = document.querySelectorAll('.bookmark');
  tags.forEach(tag => {
    var re = tagRegExp(tag);

    for (var i = 0; i < items.length; ++i) {
      var item = items[i];
      var id = item.getAttribute('id');
      var title = item.getAttribute('title');
      if (!id || !title || title.search(re) != -1) continue;
      title = title + ' ' + tag;
      item.setAttribute('title', title);
      chrome.bookmarks.update(id, { 'title': title });
    };
  });
  doSearch();
}

function removeTagFromAll() {
  if (currentMode != modeBookmark) return;
  const tags = editionTags();
  if (tags.length == 0) return;

  const items = document.querySelectorAll('.bookmark');
  tags.forEach(tag => {
    const re = tagRegExp(tag);

    for (var i = 0; i < items.length; ++i) {
      const item = items[i];
      const id = item.getAttribute('id');
      var title = item.getAttribute('title');
      if (!id || !title) continue;

      const index = title.search(re);
      if (index == -1) continue;
      title = title.replace(re, ' ');
      item.setAttribute('title', title);
      chrome.bookmarks.update(id, { 'title': title });
    };
  });
  doSearch();
}

function addFolderTags() {
  if (currentMode != modeBookmark) return;
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
  if (currentMode != modeBookmark) return;
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

function visualizeTags(tags) {
  let ordered = [];
  for (name in tags) {
    const item = { 'title': name, 'count': tags[name] };
    insertSorted(ordered, item);
  }
  const tagsHtml = ordered.reduce((sum, tag) =>
    sum + `<li><span class="tag">${tag.title}</span><span>${tag.count}</span></li>`,
    "");
  setTagsHtml(`<ul>${tagsHtml}</ul>`);
  document.querySelectorAll(".tag").forEach(tag => tag.onclick = addTagToFilter);
  updateServiceLabels(ordered.length, ordered.length);
}

function showAllTags() {
  chrome.bookmarks.getTree(function (tree) {
    setMode(modeTags);
    let tags = {};
    tree.forEach(node => parseTags(node, tags));
    visualizeTags(tags);
  });
}

function showSearchTags() {
  const search = getSearch();

  if (search.folders.length == 0
    && search.words.length == 0
    && search.tags.length == 0) {
    return;
  }

  chrome.bookmarks.getTree(function (tree) {
    setMode(modeSearchTags);
    let state = { 'items': [], 'total': 0 };
    tree.forEach(node => filterBookmarks(node, "", search, state));
    let tags = {};
    state.items.forEach(item => parseTags(item.node, tags));
    visualizeTags(tags);
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
    setMode(modeDuplicates);
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
    setBookmarksHtml(`<ul>${html}</ul>`);
    updateBookmarkHandlers(showDuplicates);
    updateServiceLabels(count, 0);
    updateBookmarkVisibility();
  });
}

function findExactDuplicates(node, path, duplicates) {
  if (!node.children) return;

  let existing = {};
  const newPath = path + '/' + node.title;
  node.children.forEach(function (child) {
    if (child.children) {
      findExactDuplicates(child, newPath, duplicates);
      return;
    }
    if (!child.url) return;
    if (!existing.hasOwnProperty(child.title)) {
      existing[child.title] = {};
      existing[child.title][child.url] = true;
      return;
    }
    if (existing[child.title][child.url] !== undefined) {
      const item = { 'node': child, 'title': child.title, 'path': newPath };
      insertSorted(duplicates, item);
      return;
    }
  });
}

function removeDuplicates() {
  chrome.bookmarks.getTree(function (tree) {
    setMode(modeDuplicates);
    currentComparer = currentComparer == titleComparerInv ? titleComparer : titleComparerInv;
    let duplicates = [];
    tree.forEach(node => findExactDuplicates(node, '', duplicates));
    const html = duplicates.reduce(function (sum, node) {
      chrome.bookmarks.remove(node.node.id);
      return sum + showBookmark(node.node, node.path, 999, true);
    }, "");
    setBookmarksHtml(`<ul>${html}</ul>`);
    updateBookmarkHandlers(showDuplicates);
    updateServiceLabels(duplicates.length, 0);
    updateBookmarkVisibility();
  });
}

function setMode(mode) {
  currentMode = mode;
  let controls = document.querySelectorAll("#open-all, #add-tag, #remove-tag, \
  #add-folder-tags, #move-to-folder, #show-search-tags");
  controls.forEach(node => node.classList.toggle("disabled", currentMode != modeBookmark));

  const showingTags = currentMode == modeTags || currentMode == modeSearchTags;
  document.querySelector("#bookmarks").style.visibility = showingTags ? "hidden" : "visible";
  document.querySelector("#tags").style.visibility = showingTags ? "visible" : "hidden";

  const canSort = currentMode != modeDuplicates;
  const canSortByName = canSort;
  let byName = document.querySelector("#sortByName");
  byName.classList.toggle("disabled", !canSortByName);
  byName.onclick = canSortByName ? setTitleComparer : null;

  const canSortByDate = canSort && currentMode == modeBookmark;
  let byDate = document.querySelector("#sortByDate");
  byDate.classList.toggle("disabled", !canSortByDate);
  byDate.onclick = canSortByDate ? setDateComparer : null;

  const canSortByCount = canSort && showingTags;
  let byCount = document.querySelector("#sortByCount");
  byCount.classList.toggle("disabled", !canSortByCount);
  byCount.onclick = canSortByCount ? setCountComparer : null;

  currentComparer = comparerForMode[currentMode];
  if (currentComparer == null) currentComparer = titleComparerInv;
  refreshSorting();
}

function init() {
  localizeHtmlPage();

  var currentId = null;
  chrome.tabs.query({ currentWindow: true, active: true }, function (tabs) {
    if (tabs.length == 0) return;
    currentId = tabs[0].id;
    document.querySelector('#search').focus();
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
  document.querySelector('#show-search-tags').onclick = showSearchTags;
  document.querySelector('#show-duplicates').onclick = showDuplicates;
  document.querySelector('#remove-duplicates').onclick = removeDuplicates;

  window.onscroll = updateBookmarkVisibility;

  setMode(modeBookmark);

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
