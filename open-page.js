const backgroundPage = browser.extension.getBackgroundPage();
const downloadId = backgroundPage.activeId;

document.addEventListener("click", event => {
	if (event.button !== 0) return; // Only capture left button
	browser.downloads.open(downloadId);
	browser.tabs.getCurrent().then(tab => browser.tabs.remove(tab.id));

	// Delay removal until tab has gotten initial list of downloads
	backgroundPage.pendingRemovals.push(downloadId);
});
