import { assertEquals } from "https://deno.land/std@0.117.0/testing/asserts.ts";
import { Server, ServerOptions } from "../model/Server.ts";


Deno.test({
    name: "Server.computeServerHostUrl",
    fn: () => {
        const serverOptions: ServerOptions[] = [];

        const ports = [8080, 80, 1234];
        const hostnames = ['localhost', '127.0.0.1', 'my-dns.net'];

        ports.forEach(port => {
            hostnames.forEach(hostname => {
                serverOptions.push({ hostname, port })
            });
        });


        serverOptions.forEach(_ => {
            const { port, hostname } = _;
            const srv = new Server({ port, hostname });

            const expected = `http://${hostname}${port !== 80 ? `:${port}` : ''}`;

            assertEquals(srv.computeServerHostUrl(`http://${hostname}:${port}`), expected);
            assertEquals(srv.computeServerHostUrl(`http://${hostname}:${port}/`), expected);
            assertEquals(srv.computeServerHostUrl(`http://${hostname}:${port}/some-path`), expected);
            assertEquals(srv.computeServerHostUrl(`http://${hostname}:${port}/some-path/`), expected);
            assertEquals(srv.computeServerHostUrl(`http://${hostname}:${port}/some-path/get-data`), expected);
            assertEquals(srv.computeServerHostUrl(`http://${hostname}:${port}/some-path/get-data/`), expected);
            assertEquals(srv.computeServerHostUrl(`http://${hostname}:${port}?query=123`), expected);
            assertEquals(srv.computeServerHostUrl(`http://${hostname}:${port}/?query=123`), expected);
            assertEquals(srv.computeServerHostUrl(`http://${hostname}:${port}/some-path?query=123`), expected);
            assertEquals(srv.computeServerHostUrl(`http://${hostname}:${port}/some-path/?query=123`), expected);
        });
    },
});


Deno.test({
    name: "Server.computeServerHostUrl + webRoot",
    fn: () => {
        const serverOptions: ServerOptions[] = [];

        const ports = [8080, 80, 1234];
        const hostnames = ['localhost', '127.0.0.1', 'my-dns.net'];
        const webRoots = ['some', 'some/path'];

        ports.forEach(port => {
            hostnames.forEach(hostname => {
                webRoots.forEach(webRoot => {
                    serverOptions.push({ hostname, port, webRoot })
                });
            });
        });


        serverOptions.forEach(_ => {
            const { port, hostname, webRoot } = _;
            const srv = new Server({ port, hostname, webRoot });

            const origin = `http://${hostname}${port !== 80 ? `:${port}` : ''}`;
            const expected = `${origin}/${webRoot}`;

            assertEquals(srv.computeServerHostUrl(`http://${hostname}:${port}/some/path`), expected);
            assertEquals(srv.computeServerHostUrl(`http://${hostname}:${port}/some/path/`), expected);
            assertEquals(srv.computeServerHostUrl(`http://${hostname}:${port}/some/path/get-data`), expected);
            assertEquals(srv.computeServerHostUrl(`http://${hostname}:${port}/some/path/get-data/`), expected);
            assertEquals(srv.computeServerHostUrl(`http://${hostname}:${port}/some/path?query=123`), expected);
            assertEquals(srv.computeServerHostUrl(`http://${hostname}:${port}/some/path/?query=123`), expected);
        });
    },
});


Deno.test({
    name: "Server.computeClientUrl",
    fn: () => {
        const serverOptions: ServerOptions[] = [];

        const ports = [8080];
        const hostnames = ['localhost'];

        ports.forEach(port => {
            hostnames.forEach(hostname => {
                serverOptions.push({ hostname, port })
            });
        });


        serverOptions.forEach(_ => {
            const { port, hostname } = _;
            const srv = new Server({ port, hostname });

            assertEquals(srv.computeClientUrl(`http://${hostname}:${port}`), '/');
            assertEquals(srv.computeClientUrl(`http://${hostname}:${port}/`), '/');
            assertEquals(srv.computeClientUrl(`http://${hostname}:${port}/some-path`), '/some-path');
            assertEquals(srv.computeClientUrl(`http://${hostname}:${port}/some-path/`), '/some-path');
            assertEquals(srv.computeClientUrl(`http://${hostname}:${port}/some-path/get-data`), '/some-path/get-data');
            assertEquals(srv.computeClientUrl(`http://${hostname}:${port}/some-path/get-data/`), '/some-path/get-data');
            assertEquals(srv.computeClientUrl(`http://${hostname}:${port}?query=123`), '/?query=123');
            assertEquals(srv.computeClientUrl(`http://${hostname}:${port}/?query=123`), '/?query=123');
            assertEquals(srv.computeClientUrl(`http://${hostname}:${port}/some-path?query=123`), '/some-path?query=123');
            // assertEquals(srv.computePublicUrl(`http://${hostname}:${port}/some-path/?query=123`), '/some-path?query=123');
        });
    },
});

