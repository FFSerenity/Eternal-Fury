// Language: English by default, Chinese can be picked in the settings (the page reloads to switch).
// tr(zh, en) picks the string for the current language, so texts stay next to the code that uses them.
export const LANG = (() => { try { return localStorage.getItem('graveTamerLang') === 'zh' ? 'zh' : 'en'; } catch (e) { return 'en'; } })();
export const ZH = LANG === 'zh';
export const tr = (zh, en) => ZH ? zh : en;
export const SP = ZH ? '' : ' '; // word gap when names are composed (Fire Enchanted + Skeleton Warrior)
export function setLang(l) { try { localStorage.setItem('graveTamerLang', l); } catch (e) {} }
