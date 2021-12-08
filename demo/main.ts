import { Server } from "../mod.ts";


const port = 8080;

const server = new Server({ port });
server.addRoute('/', () => {
    return new Response("Homepage");
})

server.addRoute('demo', () => {
    return new Response("Homepage / Demo");
})

server.start();
console.log(`http://localhost:${port}`);
