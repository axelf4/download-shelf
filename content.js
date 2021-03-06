"use strict";

/** Removes all children from the DOM node. */
// XXX Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1408996
const removeAllChildren = (f => node => f.call(node))(
	Node.prototype.removeAllChildren = function() {
		while (this.firstChild) this.removeChild(this.firstChild);
	}
);

/** Tag function that sanitizes and encodes HTML. */
const sanitize = (function() {
	const div = document.createElement("div");
	return (strings, ...values) => strings.map((s, i) =>
		values[i] ? (div.textContent = values[i], s + div.innerHTML) : s
	).join("");
})();

const bar = document.createElement("div");
document.addEventListener("DOMContentLoaded", event => {
	document.body.appendChild(bar);
});
const shadow = bar.attachShadow({mode: "closed"});
const style = document.createElement("style");
style.textContent = `
:host {
	all: initial;
	contain: style;
	position: fixed;
	display: flex;
	background: linear-gradient(-10deg, #EE775240, #E73C7E40, #23A6D540, #23D5AB40);
	left: 0px;
	bottom: 0px;
	align-items: stretch;
	width: 100%;
	z-index: 2000000000; /* One higher than YouTube's sidebar. */
	pointer-events: none;
	margin: 0;
	border: 0;
	box-shadow: 0px -2px 7px 0px #3A3A3A;
	font: normal normal 16px/1.4 Helvetica,Roboto,"Segoe UI",Calibri,sans-serif;
}

:host > * {
	pointer-events: auto;
}

#item-container {
	display: flex;
	align-items: stretch;
	flex-flow: row wrap;
}

#clear-button {
	background: url(${browser.runtime.getURL("images/clear.svg")}) center/contain no-repeat;
	border: none;
	cursor: pointer;
	width: 24px;
	margin-left: auto;
}

#clear-button:hover {
	filter: brightness(150%);
}

#clear-button:hover:active {
	filter: brightness(75%);
}

bar-item {
	display: flex;
	align-items: center;
	border-radius: 2px;
	font-size: small;
	cursor: pointer;
	--horizontal-size: 150px;
	width: var(--horizontal-size);
	margin: 2px 2px;
	padding: 2px;

	box-shadow: inset 0px 0px 10px 0px #B2B2B2, 2px 2px 5px 0px #595959;
	background-size: 200% 100%;
	background-image: linear-gradient(to right, rgba(255, 0, 0, 0) 50%, white 50%);

	transition: background-position 0.5s ease-out;
	transform-style: preserve-3d;
	backface-visibility: hidden;
}

bar-item.shrinkOut {
	animation: 3s shrinkOut;
}

@keyframes shrinkOut {
	from {
		transform: translateX(0) rotateY(0);
		width: var(--horizontal-size);
	}
	75% {
		transform: translateX(-25%) rotateY(-90deg);
		width: var(--horizontal-size);
	}
	to {
		transform: translateX(-25%) rotateY(-90deg);
		width: 0;
	}
}

bar-item > img {
	width: 16px;
	height: 16px;
	margin-right: 0.2em;
}

bar-item > span {
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
	margin: 0;
}
`;
shadow.appendChild(style);
const itemContainer = document.createElement("span");
itemContainer.id = "item-container";
shadow.appendChild(itemContainer);

const clearButton = document.createElement("button");
clearButton.id = "clear-button";
clearButton.title = "Clear downloads";
clearButton.addEventListener("click", () => {
	port.postMessage({ type: MessageType.clearDownloads });
});
shadow.appendChild(clearButton);

customElements.define("bar-item", class extends HTMLElement {
	constructor() {
		super();
		this._iconUrl = this._name = "";
		this.addEventListener("click", event => {
			port.postMessage({
				type: MessageType.clickDownload,
				downloadId: +this.getAttribute("data-id")
			});
		});
	}

	static get observedAttributes() {
		return ["name", "icon-url", "state", "bytes-received", "total-bytes"];
	}

	attributeChangedCallback(attrName, oldVal, newVal) {
		switch (attrName) {
			case "name":
				this._name = newVal;
				break;
			case "icon-url":
				this._iconUrl = newVal;
				break;
			case "state": case "bytes-received": case "total-bytes":
				this._percentage = this.getAttribute("state") === "complete" ? 100
					: !this.hasAttribute("bytes-received") || !this.hasAttribute("total-bytes") ? 0
					: 100 * +this.getAttribute("bytes-received") / +this.getAttribute("total-bytes");
				break;
		}

		this.innerHTML = sanitize`<img src="${this._iconUrl}"><span>${this._name}</span>`;
		this.style.backgroundPosition = `-${this._percentage}% 0`;
	}
});

const removeBarItem = function(element) {
	element.addEventListener("animationend", event => {
		if (event.animationName === "shrinkOut")
			element.remove();
	});
	element.classList.add("shrinkOut");
};

/* Context menu */
customElements.define("context-menu", class extends HTMLElement {
	constructor() {
		super();
		this.attachShadow({mode: "closed"}).innerHTML = `
		<style>
:host {
	position: fixed;
	z-index: 2000000001;
	margin: 0;
	padding: 0;
	border: solid 1px gray;
}

:host > div {
	padding: 0.4em;
	font-size: medium;
	background-color: #E1E1E1;
	color: #666;
	cursor: pointer;
	transition: color 0.3s, background-color 0.3s;
}

:host > div:hover {
	background-color: #2098D1;
	color: white;
}

:host > div + div {
	border-top: solid 1px gray;
}
		</style>
		<div data-action="open">Open</div>
		<div data-action="show">Show</div>
		<div data-action="remove">Remove</div>
		`;

		this.addEventListener("click", event => {
			if (event.originalTarget !== this) {
				const action = event.originalTarget.dataset.action, id = +this.dataset.id;
				const messageType = action === "open" ? MessageType.openDownload
					: action === "show" ? MessageType.showDownload
					: action === "remove" ? MessageType.removeDownload
					: null;
				if (messageType === null) throw new Error();
				port.postMessage({ type: messageType, downloadId: id });
				this.remove();
				event.stopPropagation();
			}
		});
		this.onClickDocument = this.remove.bind(this);
	}

	connectedCallback() {
		document.addEventListener("click", this.onClickDocument);
		document.addEventListener("contextmenu", this.onClickDocument);
	}

	disconnectedCallback() {
		document.removeEventListener("click", this.onClickDocument);
		document.removeEventListener("contextmenu", this.onClickDocument);
	}
});

itemContainer.addEventListener("contextmenu", event => {
	if (event.target !== this) {
		const contextMenu = document.createElement("context-menu");

		let barItem = event.target;
		while (barItem.parentNode !== itemContainer) barItem = barItem.parentNode;
		contextMenu.dataset.id = barItem.dataset.id;

		contextMenu.style.left = event.clientX + "px";
		shadow.appendChild(contextMenu); // Add to shadow root to avoid MutationObservers
		contextMenu.style.top = (event.clientY - contextMenu.scrollHeight) + "px";

		event.preventDefault();
		event.stopPropagation();
	}
});

const updateItem = function(barItem, properties) {
	if (!barItem) return;
	for (const [property, value] of Object.entries(properties)) {
		switch (property) {
			case "url":
				barItem.setAttribute("name", getFileNameFromPath(value));
				break;
			case "iconUrl": barItem.setAttribute("icon-url", value || ""); break;
			case "state": barItem.setAttribute("state", value); break;
			case "bytesReceived": barItem.setAttribute("bytes-received", value); break;
			case "totalBytes": barItem.setAttribute("total-bytes", value); break;
		}
	}
};

const getBarItemByDownloadId = downloadId => itemContainer.querySelector(`bar-item[data-id='${downloadId}'`);

const setupPortListeners = function(port) {
	port.onMessage.addListener(m => {
		if (!m.hasOwnProperty("type")) throw new Error("Invalid message.");

		const newDownloadItem = download => {
			const barItem = document.createElement("bar-item");
			barItem.setAttribute("data-id", download.id);
			updateItem(barItem, download);
			itemContainer.appendChild(barItem);
		};

		switch (m.type) {
			case MessageType.activeDownloads:
				removeAllChildren(itemContainer);
				for (const download of m.downloads) {
					newDownloadItem(download);
				}
				break;
			case MessageType.addNewDownload:
				newDownloadItem(m.download);
				break;
			case MessageType.changeDownload:
				updateItem(getBarItemByDownloadId(m.delta.id), m.delta);
				break;
			case MessageType.animateRemoval:
				removeBarItem(getBarItemByDownloadId(m.downloadId));
				break;
		}
	});
};

let port = browser.runtime.connect();
setupPortListeners(port);

browser.runtime.onConnect.addListener(p => {
	port = p;
	setupPortListeners(port);
});
