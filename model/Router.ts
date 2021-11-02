import { join } from '@denoland/path/mod.ts';


export type RouteTestCallbackType = {
    (path: string): boolean
}


export type ResponseCallbackType =
    | { (): Response }
    | { (): Promise<Response> }
    | { (path: string): Response }
    | { (path: string): Promise<Response> }
    | { (path: string, route: RouteInputType): Response }
    | { (path: string, route: RouteInputType): Promise<Response> }


export type RouteInputType =
    | RouteTestCallbackType
    | URLPattern
    | RegExp
    | string
    | RouteInputType[];


export type RouteResponseType =
    | ResponseCallbackType
    | Uint8Array
    | string;


export type RouteType = {
    input: RouteInputType,
    test: RouteTestCallbackType,
    response: ResponseCallbackType,
}


export class Router {
    private _routes: RouteType[] = [];
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


    private _createRouteTestCallback(input: RouteInputType): RouteTestCallbackType {
        const processString = (raw: string): RouteTestCallbackType => {
            const routePath: string = this._normalizePath(raw);
            return (path) => this._computeRequestPath(path) == routePath;
        }

        const processURLPattern = (pattern: URLPattern): RouteTestCallbackType => {
            return (path) => {
                return pattern.test(this._computeRequestPath(path));
            }
        }

        const processRegExp = (regex: RegExp): RouteTestCallbackType => {
            return (path) => {
                regex.lastIndex = 0;
                return regex.test(this._computeRequestPath(path));
            }
        }


        if (typeof input === 'function') {
            return input;

        } else if (typeof input === 'string') {
            return processString(input);

        } else if (input instanceof URLPattern) {
            return processURLPattern(input);

        } else if (input instanceof RegExp) {
            return processRegExp(input);

        } else if (input instanceof Array) {
            return (path) => {
                return input.reduce((acc: boolean, r) => acc || this._createRouteTestCallback(r)(path), false)
            };
        }

        throw new Error("Unknow type of RouteMatchType.");
    }


    private _normalizeResponse(response: RouteResponseType): ResponseCallbackType {
        if (typeof response == 'string') {
            return async () => await new Response(response);

        } else if (response instanceof Uint8Array) {
            return async () => await new Response(response);

        } else if (response instanceof Response) {
            return async () => await response;
        }

        return async (path: string, route: RouteInputType) => await response(this._computeRequestPath(path), route);
    }


    addRoute(input: RouteInputType, response: RouteResponseType) {
        const route = this._createRoute(input, response);
        this._routes.push(route);
    }


    setFallbackRoute(input: RouteInputType, response: RouteResponseType) {
        const route = this._createRoute(input, response);
        this._fallbackRoute = route;
    }


    private _createRoute(input: RouteInputType, response: RouteResponseType): RouteType {
        return {
            input: input,
            test: this._createRouteTestCallback(input),
            response: this._normalizeResponse(response),
        };
    }


    addStaticFilesRoute(match: RouteInputType, dir = '/') {
        const response: ResponseCallbackType = async (url: string) => {
            const path = join(dir, url);

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
        const arr = [...this._routes];

        if (this._fallbackRoute) arr.push(this._fallbackRoute);

        return arr;
    }
}