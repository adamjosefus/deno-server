import { join } from 'https://deno.land/std@0.113.0/path/mod.ts';
import { getReasonPhrase as getStatusReasonPhrase } from "./Status.ts";


const enum Substitutes {
    Host = '%host%'
}


export type TestCallbackType =
    (url: string) => boolean;


export type ResponseCallbackType =
    | { (): Response | Promise<Response> }
    | { (url: string, route: URLPattern): Response | Promise<Response> }


export type RouteInputType =
    | string
    | string[];


type InputCallbackType =
    (hostUrl: string) => URLPattern;



export type RouteResponseType =
    | ResponseCallbackType
    | Uint8Array
    | string;


type RouteType = {
    input: InputCallbackType,
    test: TestCallbackType,
    response: ResponseCallbackType,
}


export class Router {
    private _routes: RouteType[] = [];
    private _fallbackRoute: RouteType | null = null;
    private _errors: {
        status: number,
        response: Response
    }[] = [];


    private readonly hostSufix: string;


    constructor(hostSufix: string = '') {
        this.hostSufix = hostSufix.trim();
    }


    computeHostUrl(url: string): string {
        const { host, protocol } = new URL(url);

        const base = `${protocol}//${host}`;

        if (this.hostSufix !== '') {
            return `${base}/${this.hostSufix}`
        } else {
            return base;
        }
    }


    /**
     * Přidá novou routu, nebo routy.
     * @param mask 
     * @param response 
     */
    addRoute(mask: string | string[], response: RouteResponseType): void {
        const masks = Array.isArray(mask) ? mask : [mask];

        masks.forEach(m => this._addRoute(m, response));
    }


    /**
     * Nastaví záložní routu, která se vykoná vždy jako poslední.
     * @param input 
     * @param response 
     */
    setFallbackRoute(mask: string, response: RouteResponseType): void {
        const route = this._createRoute(mask, response);
        this._fallbackRoute = route;
    }


    /**
     * Odstraní záložní routu.
     */
    removeFallbackRoute(): void {
        this._fallbackRoute = null;
    }


    private _addRoute(mask: string, response: RouteResponseType): void {
        const r = this._createRoute(mask, response);

        this._routes.push(r);
    }


    private _createRoute(mask: string, response: RouteResponseType): RouteType {
        const input = this._createRouteInput(this._normalizePath(mask));

        return {
            input,
            test: (url: string): boolean => {
                url = this._normalizePath(url);                

                const hostUrl = this.computeHostUrl(url);
                const pattern = input(hostUrl);

                return pattern.test(url);
            },
            response: this._normalizeResponse(response),
        };
    }


    private _createRouteInput(mask: string): InputCallbackType {
        return (hostUrl: string) => {
            if (mask.includes(Substitutes.Host)) {
                return new URLPattern(mask.replaceAll(Substitutes.Host, hostUrl));
            } else {               
                return new URLPattern(`${hostUrl}/${mask}`);
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


    private _normalizeResponse(response: RouteResponseType): ResponseCallbackType {
        if (typeof response == 'string') {
            return async () => await new Response(response);

        } else if (response instanceof Uint8Array) {
            return async () => await new Response(response);

        } else if (response instanceof Response) {
            return async () => await response;
        }

        return response;
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