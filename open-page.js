let backgroundPage = browser.extension.getBackgroundPage();
document.addEventListener("click", event => {
	browser.downloads.open(backgroundPage.activeId);
	browser.tabs.getCurrent().then(tab => browser.tabs.remove(tab.id));
});
