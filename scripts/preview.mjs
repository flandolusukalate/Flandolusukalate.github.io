import { dev } from 'astro';
let server;
try {
  server = await dev({
    root: process.cwd(),
    server: { host:'127.0.0.1', port:Number(process.argv[2]) },
    vite: { server: { strictPort:true } },
  });
  process.send?.({url:`http://127.0.0.1:${server.address.port}`});
} catch(error) {
  process.send?.({error:error.message});
  process.exitCode = 1;
}
const stop = async () => { await server?.stop(); process.exit(); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('disconnect', stop);
