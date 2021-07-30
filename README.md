# deno-server

Jednoduchý předpřipravený **`Deno` server**.

```ts

const router = new Router();
router.addRoute('/', async (request) => {
    return {
        status: 200,
        body: await Deno.open('public/index.html')
    }
});

router.addRoute('/some-page', {
      status: 200,
      body: "Nějaká stránka"
  });

router.addStaticFilesRoute(/^.+\.(js|css|png|jpg)/, 'public');


const server = new Server({ port: 8080 }, router);
server.open();

console.log(`HTTP Server listening on port "http://localhost:${httpPort}"...`);

```
