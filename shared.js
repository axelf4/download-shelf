const MessageType = Object.freeze({
	/** Messages sent from the background script to the content script. */

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
	wipeoutDownload: 12,

	/** Messages sent from the content script to the background script. */

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
	/**
	 * Hides the download from the bar.
	 *
	 * downloadId: integer, the id of the download
	 */
	removeDownload: 11,
	/** Open the default downloads folder. */
	showAllDownloads: 7,
});

/**
 * Returns the name of the file given its absolute path.
 * @param path The absolute path of the file.
 * @return The name of the file.
 */
const getFileNameFromPath = function(path) {
	return path.split("\\").pop().split("/").pop();
};

const flattenDownloadDelta = function(downloadDelta) {
	const result = { id: downloadDelta.id };

	if (downloadDelta.url) result.url = downloadDelta.url.current;
	if (downloadDelta.filename) result.filename = downloadDelta.filename.current;
	if (downloadDelta.danger) result.danger = downloadDelta.danger.current;
	if (downloadDelta.mime) result.mime = downloadDelta.mime.current;
	if (downloadDelta.startTime) result.startTime = downloadDelta.startTime.current;
	if (downloadDelta.endTime) result.endTime = downloadDelta.endTime.current;
	if (downloadDelta.state) result.state = downloadDelta.state.current;
	if (downloadDelta.canResume) result.canResume = downloadDelta.canResume.current;
	if (downloadDelta.paused) result.paused = downloadDelta.paused.current;
	if (downloadDelta.error) result.error = downloadDelta.error.current;
	if (downloadDelta.totalBytes) result.totalBytes = downloadDelta.totalBytes.current;
	if (downloadDelta.fileSize) result.fileSize = downloadDelta.fileSize.current;
	if (downloadDelta.exists) result.exists = downloadDelta.exists.current;

	return result;
};

const flatDownloadDeltaFromBytesReceived = function(id, bytesReceived, totalBytes) {
	return { id, bytesReceived, totalBytes };
};

const flatDownloadDeltaFromIconUrl = function(id, iconUrl) {
	return { id, iconUrl };
};
