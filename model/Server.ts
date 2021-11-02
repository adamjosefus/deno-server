import { Router } from "./Router.ts";


export class Server {
    private _listener: Deno.Listener | null = null;
    private _options: Deno.ListenOptions;

    private _router: Router;


    constructor(options: Deno.ListenOptions, router: Router) {
        this._options = options;
        this._router = router;
    }


    private async _requestLoop() {
        if (this._listener === null) return;

        const routes = this._router.getRoutes();

        for await (const conn of this._listener) {
            (async () => {
                const httpConn = Deno.serveHttp(conn);

                for await (const requestEvent of httpConn) {
                    const route = routes.find(r => r.test(requestEvent.request.url));

                    if (route) {
                        const response = await route.response(requestEvent.request.url, route.input);
                        if (response) requestEvent.respondWith(response);

                    } else {
                        requestEvent.respondWith(this._router.getErrorResponse(404));
                    }
                }
            })();
        }
    }


    run() {
        if (this._listener !== null) return;

        this._listener = Deno.listen(this._options);
        this._requestLoop();
    }


    close() {
        if (this._listener === null) return;

        this._listener.close();
        this._listener = null;
    }
}