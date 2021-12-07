import { Server, Router } from "../mod.ts";


const port = 8080;

const router = new Router();
const server = new Server({ port }, router);

router.addRoute('/', () => {
    return new Response("Homepage");
})

router.addRoute('demo', () => {
    return new Response("demo");
})

server.start();
console.log(`http://localhost:${port}`);
