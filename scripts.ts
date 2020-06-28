class CookieCache {
  private cookies: Record<string, Array<chrome.cookies.Cookie>> = {};
  public AddCookie(cookie: chrome.cookies.Cookie): void {
    const domain = cookie.domain;
    console.log(domain);
    if (!this.cookies[domain]) {
      this.cookies[domain] = [];
    }
    this.cookies[domain].push(cookie);
  }

  public RemoveCookie(cookie: chrome.cookies.Cookie) {
    const domain = cookie.domain;
    const removed = this.cookies[cookie.domain]?.filter((x) => {
      x.name !== cookie.name ||
        x.domain !== cookie.domain ||
        x.hostOnly !== cookie.hostOnly ||
        x.path !== cookie.path ||
        x.secure !== cookie.secure ||
        x.httpOnly !== cookie.httpOnly ||
        x.session !== cookie.session ||
        x.storeId !== cookie.storeId;
    });

    this.cookies[domain] = removed;
    if (removed === undefined || removed.length === 0) {
      delete this.cookies[domain];
    }
  }

  public GetDomains() {
    return Object.keys(this.cookies).sort();
  }

  public GetCookie(domain: string) {
    return this.cookies[domain] || [];
  }

  public Reset() {
    this.cookies = {};
  }
}

const cache = new CookieCache();
document["cache"] = cache;

function bindList() {
  const list = document.querySelector("#cookieList");
  const template = document.querySelector("#listItem").innerHTML;

  cache.GetDomains().forEach((domain) => {
    const cookies = cache.GetCookie(domain);

    const sessionCookie = cookies.filter((x) => x.name === "SESSION")[0];

    const session = sessionCookie?.value || "";
    const sessionShort = `${session.substr(0, 15)}...`;
    let color = "accentBlueDark";
    const now = new Date().getTime();

    color = sessionCookie.expirationDate < now ? "accentBlueDark" : "accentRedDark";
    color = sessionCookie.expirationDate + 5 * 60 * 60 < now ? "accentYellowDark" : color;
    const xsrftokenCookie = cookies.filter((x) => x.name === "XSRF-TOKEN")[0];
    const xsrftoken = xsrftokenCookie?.value || "";
    const xsrftokenShort = `${xsrftoken.substr(0, 15)}...`;
    const cmd = btoa(
      `set "MDSP_HOST=${domain}" & set "MDSP_SESSION=${session}" & set "MDSP_XSRF_TOKEN=${xsrftoken}"`
    );
    const linux = btoa(
      `export MDSP_HOST="${domain}" && export MDSP_SESSION="${session}" && export MDSP_XSRF_TOKEN="${xsrftoken}"`
    );
    const ps = btoa(
      `$Env:MDSP_HOST="${domain}"; $Env:MDSP_SESSION="${session}"; $Env:MDSP_XSRF_TOKEN="${xsrftoken}"`
    );

    const sessionraw = btoa(`${session}`);
    const xsrftokenraw = btoa(`${xsrftoken}`);

    list.innerHTML += mustache(template, {
      domain,
      session,
      xsrftoken,
      cmd,
      linux,
      ps,
      color,
      sessionraw,
      xsrftokenraw,
      sessionShort,
      xsrftokenShort,
    });
  });

  list.querySelectorAll("p").forEach((p) => {
    if (p.hasAttribute("data")) {
      p.onclick = () => (p.innerHTML = p.getAttribute("data"));
    }
  });

  list.querySelectorAll("button").forEach(
    async (x) =>
      (x.onclick = () => {
        x.hasAttribute("data") && navigator.clipboard.writeText(atob(x.getAttribute("data")));
      })
  );

  return false;
}

const mustache = (template, data = {}) =>
  Object.entries(data).reduce(
    (res, [key, value]) => res.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), value),
    template
  );

document.addEventListener("DOMContentLoaded", () => {
  chrome.cookies.getAll({}, (cookies) => {
    chrome.cookies.onChanged.addListener((info) => {
      cache.RemoveCookie(info.cookie);
      !info.removed && cache.AddCookie(info.cookie);
    });

    cookies.forEach((x) => {
      x.session &&
        (x.name === "SESSION" || x.name === "XSRF-TOKEN") &&
        (!x.expirationDate || x.expirationDate < new Date().getTime()) &&
        cache.AddCookie(x);
    });
    bindList();
    cache.GetDomains().length !== 0
      ? document.querySelector(".emptyState").setAttribute("style", "display:none")
      : document.querySelector(".emptyState").setAttribute("style", "display:block");
  });
});
