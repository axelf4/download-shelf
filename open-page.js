const backgroundPage = browser.extension.getBackgroundPage();

browser.runtime.sendMessage({type: MessageType.getDownloadIdToOpen})
	.then(downloadId => {
		document.addEventListener("click", event => {
			if (event.button !== 0) return; // Only capture left button
			// Close the current tab
			browser.tabs.getCurrent().then(tab => browser.tabs.remove(tab.id));

			browser.downloads.open(downloadId);
			// Delay removal until tab has gotten initial list of downloads
			backgroundPage.pendingRemovals.push(downloadId);
		});
	});
