import { assertEquals } from "https://deno.land/std@0.117.0/testing/asserts.ts";
import { Server } from "./Server.ts";


Deno.test({
    name: "Server.computeHostUrl",
    fn: () => {
        const serverOptions: Deno.ListenOptions[] = [];

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

            assertEquals(srv.computeHostUrl(`http://${hostname}:${port}`), expected);
            assertEquals(srv.computeHostUrl(`http://${hostname}:${port}/`), expected);
            assertEquals(srv.computeHostUrl(`http://${hostname}:${port}/some-path`), expected);
            assertEquals(srv.computeHostUrl(`http://${hostname}:${port}/some-path/`), expected);
            assertEquals(srv.computeHostUrl(`http://${hostname}:${port}/some-path/get-data`), expected);
            assertEquals(srv.computeHostUrl(`http://${hostname}:${port}/some-path/get-data/`), expected);
            assertEquals(srv.computeHostUrl(`http://${hostname}:${port}?query=123`), expected);
            assertEquals(srv.computeHostUrl(`http://${hostname}:${port}/?query=123`), expected);
            assertEquals(srv.computeHostUrl(`http://${hostname}:${port}/some-path?query=123`), expected);
            assertEquals(srv.computeHostUrl(`http://${hostname}:${port}/some-path/?query=123`), expected);
        });
    },
});

// Deno.test({
//     name: "Compute HostURL II.",
//     fn: () => {
//         const server = new Server({ port: 8080, hostname: 'localhost' });
//         const url = "http://localhost/some-path"
//         const expected = "http://localhost";

//         assertEquals(server.computeHostUrl(url), expected);
//     },
// });

// Deno.test({
//     name: "Compute HostURL III.",
//     fn: () => {
//         const server = new Server({ port: 8080, hostname: 'localhost', hostpath: 'some-path' });
//         const url = "http://localhost/some-path"
//         const expected = url;

//         assertEquals(server.computeHostUrl(url), expected);
//     },
// });



// Deno.test({
//     name: "Compute BasePath I.",
//     fn: () => {
//         const server = new Server({ port: 8080, hostname: 'localhost' });

//         const url = "http://localhost"
//         const expected = '';

//         assertEquals(server.computeBasePath(url), expected);
//     },
// });

// Deno.test({
//     name: "Compute BasePath II.",
//     fn: () => {
//         const server = new Server({ port: 8080, hostname: 'localhost' });
//         const url = "http://localhost/some-path"
//         const expected = "some-path";

//         assertEquals(server.computeBasePath(url), expected);
//     },
// });

// Deno.test({
//     name: "Compute BasePath III.",
//     fn: () => {
//         const server = new Server({ port: 8080, hostname: 'localhost', hostpath: 'some-path' });
//         const url = "http://localhost/some-path"
//         const expected = '';

//         assertEquals(server.computeBasePath(url), expected);
//     },
// });