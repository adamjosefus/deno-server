import { join } from '@denoland/path/mod.ts';
import { getReasonPhrase as getStatusReasonPhrase } from "./Status.ts";


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
    private _errors: {
        status: number,
        response: Response
    }[] = [];


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


    private _createTestCallback(input: RouteInputType): RouteTestCallbackType {
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
                return input.reduce((acc: boolean, r) => acc || this._createTestCallback(r)(path), false)
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


    private _createRoute(input: RouteInputType, response: RouteResponseType): RouteType {
        return {
            input: input,
            test: this._createTestCallback(input),
            response: this._normalizeResponse(response),
        };
    }


    /**
     * Přidá další routu do routeru.
     * @param input
     * @param response 
     */
    addRoute(input: RouteInputType, response: RouteResponseType): void {
        const route = this._createRoute(input, response);
        this._routes.push(route);
    }


    /**
     * Nastaví záložní routu, která se vykoná vždy jako poslední.
     * @param input 
     * @param response 
     */
    setFallbackRoute(input: RouteInputType, response: RouteResponseType): void {
        const route = this._createRoute(input, response);
        this._fallbackRoute = route;
    }


    /**
     * Smaže záložní routu.
     */
    clearFallbackRoute(): void {
        this._fallbackRoute = null;
    }


    addErrorResponse(status: number, response: Response): void {
        const index = this._errors.findIndex(r => r.status === status);

        if (index >= 0) this._errors.splice(index, 1);

        this._errors.push({
            status,
            response
        })
    }


    private _getErrorResponse(status: number): Response | null {
        const error = this._errors.find(r => r.status === status);

        if (error) {
            return error.response;
        } else {
            return null;
        }
    }

    getErrorResponse(status: number): Response {
        const response = this._getErrorResponse(status);

        if (response) {
            return response;
        } else {
            return new Response(`${status}\n${getStatusReasonPhrase(status)}`, {
                headers: { "Content-Type": "text/plain" },
                status,
            });
        }
    }


    addStaticFilesRoute(match: RouteInputType, dir = '/'): void {
        const response: ResponseCallbackType = async (path: string) => {
            const filepath = join(dir, path);

            try {
                return new Response(await Deno.readFileSync(filepath), {
                    status: 200,
                });
            } catch (_error) {
                return this.getErrorResponse(404);
            }
        }

        this.addRoute(match, response);
    }


    getRoutes() {
        const routes = [...this._routes];

        if (this._fallbackRoute) routes.push(this._fallbackRoute);

        return routes;
    }
}