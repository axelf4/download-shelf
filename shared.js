const MessageType = Object.freeze({
	/* Messages sent from the background script to the content script. */

	/**
	 * Initial dump of active downloads.
	 *
	 * downloads: array of DownloadItems
	 */
	activeDownloads: 0,
	/**
	 * A new download has been started.
	 *
	 * download: DownloadItem
	 */
	addNewDownload: 9,
	/**
	 * Something has changed.
	 *
	 * delta: DownloadItem where only updated properties are present
	 */
	changeDownload: 10,
	/**
	 * The content script should remove the download.
	 *
	 * downloadId: integer the id of the download
	 */
	animateRemoval: 12,

	/* Messages sent from the content script to the background script. */

	/** User wishes to open download with specified ID. */
	openDownload: 1,
	/**
	 * Opens the containing folder of the download.
	 *
	 * downloadId: integer, the id of the download to show
	 */
	showDownload: 2,
	pauseDownload: 3,
	resumeDownload: 4,
	cancelDownload: 5,
	/** User clicked a download bar item. */
	clickDownload: 8,
	/**
	 * Hides the download from the bar.
	 *
	 * downloadId: integer, the id of the download
	 */
	removeDownload: 11,
	/** Open the default downloads folder. */
	showAllDownloads: 7,
	/** User wishes to remove all downloads. */
	clearDownloads: 13,
	/** Request from open page to get associated download ID. */
	getDownloadIdToOpen: 6,
	/** Request the current options from the background script. */
	getOptions: 14,
});

/**
 * Returns the name of the file given its absolute path.
 * @param path The absolute path of the file.
 * @return The name of the file.
 */
const getFileNameFromPath = function(path) {
	return path.split("\\").pop().split("/").pop();
};

/**
 * Maps all deltas in a download delta to their current value.
 * @param downloadDelta The download delta.
 * @return The new object.
 */
const flattenDownloadDelta = function(downloadDelta) {
	const result = { id: downloadDelta.id };

	for (const [key, delta] of Object.entries(downloadDelta)) {
		if (key === "id") continue;
		result[key] = delta.current;
	}

	return result;
};
