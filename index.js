
function cleanName(title) {
    var index = title.indexOf('#');
    if (index != -1)
        title = title.slice(0, index);
	return title;
}

function getTags(title) {
    var matches = title.toLowerCase().match(/#([\d\w]+)/g);
    var result = matches ? matches : [];
	return result;
}

function showBookmark(parent, node, pathString) {
	if (!node.url || node.url.substring(0, 11) == "javascript:") {
		return;
    }

    var icon = document.createElement('img');
    icon.src = 'chrome://favicon/' + node.url;
    icon.className = 'favicon';
    
    var title = document.createElement('a');
    title.href = node.url;
    title.text = cleanName(node.title);
    title.className = 'title';

    var paths = document.createElement('span');
    pathString.split('/').forEach(function(text) {
        if (text.length == 0) return;
        var path = document.createElement('span');
        path.innerHTML = text;
        path.className = 'path';
        paths.appendChild(path);
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

    var tags = document.createElement('span');;
    getTags(node.title).forEach(function(text) {
        var tag = document.createElement('span');;
        tag.innerHTML = text;
        tag.className = "tag";
        tags.appendChild(tag);
    });
    tags.className = "tags";

    var row1 = document.createElement('div');;
    var row2 = document.createElement('div');;
    
    row1.appendChild(icon);
    row1.appendChild(title);
    row1.appendChild(paths);
    row1.appendChild(tags);
    row2.appendChild(url);

    var bookmark = document.createElement('li');;
    bookmark.className = "bookmark";
    bookmark.setAttribute('id', node.id);
    bookmark.setAttribute('title', node.title);
    bookmark.appendChild(row1);
    bookmark.appendChild(row2);

	parent.appendChild(bookmark);
}

function getSearch () {
    var search = {folders: [], words: []};
    
    var words = document.querySelector('#search').value.split(' ');
    var folderRe = /^\/.*$/;
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

function doSearch() {
    var bookmarks = document.querySelector('#bookmarks');
    bookmarks.innerHTML = '';
    
    var search = getSearch();    

    var noResults = document.querySelector('#no-results');
    if (search.folders.length == 0 && search.words.length == 0) {
        noResults.style.display = 'block';
        return;
    }

    var list = document.createElement('ul');
	var filter = function (node, path) {
		if (!node.url) {
			if (node.children) {
                var newPath = path + node.title + '/';
				node.children.forEach(node => filter(node, newPath));
			}
		}
        else {
            if (search.words.length > 0) {
                var ok = search.words.reduce(function (prev, word) {
                    if (!prev) return false;
                    var isTag = (word[0] == '#');
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
                var ok = search.folders.reduce(function (prev, folder) {
                    return prev && path.indexOf(folder) != -1;
                }, true);
                if (!ok) return;
            }

            showBookmark(list, node, path);
        }
    }
    
	chrome.bookmarks.getTree(function (tree) {
		tree.forEach(node => filter(node, ""));
    });
    
    bookmarks.appendChild(list);
    if (bookmarks.firstChild.children.length > 0) {
        noResults.style.display = 'block';
    }
    else {
        noResults.style.display = 'none';
    }
}

function openAll () {
    var items = document.querySelectorAll('.bookmark .title');
    for (var i = 0; i < items.length; ++i) {
        chrome.tabs.create({ 'url': items[i].href });
    };
}

function editionTag () {
    var tag = document.querySelector("#tag-input").value;
    if (tag.length == 0) return '';
    if (tag[0] != '#') tag = '#' + tag;
    if (tag.length == 1) return '';
    return tag;
}

function tagRegExp (tag) {
    return new RegExp('\s*' + tag + '\s*');
}

function addTagToAll () {
    var tag = editionTag();
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

function removeTagFromAll () {
    var tag = editionTag();
    if (tag.length == 0) return;
    var re = tagRegExp(tag);

    var items = document.querySelectorAll('.bookmark');
    for (var i = 0; i < items.length; ++i) {
        var item = items[i];
        var id = item.getAttribute('id');
        var title = item.getAttribute('title');
        if (!id || !title) continue;

        var index = title.search(re);
        if (index == -1) continue;
        title = title.replace(re, ' ');
        chrome.bookmarks.update(id, { 'title': title });
    };
    doSearch();
}

function init () {
    document.querySelector('#search').oninput = function() { 
		  doSearch();
    };
    document.querySelector('#search').onfocus = function() { 
		  this.select();
      doSearch();
    };
    document.querySelector('#tag-input').onfocus = function() { 
		  this.select();
    };
    document.querySelector('#add-tag').onclick = addTagToAll;
    document.querySelector('#remove-tag').onclick = removeTagFromAll;
};

init();