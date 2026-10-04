// To remember the admin's list filters for this browser tab, 
// "Back to list" on the detail page can restore them.
const KEY = "ras_list_query";

export function saveListQuery(query) {
  sessionStorage.setItem(KEY, query);
}

export function loadListQuery() {
  return sessionStorage.getItem(KEY) ?? "";
}
