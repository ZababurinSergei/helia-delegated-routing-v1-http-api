require('dotenv').config()
const server = import('./index.mjs');
const express = require('express');
let app = express();

server.then(async (data) => {
    const port = Number(process.env.PORT ?? 5869)

    app = await data.modules(app).catch(e => console.error(e));

    app.listen(port, () => {
        console.log('pid: ', process.pid);
        console.log('listening on http://localhost:' + port);
    });

    process.on('SIGINT', function () {
        process.exit(0);
    });
});
