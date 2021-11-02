import { join } from '@denoland/path/mod.ts';


export type RouteMatchCallback = {
    (path: string): boolean
}


export type ResponseCallbackType = {
    (path: string): Promise<Response> | Response
}


export type RouteMatchType =
    | RouteMatchCallback
    | URLPattern
    | RegExp
    | string
    | RouteMatchType[];


export type ResponseType =
    | ResponseCallbackType
    | Uint8Array
    | string;


export type RouteType = {
    match: RouteMatchCallback,
    response: ResponseCallbackType,
}


export class Router {
    private _standardRoutes: RouteType[] = [];
    private _fallbackRoute: RouteType | null = null;

    private readonly webRoot: string;

    constructor(webRoot: string = '/') {
        this.webRoot = this._normalizePath(webRoot);
    }


    private _computeRequestPath(url: string): string {
        const urlParts = new URL(url);
        const raw = urlParts.pathname;

        if (raw.startsWith(this.webRoot)) {
            return this._normalizePath(raw.substring(this.webRoot.length));
        }

        console.warn(`Url "${url}" not starts with web root "${this.webRoot}."`);
        return url;
    }


    private _normalizePath(path: string): string {
        return path.startsWith('/') ? path : `/${path}`;
    }


    private _normalizeRouteMatch(raw: RouteMatchType): RouteMatchCallback {
        const processString = (raw: string): RouteMatchCallback => {
            const routePath: string = this._normalizePath(raw);
            return (path) => this._computeRequestPath(path) == routePath;
        }

        const processURLPattern = (pattern: URLPattern): RouteMatchCallback => {
            return (path) => {
                return pattern.test(this._computeRequestPath(path));
            }
        }

        const processRegExp = (regex: RegExp): RouteMatchCallback => {
            return (path) => {
                regex.lastIndex = 0;
                return regex.test(this._computeRequestPath(path));
            }
        }


        if (typeof raw === 'function') {
            return raw;

        } else if (typeof raw === 'string') {
            return processString(raw);

        } else if (raw instanceof URLPattern) {
            return processURLPattern(raw);

        } else if (raw instanceof RegExp) {
            return processRegExp(raw);

        } else if (raw instanceof Array) {
            return (path) => {
                return raw.reduce((acc: boolean, r) => acc || this._normalizeRouteMatch(r)(path), false)
            };
        }

        throw new Error("Unknow type of RouteMatchType.");
    }


    private _normalizeResponse(response: ResponseType): ResponseCallbackType {
        if (typeof response == 'string') {
            return async (_path) => await new Response(response);

        } else if (response instanceof Uint8Array) {
            return async (_path) => await new Response(response);

        } else if (response instanceof Response) {
            return async (_path) => await response;
        }

        return async (_path) => await response(this._computeRequestPath(_path));
    }


    addRoute(match: RouteMatchType, response: ResponseType) {
        const route = this._createRoute(match, response);
        this._standardRoutes.push(route);
    }


    setFallbackRoute(match: RouteMatchType, response: ResponseType) {
        const route = this._createRoute(match, response);
        this._fallbackRoute = route;
    }


    private _createRoute(match: RouteMatchType, response: ResponseType): RouteType {
        return {
            match: this._normalizeRouteMatch(match),
            response: this._normalizeResponse(response),
        };
    }


    /**
     * @apram `match`
     * @apram `root`
     */
    addStaticFilesRoute(match: RouteMatchType, root = '/') {
        const response: ResponseCallbackType = async (url: string) => {
            const path = join(root, url);

            try {
                return new Response(await Deno.readFileSync(path), {
                    status: 200,
                });
            } catch (_error) {
                return new Response("Not Found.", {
                    status: 404,
                });
            }
        }

        this.addRoute(match, response);
    }


    getRoutes() {
        const arr = [...this._standardRoutes];

        if (this._fallbackRoute) arr.push(this._fallbackRoute);

        return arr;
    }
}