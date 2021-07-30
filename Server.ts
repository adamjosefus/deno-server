import {
    serve,
    Server as HTTPServer,
    HTTPOptions,
} from "https://deno.land/std/http/server.ts";
import { Router } from "./Router.ts";


export class Server {
    private _http: HTTPServer | null = null;
    private _httpOptions: HTTPOptions;

    private _router: Router;


    constructor(options: HTTPOptions, router: Router) {
        this._httpOptions = options;
        this._router = router;
    }


    private async _requestLoop() {
        if (this._http === null) return;

        const routes = this._router.getRoutes();

        for await (const request of this._http) {
            const route = routes.find(r => r.match(request));

            if (route) {
                request.respond(await route.response(request));
            } else {
                request.respond({
                    status: 400,
                    body: "Bad Request\nNo route matched.",
                });
            }
        }
    }


    open() {
        this._http = serve(this._httpOptions);

        this._requestLoop();
    }


    close() {
        if (this._http === null) return;

        this._http.close();
    }
}