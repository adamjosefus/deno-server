import { join } from "https://deno.land/std/path/mod.ts";
import {
    ServerRequest, Response as ServerResponse,
} from "https://deno.land/std/http/server.ts";




export type RouteMatchCallback = {
    (request: ServerRequest): boolean
}


export type ResponseCallbackType = {
    (request: ServerRequest): Promise<ServerResponse | void>
}


export type RouteMatchType =
    | RouteMatchCallback
    | RegExp
    | string;


export type ResponseType =
    | ResponseCallbackType
    | ServerResponse
    | Deno.File
    | string;


export type RouteType = {
    match: RouteMatchCallback,
    response: ResponseCallbackType,
}


export class Router {
    private _routes: RouteType[] = []


    private _normalieRouteMatch(raw: RouteMatchType): RouteMatchCallback {
        if (typeof raw === 'function') {
            return raw;

        } else if (typeof raw === 'string') {
            const url: string = raw.startsWith('/') ? raw : `/${raw}`;

            return (req) => req.url == url

        } else {
            const regex: RegExp = raw;

            return (req) => {
                regex.lastIndex = 0;
                return regex.test(req.url);
            }
        }
    }


    private _normalieResponse(raw: ResponseType): ResponseCallbackType {
        if (raw instanceof Deno.File) {
            const file = raw;
            return async (req) => {
                return {
                    body: file
                }
            };

        } else if (typeof raw == 'string') {
            return async (req) => {
                return {
                    body: raw
                }
            };

        } else if (typeof raw == 'object') {
            const object = raw;
            return async (req) => {
                return object;
            };

        }

        return raw;
    }


    addRoute(match: RouteMatchType, response: ResponseType) {
        const route: RouteType = {
            match: this._normalieRouteMatch(match),
            response: this._normalieResponse(response),
        };

        this._routes.push(route);
    }


    /**
     * @apram `match`
     * @apram `root`  Path must be **absolute**.
     */
    addStaticFilesRoute(match: RouteMatchType, root: string = '/') {
        const response: ResponseType = async (request) => {
            const path = join(root, request.url);

            try {
                return {
                    status: 200,
                    body: await Deno.openSync(path),
                }
            } catch (error) {
                return {
                    status: 404,
                    body: "Not Found.",
                }
            }
        }

        this.addRoute(match, response);
    }


    getRoutes() {
        return [...this._routes];
    }
}