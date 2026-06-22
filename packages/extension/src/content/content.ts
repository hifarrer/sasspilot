import type { Message } from "../lib/messages";
import { applyFields, collectEmptyFields, fillPage, scanPage } from "./autofill";

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
  if (msg.type === "FILL_PAGE") {
    sendResponse(fillPage(msg.profile, msg.fieldMap ?? null));
  } else if (msg.type === "SCAN_PAGE") {
    sendResponse(scanPage());
  } else if (msg.type === "SCAN_EMPTY") {
    sendResponse({ fields: collectEmptyFields() });
  } else if (msg.type === "FILL_FIELDS") {
    sendResponse(applyFields(msg.values));
  }
  return true;
});
