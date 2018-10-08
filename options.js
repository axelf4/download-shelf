"use strict";

const removeOnOpen = document.getElementById("removeOnOpen"),
	removeOnShow = document.getElementById("removeOnShow"),
	defaultAction = document.getElementById("defaultAction");

browser.runtime.sendMessage({type: MessageType.getOptions})
	.then(options => {
		// Reflect actual values
		removeOnOpen.checked = options.removeOnOpen;
		removeOnShow.checked = options.removeOnShow;
		defaultAction.value = options.defaultAction;

		// Setup element listeners
		[removeOnOpen, removeOnShow].forEach(checkbox => {
			checkbox.addEventListener("change", () => {
				browser.storage.sync.set({[checkbox.id]: checkbox.checked});
			});
		});
		defaultAction.addEventListener("change", () => {
			browser.storage.sync.set({defaultAction: defaultAction.value});
		});
	});
