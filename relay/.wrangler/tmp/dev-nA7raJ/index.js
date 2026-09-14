var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.js
var UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 CitoRelay/1.0";
var SAFE_NAME = /^[\w\-. ąčęėįšųūžĄČĘĖĮŠŲŪŽ]{1,120}\.xlsx$/u;
function cors(env, request, extra = {}) {
  const allowed = (env.ALLOWED_ORIGIN || "*").split(",").map((s) => s.trim());
  const origin = request.headers.get("Origin") || "";
  const allow = allowed.includes("*") ? "*" : allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allow,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Cito-Key",
    "Access-Control-Max-Age": "86400",
    ...extra
  };
}
__name(cors, "cors");
var json = /* @__PURE__ */ __name((env, request, status, obj) => new Response(JSON.stringify(obj), { status, headers: cors(env, request, { "Content-Type": "application/json" }) }), "json");
async function redeem(shareLink) {
  let url = shareLink, cookies = /* @__PURE__ */ new Map();
  for (let hop = 0; hop < 8; hop++) {
    const r = await fetch(url, { redirect: "manual", headers: { "User-Agent": UA, Cookie: cookieHeader(cookies) } });
    for (const sc of r.headers.getSetCookie?.() || []) {
      const [kv] = sc.split(";");
      const i = kv.indexOf("=");
      cookies.set(kv.slice(0, i).trim(), kv.slice(i + 1));
    }
    const loc = r.headers.get("location");
    if (r.status >= 300 && r.status < 400 && loc) {
      url = new URL(loc, url).toString();
      continue;
    }
    const finalUrl = new URL(url);
    const id = finalUrl.searchParams.get("id");
    if (!cookies.has("FedAuth") || !id) throw new Error(`share link redeem failed (status ${r.status}, FedAuth=${cookies.has("FedAuth")}, id=${!!id})`);
    const site = `${finalUrl.origin}${finalUrl.pathname.split("/_layouts/")[0]}`;
    return { site, folder: id, cookies };
  }
  throw new Error("too many redirects");
}
__name(redeem, "redeem");
var cookieHeader = /* @__PURE__ */ __name((m) => [...m].map(([k, v]) => `${k}=${v}`).join("; "), "cookieHeader");
async function uploadToOneDrive(env, name, body) {
  const { site, folder, cookies } = await redeem(env.SHARE_LINK);
  const common = { "User-Agent": UA, Cookie: cookieHeader(cookies), Accept: "application/json;odata=nometadata" };
  const ctx = await fetch(`${site}/_api/contextinfo`, { method: "POST", headers: { ...common, "Content-Length": "0" } });
  if (!ctx.ok) throw new Error(`contextinfo ${ctx.status}`);
  const digest = (await ctx.json()).FormDigestValue;
  const enc = /* @__PURE__ */ __name((s) => encodeURIComponent(s).replace(/'/g, "''"), "enc");
  const target = `${site}/_api/web/GetFolderByServerRelativeUrl('${enc(folder)}')/Files/add(url='${enc(name)}',overwrite=true)`;
  const up = await fetch(target, { method: "POST", headers: { ...common, "X-RequestDigest": digest, "Content-Type": "application/octet-stream" }, body });
  if (!up.ok) throw new Error(`upload ${up.status}: ${(await up.text()).slice(0, 300)}`);
  const info = await up.json();
  return { name: info.Name, length: Number(info.Length), modified: info.TimeLastModified };
}
__name(uploadToOneDrive, "uploadToOneDrive");
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const j = /* @__PURE__ */ __name((status, obj) => json(env, request, status, obj), "j");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(env, request) });
    if (url.pathname === "/health") return j(200, { ok: true });
    if (url.pathname !== "/upload" || request.method !== "POST") return j(404, { error: "not found" });
    if (!env.API_KEY || request.headers.get("X-Cito-Key") !== env.API_KEY) return j(401, { error: "bad key" });
    const name = url.searchParams.get("name") || "";
    if (!SAFE_NAME.test(name)) return j(400, { error: "bad name" });
    const body = await request.arrayBuffer();
    if (body.byteLength < 100 || body.byteLength > 8 * 1024 * 1024) return j(400, { error: "bad size" });
    try {
      return j(200, await uploadToOneDrive(env, name, body));
    } catch (e) {
      return j(502, { error: String(e.message || e) });
    }
  }
};

// ../../../../../../../npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../../../npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-I5PM5M/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../../../../../../npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-I5PM5M/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
