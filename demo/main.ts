import { Server } from "../mod.ts";


const port = 8080;

const server = new Server({ port });
server.addRoute('/', () => {
    return new Response("Homepage");
})

server.addRoute('id/:id', (_url, _pattern, { id }) => {
    return new Response(`ID: ${id}`);
})

server.start();
console.log(`http://localhost:${port}`);
