const I18N = {
    lang: "en",
    dict: {},
    fallback: {},
    t(key, params = {}) {
        const str = (this.dict[key] ?? this.fallback[key] ?? key);
        return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? ""));
    }
};

async function loadLocale(lang) {
    const [cur, fb] = await Promise.all([
        fetch(`/locales/${lang}.json`).then(r => r.json()),
                                        fetch(`/locales/en.json`).then(r => r.json())
    ]);
    I18N.lang = lang;
    I18N.dict = cur;
    I18N.fallback = fb;
    document.documentElement.lang = lang;
    localStorage.setItem("lang", lang);
    applyI18n();
}

function applyI18n(root = document) {
    root.querySelectorAll("[data-i18n]").forEach(el => {
        el.textContent = I18N.t(el.dataset.i18n);
    });
    root.querySelectorAll("[data-i18n-attr]").forEach(el => {
        const map = JSON.parse(el.dataset.i18nAttr);
        for (const [attr, key] of Object.entries(map)) {
            el.setAttribute(attr, I18N.t(key));
        }
    });
}

window.t = (key, params) => I18N.t(key, params);
window.loadLocale = loadLocale;
window.applyI18n = applyI18n;
