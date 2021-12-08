import { Router } from "./Router.ts";
import { Status } from "./Status.ts";


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

        const router = this._router;
        const routes = router.getRoutes();

        for await (const conn of this._listener) {
            (async () => {
                const httpConn = Deno.serveHttp(conn);

                for await (const requestEvent of httpConn) {
                    const url = requestEvent.request.url;
                    const hostUrl = router.computeHostUrl(url);

                    const redirectResponse = this._createPrettyRedirectResponse(url, hostUrl);

                    if (redirectResponse) {
                        requestEvent.respondWith(redirectResponse);
                        continue;
                    }

                    const route = routes.find(r => r.test(url));

                    if (route) {
                        const pattern = route.getPattern(hostUrl);
                        const response = await route.getResponse(url, pattern, Router.convertURLPatternResultToArgs(pattern.exec(url)));

                        if (response) requestEvent.respondWith(response);

                    } else {
                        requestEvent.respondWith(this._router.getErrorResponse(404));
                    }
                }
            })();
        }
    }


    private _createPrettyRedirectResponse(url: string, hostUrl: string): Response | null {
        let redirectIndex = 0;
        let target = url;

        if (target.endsWith('/')) {
            // Odtraní poslední lomítko
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


    close() {
        if (this._listener === null) return;

        this._listener.close();
        this._listener = null;
    }
}