import { join } from 'https://deno.land/std@0.117.0/path/mod.ts';
import { type StatusType, Status, getReasonPhrase as getStatusReasonPhrase } from "./Status.ts";


export const enum MaskSubstitutes {
    Host = '%host%'
}


export interface ServerOptions extends Deno.ListenOptions {
    webRoot?: string
}


export type RouteTestCallbackType =
    (url: string) => boolean;


export type RouteResponseCallbackType =
    | { (): Response | Promise<Response> }
    | { (request: Request): Response | Promise<Response> }
    | { (request: Request, pattern: URLPattern): Response | Promise<Response> }
    | { (request: Request, pattern: URLPattern, args: Record<string, string>): Response | Promise<Response> }


export type RouteMaskType =
    | string
    | string[];


export type RouteResponseType =
    | RouteResponseCallbackType
    | Uint8Array
    | string;


type RoutePatternCallbackType =
    (hostUrl: string) => URLPattern;


type RouteType = {
    getPattern: RoutePatternCallbackType,
    test: RouteTestCallbackType,
    getResponse: RouteResponseCallbackType,
}


export class Server {

    private _options: Deno.ListenOptions;
    private _listener: Deno.Listener | null = null;

    private _routes: RouteType[] = [];
    private _fallbackRoute: RouteType | null = null;
    private _errors: {
        status: number,
        response: Response
    }[] = [];

    private readonly _webRoot: string;


    constructor(options: ServerOptions) {
        this._options = options;
        this._webRoot = this._normalizePath((options.webRoot ?? "").trim());
    }


    getWebRoot(): string {
        return this._webRoot;
    }


    private async _requestLoop() {
        if (this._listener === null) return;

        for await (const conn of this._listener) {
            (async () => {
                const httpConn = Deno.serveHttp(conn);

                for await (const requestEvent of httpConn) {
                    const request = requestEvent.request;
                    const url = request.url;
                    const hostUrl = this.computeServerHostUrl(url);

                    const redirectResponse = this._createPrettyRedirectResponse(url, hostUrl);

                    if (redirectResponse) {
                        requestEvent.respondWith(redirectResponse);
                        continue;
                    }

                    const routes = this._getRoutes();
                    const route = routes.find(r => r.test(url));

                    if (route) {
                        const pattern = route.getPattern(hostUrl);
                        const args = this._convertURLPatternResultToArgs(pattern.exec(url));
                        const response = await route.getResponse(request, pattern, args);

                        if (response) requestEvent.respondWith(response);

                    } else {
                        requestEvent.respondWith(this.getErrorResponse(Status.S404_NotFound));
                    }
                }
            })();
        }
    }


    private _createPrettyRedirectResponse(url: string, hostUrl: string): Response | null {
        let redirectIndex = 0;
        let target = url;

        if (target.endsWith('/')) {
            // Odtran?? posledn?? lom??tko
            target = target.substring(0, target.length - 1);
            redirectIndex++;
        }

        const response = new Response(undefined, {
            status: Status.S301_MovedPermanently,
            headers: {
                'location': encodeURI(target),
            }
        });

        return target !== hostUrl && redirectIndex > 0 ? response : null;
    }


    start() {
        if (this._listener !== null) return;

        this._listener = Deno.listen(this._options);
        this._requestLoop();
    }


    stop() {
        if (this._listener === null) return;

        this._listener.close();
        this._listener = null;
    }


    computeServerHostUrl(url: string): string {
        const { origin } = new URL(url);

        if (this._webRoot !== '') {
            return `${origin}/${this._webRoot}`
        } else {
            return origin;
        }
    }


    /**
     * @deprecated Use `computeServerHostUrl` instead
     */
    computeHostUrl(url: string): string {
        return this.computeServerHostUrl(url);
    }


    computeClientUrl(url: string): string {
        url = ((s) => {
            const url = new URL(s);
            if (url.port === '80') url.port = '';
            return url.toString();
        })(url);

        const hostUrl = this.computeServerHostUrl(url);
        const path = url.substring(hostUrl.length);

        const clientUrl = (() => {
            if (this._webRoot !== '') {
                if (path.startsWith('?')) {
                    return `${this._webRoot}${path}`;
                } else {
                    return join(this._webRoot, path);
                }
            } else {
                return path;
            }
        })();

        return '/' + this._normalizePath(clientUrl);
    }


    /**
     * P??id?? novou routu, nebo routy.
     * @param mask 
     * @param response 
     */
    addRoute(mask: string | string[], response: RouteResponseType): void {
        const masks = Array.isArray(mask) ? mask : [mask];

        masks.forEach(m => this._addRoute(m, response));
    }


    /**
     * Nastav?? z??lo??n?? routu, kter?? se vykon?? v??dy jako posledn??.
     * @param input 
     * @param response 
     */
    setFallbackRoute(mask: string, response: RouteResponseType): void {
        const route = this._createRoute(mask, response);
        this._fallbackRoute = route;
    }


    /**
     * Odstran?? z??lo??n?? routu.
     */
    removeFallbackRoute(): void {
        this._fallbackRoute = null;
    }


    private _addRoute(mask: string, response: RouteResponseType): void {
        const r = this._createRoute(mask, response);

        this._routes.push(r);
    }


    private _createRoute(mask: string, response: RouteResponseType): RouteType {
        const getPattern = this._createGetRoutePatternCallback(this._normalizePath(mask));

        return {
            getPattern,
            getResponse: this._normalizeRouteResponse(response),
            test: (url: string): boolean => {
                url = this._normalizePath(url);

                const hostUrl = this.computeServerHostUrl(url);
                const pattern = getPattern(hostUrl);

                return pattern.test(url);
            },
        };
    }


    private _createGetRoutePatternCallback(mask: string): RoutePatternCallbackType {
        return (hostUrl: string) => {
            if (mask.includes(MaskSubstitutes.Host)) {
                return new URLPattern(mask.replaceAll(MaskSubstitutes.Host, hostUrl));
            } else if (mask !== '') {
                return new URLPattern(`${hostUrl}/${mask}`);
            } else {
                return new URLPattern(`${hostUrl}`);
            }
        }
    }


    private _normalizePath(path: string): string {
        return [
            // Trim
            (s: string) => s.trim(),

            // Remove first "/"
            (s: string) => {
                if (s.startsWith('/') && !s.startsWith('//')) return s.substring(1);
                return s;
            },

            // Remove last "/"
            (s: string) => {
                if (s.endsWith('/')) return s.substring(0, s.length - 1);
                return s;
            },
        ].reduce((s, fce) => fce(s), path);
    }


    private _normalizeRouteResponse(response: RouteResponseType): RouteResponseCallbackType {
        if (typeof response == 'string') {
            return async () => await new Response(response);

        } else if (response instanceof Uint8Array) {
            return async () => await new Response(response);

        } else if (response instanceof Response) {
            return async () => await response;
        }

        return response;
    }


    addErrorResponse(status: StatusType, response: Response): void {
        const index = this._errors.findIndex(r => r.status === status);

        if (index >= 0) this._errors.splice(index, 1);

        this._errors.push({
            status,
            response
        })
    }


    private _getErrorResponse(status: StatusType): Response | null {
        const error = this._errors.find(r => r.status === status);

        if (error) {
            return error.response;
        } else {
            return null;
        }
    }


    getErrorResponse(status: StatusType): Response {
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


    private _getRoutes() {
        const routes = [...this._routes];

        if (this._fallbackRoute) routes.push(this._fallbackRoute);

        return routes;
    }


    private _convertURLPatternResultToArgs(result: URLPatternResult | null): Record<string, string> {
        if (result === null) return {};

        return {
            ...result.protocol.groups,
            ...result.username.groups,
            ...result.password.groups,
            ...result.hostname.groups,
            ...result.port.groups,
            ...result.pathname.groups,
            ...result.search.groups,
            ...result.hash.groups,
        };
    }


    static createJsonResponse<DataType>(data: DataType, status: StatusType = Status.S200_Ok): Response {
        const headers = new Headers();
        headers.append("Content-Type", "application/json; charset=UTF-8");

        return new Response(JSON.stringify(data, null, '  '), { headers, status });
    }


    static createTextResponse(text: string, status: StatusType = Status.S200_Ok): Response {
        const headers = new Headers();
        headers.append("Content-Type", "text/plain;charset=UTF-8");

        return new Response(text, { headers, status });
    }


    static createHtmlResponse(html: string, status: StatusType = Status.S200_Ok): Response {
        const headers = new Headers();
        headers.append("Content-Type", "text/html; charset=UTF-8");

        return new Response(html, { headers, status });
    }


    static createErrorResponse(status: StatusType, message?: string): Response {
        const headers = new Headers();
        headers.append("Content-Type", "text/plain;charset=UTF-8");

        return new Response(message ?? getStatusReasonPhrase(status), { headers, status });
    }
}