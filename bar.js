"use strict";

/** Removes all children from a DOM node. */
const removeAllChildren = function(node) {
	// node.parentNode.replaceChild(node.cloneNode(false), node);
	while (node.lastChild) node.removeChild(node.lastChild);
};

const withoutTransition = function(element, callback) {
	element.classList.add("notransition");
	callback();
	element.offsetHeight; // Flush CSS changes with a reflow
	element.classList.remove("notransition");
};

const bar = document.createElement("div");
bar.classList.add("download-bar");
document.addEventListener("DOMContentLoaded", event => {
   document.body.appendChild(bar);
});

let portBS = browser.runtime.connect();
setupPortListeners(portBS);

/** Map of active download nodes by the download id. */
let downloadNodes = {};

class DownloadNode {
	constructor(download) {
		this.id = download.id;
		this.download = download;

		let barItem = this.barItem = document.createElement("div");
		barItem.classList.add("download-bar-item");
		barItem.dataset.id = this.id;

		let iconNode = this.iconNode = new Image(16, 16);
		barItem.appendChild(iconNode);

		let textNode = this.nameNode = document.createElement("span");
		barItem.appendChild(textNode);

		barItem.addEventListener("click", event => {
			portBS.postMessage({
				type: MessageType.openDownload,
				downloadId: this.download.id
			});
		});

		withoutTransition(this.barItem, this.update.bind(this));
	}

	get element() { return this.barItem; }

	setName(name) {
		this.nameNode.textContent = name;
	}

	setIconUrl(url) {
		this.iconNode.src = url;
	}

	updateProgress() {
		let percentage;
		if (this.download.state === "complete") {
			percentage = 100;
		} else if (this.download.totalBytes === -1) {
			percentage = 0;
		} else {
			percentage = 100 * this.download.bytesReceived / this.download.totalBytes;
		}
		this.barItem.style.backgroundPosition = "-" + percentage + "% 0";
	}

	update() {
		this.setName(getFileNameFromPath(this.download.filename));
		this.setIconUrl(this.download.iconUrl);
		this.updateProgress();
	}

	handleChanges(delta) {
		for (let i in delta) {
			if (delta.hasOwnProperty(i)) {
				this.download[i] = delta[i];
			}
		}
		this.update();
	}

	removeFromBar() {
		this.barItem.addEventListener("animationend", event => {
			if (event.animationName === "shrinkOut")
				this.barItem.remove();
		});
		this.barItem.classList.add("shrinkOut");

	}

	static addToBar(downloadNode) {
		downloadNodes[downloadNode.id] = downloadNode;
		bar.appendChild(downloadNode.element);
	}
}

/* Context menu */
const contextMenuElement = document.createElement("ul");
contextMenuElement.classList.add("context-menu");

const openActionElement = document.createElement("li");
openActionElement.dataset.action = "open";
openActionElement.textContent = "Open";
contextMenuElement.appendChild(openActionElement);

const showActionElement = document.createElement("li");
showActionElement.dataset.action = "show";
showActionElement.textContent = "Show";
contextMenuElement.appendChild(showActionElement);

const removeActionElement = document.createElement("li");
removeActionElement.dataset.action = "remove";
removeActionElement.textContent = "Remove";
contextMenuElement.appendChild(removeActionElement);

document.addEventListener("contextmenu", event => {
	// if (contextMenuElement.contains(event.target)) {
	if (bar.contains(event.target)) {
		event.preventDefault();

		if (!contextMenuElement.parentElement) {
			document.body.appendChild(contextMenuElement);
			// TODO handle where outside of window
			contextMenuElement.style.left = event.clientX + "px";
			contextMenuElement.style.top = (event.clientY - contextMenuElement.scrollHeight) + "px";
			let barItem = event.target;
			while (barItem.parentNode !== bar) barItem = barItem.parentNode;
			contextMenuElement.dataset.id = barItem.dataset.id;
		}
	} else if (contextMenuElement.parentNode) {
		contextMenuElement.remove();
	}
});
document.addEventListener("click", event => {
	if (contextMenuElement.parentNode)
		contextMenuElement.remove();
});
contextMenuElement.addEventListener("click", event => {
	if (contextMenuElement.contains(event.target)) {
		let action = event.target.dataset.action, id = parseInt(contextMenuElement.dataset.id);
		switch (action) {
			case "open":
				portBS.postMessage({
					type: MessageType.openDownload,
					downloadId: id
				});
				break;
			case "show":
				portBS.postMessage({
					type: MessageType.showDownload,
					downloadId: id
				});
				break;
			case "remove":
				portBS.postMessage({
					type: MessageType.removeDownload,
					downloadId: id
				});
				break;
		}
		contextMenuElement.remove();
		event.stopPropagation();
	}
});

function setupPortListeners(port) {
	port.onMessage.addListener(m => {
		if (!m.hasOwnProperty("type")) return;

		switch (m.type) {
			case MessageType.activeDownloads:
				removeAllChildren(bar);
				downloadNodes.length = 0;
				for (let download of m.downloads) {
					var downloadNode = new DownloadNode(download);
					DownloadNode.addToBar(downloadNode);
				}
				break;
			case MessageType.addNewDownload:
				var downloadNode = new DownloadNode(m.download);
				DownloadNode.addToBar(downloadNode);
				break;
			case MessageType.changeDownload:
				var downloadNode = downloadNodes[m.delta.id];
				if (downloadNode)
					downloadNode.handleChanges(m.delta);
				break;
			case MessageType.wipeoutDownload:
				var downloadNode = downloadNodes[m.downloadId];
				if (downloadNode)
					downloadNode.removeFromBar();
				break;
		}
	});
}

browser.runtime.onConnect.addListener(port => {
	portBS = port;
	setupPortListeners(port);
});
