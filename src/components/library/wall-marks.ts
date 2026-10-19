import { LAYOUT_COOKIE, LAYOUTS, readLayoutCookie, type Layout } from "@/components/library/layout";
import { DEFAULT_KIND, DEFAULT_TAB, KINDS } from "@/components/library/params";
import { STATUSES } from "@/domain/types";

// The Library's skeleton is in the static shell, which cannot read the cookie or the URL. These marks
// on <html> carry the saved layout, the tab and the kind filter, so CSS can give the skeleton the
// shape the data will have and nothing moves when it arrives.
export type WallMarks = {
  "data-wall-layout": Layout;
  /** Only on the Library's own address. */
  "data-wall-tab"?: string;
  "data-wall-kind"?: string;
};

function single(params: URLSearchParams, name: string): string | null {
  const values = params.getAll(name);
  return values.length === 1 ? values[0] : null;
}

/** The URL and the cookie are user input: only allow-listed values become marks, as the server reads them. */
export function wallMarks(cookie: string, pathname: string, search: string): WallMarks {
  const marks: WallMarks = { "data-wall-layout": readLayoutCookie(cookie) };
  if (pathname !== "/") return marks;
  const params = new URLSearchParams(search);
  const tab = single(params, "tab");
  const kind = single(params, "kind");
  marks["data-wall-tab"] = STATUSES.find((status) => status === tab) ?? DEFAULT_TAB;
  marks["data-wall-kind"] = KINDS.find((value) => value === kind) ?? DEFAULT_KIND;
  return marks;
}

const list = (values: readonly string[]) => JSON.stringify(values);

// The same rules as wallMarks, run in the document head before the first paint. Built only from the
// constants above, so no request data ever becomes part of the script.
export const WALL_MARKS_SCRIPT = `(function(){try{var d=document.documentElement,m=/(?:^|; )${LAYOUT_COOKIE}=([^;]*)/.exec(document.cookie),l=m&&m[1];d.setAttribute("data-wall-layout",${list(LAYOUTS)}.indexOf(l)>=0?l:"auto");if(location.pathname!=="/")return;var q=new URLSearchParams(location.search),t=q.getAll("tab"),k=q.getAll("kind");t=t.length===1?t[0]:null;k=k.length===1?k[0]:null;d.setAttribute("data-wall-tab",${list(STATUSES)}.indexOf(t)>=0?t:${JSON.stringify(DEFAULT_TAB)});d.setAttribute("data-wall-kind",${list(KINDS)}.indexOf(k)>=0?k:${JSON.stringify(DEFAULT_KIND)})}catch(e){}})()`;
