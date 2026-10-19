// Posters marked data-fade start transparent and fade in once loaded (see globals.css). This runs in
// the document head, before any image loads, so server-rendered posters are covered too. An image
// that finished loading before it was attached (from the cache, while React was still rendering) is
// marked as soon as it is attached.
export const POSTER_FADE_SCRIPT = `(function(){var s="img[data-fade]";function m(i){i.setAttribute("data-loaded","")}function on(e){var t=e.target;if(t instanceof HTMLImageElement&&t.matches(s))m(t)}document.addEventListener("load",on,true);document.addEventListener("error",on,true);new MutationObserver(function(rs){for(var r=0;r<rs.length;r++){var a=rs[r].addedNodes;for(var j=0;j<a.length;j++){var n=a[j];if(n.nodeType!==1)continue;var l=n.matches(s)?[n]:n.querySelectorAll(s);for(var k=0;k<l.length;k++)if(l[k].complete)m(l[k])}}}).observe(document.documentElement,{childList:true,subtree:true})})()`;
