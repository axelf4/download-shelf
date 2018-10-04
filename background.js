"use strict";

/** Default error handler. */
function onError(error) { console.error(`Error: ${error}`); }

/**
 * Returns a promise.
 */
const getDownloadItemFromId = function(id) {
	return browser.downloads.search({id}).then(downloads => downloads[0], onError);
};

const getActiveTab = function() {
	return browser.tabs.query({currentWindow: true, active: true})
		.then(tabs => tabs[0], onError);
}

// Set of IDs of active downloads
const active = new Set();
/** Map of ports by windowId. */
const ports = new Map();
/** Map of icon URLs by download IDs. */
const iconByDownloadId = {};
/** FIXME A filthy hack to share the download id with open-page. */
var activeId = null;
var pendingRemovals = [];

/**
 * Posts the specified message to all connected content scripts.
 *
 * @param message The message to post.
 */
const postToContentScripts = function(message) {
	for (var [windowId, port] of ports) try {
		port.postMessage(message);
	} catch (e) {
		ports.delete(windowId); // The port was disconnected
	}
};

/**
 * Attempts to lookup the icon URL of a download.
 *
 * This should be called when a download is started
 * and when it has finished.
 * @param downloadId The ID of the download.
 * @return A Promise for the icon URL.
 */
const fetchDownloadIcon = function(downloadId) {
	return browser.downloads.getFileIcon(downloadId).then(iconUrl => {
		iconByDownloadId[downloadId] = iconUrl;

		// Update the content page
		postToContentScripts({
			type: MessageType.changeDownload,
			delta: { id: downloadId, iconUrl }
		});

		return iconUrl;
	}, onError);
};

const checkProgress = function() {
	browser.downloads.search({
		state: browser.downloads.State.IN_PROGRESS
	}).then(downloads => {
		for (const download of downloads)
			// Firefox doesn't call onChanged for totalBytes: do it here
			postToContentScripts({
				type: MessageType.changeDownload,
				delta: {
					id: download.id,
					bytesReceived: download.bytesReceived,
					totalBytes: download.totalBytes
				}
			});

		// If there are downloads in progress: continue checking
		if (downloads.length > 0) window.setTimeout(checkProgress, 1000);
	});
}

const removeDownload = function(downloadId) {
	active.delete(downloadId);
	// browser.downloads.erase({ id: downloadId });
	postToContentScripts({
		type: MessageType.wipeoutDownload,
		downloadId
	});
};

browser.downloads.onCreated.addListener(item => {
	console.log("New download created:", item);

	active.add(item.id); // Add to active set

	fetchDownloadIcon(item.id);

	// Notify the client
	postToContentScripts({
		type: MessageType.addNewDownload,
		download: item
	});

	checkProgress(); // Start checking the progress
});

// When erased: remove to avoid acting on inexistant download later
browser.downloads.onErased.addListener(removeDownload);

browser.downloads.onChanged.addListener(delta => {
	let downloadId = delta.id;
	if (delta.state && delta.state.current === "complete") {
		fetchDownloadIcon(downloadId);
	}

	checkProgress(); // Download might have started again

	// Send changes to content script
	postToContentScripts({
		type: MessageType.changeDownload,
		delta: flattenDownloadDelta(delta)
	});
});

/**
 * Sends the currently active downloads through the specified port.
 */
async function sendInitialDownloads(port) {
	if (!port) return;
	// Send initial list of downloads
	let downloads = await Promise.all(Array.from(active).map(getDownloadItemFromId));
	downloads.forEach(d => d.iconUrl = iconByDownloadId[d.id]);
	console.log("Sending initial list of downloads:", downloads);
	port.postMessage({
		type: MessageType.activeDownloads,
		downloads
	});

	pendingRemovals.splice(0).forEach(removeDownload);
}

async function openOpenPage(downloadId) {
	activeId = downloadId;
	let tab = await getActiveTab();
	const url = "/open-page.html";
	browser.tabs.create({
		url,
		openerTabId: tab.id
	}).then(tab => {
		// We don't want to sync this URL ever nor clutter the users history
		browser.history.deleteUrl({url});
	}).catch(onError);
}

const setupPort = function(port) {
	port.onDisconnect.addListener(p => {
		if (p.error)
			console.log(`Disconnected due to an error: ${port.error.message}.`);
	});

	port.onMessage.addListener(m => {
		console.log("Message from content script:", m);
		if (!m.hasOwnProperty("type")) {
			console.warn("Ignoring message without type property.");
			return;
		}

		switch (m.type) {
			case MessageType.openDownload:
				openOpenPage(m.downloadId);
				break;
			case MessageType.showDownload:
				// Open the file manager
				browser.downloads.show(m.downloadId).catch(onError);
				break;
			case MessageType.pauseDownload:
				browser.downloads.pause(m.downloadId).catch(onError);
				break;
			case MessageType.resumeDownload:
				browser.downloads.resume(m.downloadId).catch(onError);
				break;
			case MessageType.cancelDownload:
				browser.downloads.cancel(m.downloadId).catch(onError);
				break;
			case MessageType.removeDownload:
				removeDownload(m.downloadId);
				break;
			case MessageType.clearDownloads:
				active.forEach(removeDownload);
				break;
			case MessageType.showAllDownloads:
				browser.downloads.showDefaultFolder();
				break;
			default:
				console.warn("Invalid type of message.");
				break;
		}
	});

	sendInitialDownloads(port);
};

browser.tabs.onActivated.addListener(activeInfo => {
	var tabId = activeInfo.tabId, windowId = activeInfo.windowId;

	// Disconnect old tab
	if (ports.has(windowId)) ports.get(windowId).disconnect();

	// Connect to active tab
	let port = browser.tabs.connect(tabId);
	ports.set(windowId, port);
	setupPort(port);
});

browser.windows.onRemoved.addListener(windowId => {
	if (ports.has(windowId)) {
		ports.get(windowId).disconnect();
		ports.delete(windowId);
	}
});

browser.runtime.onConnect.addListener(async port => {
	console.log("Connection attempt from content script.");
	let tab = port.sender.tab, windowId = tab.windowId;
	if (!tab) {
		console.warn("Connection attempted from other than content script.");
		return;
	}

	if (tab.active) {
		console.log("Connection accepted.");

		// Disconnect old tab
		if (ports.has(windowId)) ports.get(windowId).disconnect();

		// Setup new tab
		ports.set(windowId, port);
		setupPort(port);
	} else {
		port.disconnect();
	}
});
