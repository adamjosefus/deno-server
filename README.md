# deno-server

Jednoduchý předpřipravený **`Deno` server**.

```ts

const server = new Server({ port: 8080 });
server.addRoute('/', async (request) => {
    return {
        status: 200,
        body: await Deno.open('public/index.html')
    }
});

server.addRoute('some-page', {
    status: 200,
    body: "Nějaká stránka"
});

server.addStaticFilesRoute(/^.+\.(js|css|png|jpg)/, 'public');


server.open();
console.log(`HTTP Server listening on port "http://localhost:${httpPort}"...`);

```
